import React from 'react';

import APIContext from './context/APIContext';
import {hashKey, matchKey, parseResponseBody, validateAndThrowExceptions} from './util';

import type {CreateAPIProps, EmitEvent, FetchProps, QueryKey, RequestBody, Retry, UseQueryOptions, UseQueryResult} from './types';

type CacheEntry = {queryKey: QueryKey; data: unknown; expiresAt: number};
type MountedQuery = {queryKey: QueryKey; isEnabled: () => boolean; refetch: () => Promise<void>};
type QueryState<T> = {hash: string; data: T | undefined; error: unknown; isLoading: boolean};

/**
 * Creates one API instance. `useAPI` is the request layer (base URL, hooks,
 * retry, errors) with a loading flag. `useQuery` caches results per query key
 * for `ttl` ms, and `invalidateQueries` clears them by key prefix.
 */
export default function createAPI({
    baseURL,
    throwException,
    onBeforeRequest,
    onAfterResponse,
    onError,
    maxRetries = 1,
    queryTtl = 0,
}: CreateAPIProps) {
    /**
     * The request pipeline shared by `useAPI` and `useQuery`: global and
     * per-request hooks, retry, result parsing and typed exceptions.
     */
    async function send<T>(options: FetchProps<T>, emitEvent: EmitEvent): Promise<T> {
        const method = options.method ?? 'GET';
        const url = baseURL + options.endpoint;
        const retryLimit = options.maxRetries ?? maxRetries;

        let response: Response | undefined;
        let attempt = 0;

        const attemptSend = async (overrides?: {headers?: Headers; body?: RequestBody}): Promise<Response> => {
            let headers = new Headers(overrides?.headers ?? options.headers);
            const body = overrides?.body ? overrides.body : options.body;

            if (onBeforeRequest) ({headers} = await onBeforeRequest({headers, emitEvent}));
            if (options.onBeforeRequest) ({headers} = await options.onBeforeRequest({headers, emitEvent}));

            let attemptResponse = await fetch(url, {method, headers, signal: options.signal, body});

            const retry: Retry = async retryOptions => {
                if (attempt >= retryLimit) return attemptResponse;
                attempt += 1;
                return attemptSend(retryOptions);
            };

            if (onAfterResponse) attemptResponse = await onAfterResponse({response: attemptResponse, emitEvent, retry, attempt});
            if (options.onAfterResponse) attemptResponse = await options.onAfterResponse({response: attemptResponse, emitEvent, retry, attempt});

            return attemptResponse;
        };

        try {
            response = await attemptSend();
            const result = options.onBeforeResult ? await options.onBeforeResult({response, emitEvent}) : await parseResponseBody(response);

            if (!response.ok && throwException) validateAndThrowExceptions({response, result});
            return result as T;
        } catch (error) {
            if (onError) await onError({error, url, options, response, emitEvent});
            throw error;
        }
    }

    function useAPI({loadInitially = false}: {loadInitially?: boolean} = {}) {
        const {emitEvent} = React.useContext(APIContext);
        const [loading, setLoading] = React.useState<boolean>(loadInitially);

        const request = async <T>(options: FetchProps<T>): Promise<T> => {
            setLoading(true);
            try {
                return await send(options, emitEvent);
            } finally {
                setLoading(false);
            }
        };

        return {loading, request};
    }

    /**
     * Cached results, keyed by `hashKey(queryKey)`. Each entry keeps its original
     * `queryKey` so `invalidateQueries` can match it by prefix.
     */
    const cache = new Map<string, CacheEntry>();

    /** Every `useQuery` currently on screen, so invalidation can refetch what is visible. */
    const mounted = new Set<MountedQuery>();

    /**
     * Requests currently running, by key hash. A fetch for a key that is already
     * loading awaits that request instead of sending another one, so several
     * components on the same key make a single call.
     */
    const inflight = new Map<string, {queryKey: QueryKey; promise: Promise<unknown>}>();

    /** Returns cached data while it is fresh; an expired entry is dropped. */
    function readCache<T>(hash: string): T | undefined {
        const entry = cache.get(hash);
        if (!entry) return undefined;

        if (entry.expiresAt <= Date.now()) {
            cache.delete(hash);
            return undefined;
        }

        return entry.data as T;
    }

    function useQuery<T>({
        queryKey,
        queryFn,
        ttl = queryTtl,
        enabled = true,
        onSuccess,
        onError: onQueryError,
    }: UseQueryOptions<T>): UseQueryResult<T> {
        const {emitEvent} = React.useContext(APIContext);
        const hash = hashKey(queryKey);

        const initialState = (): QueryState<T> => {
            const data = readCache<T>(hash);
            return {hash, data, error: null, isLoading: enabled && data === undefined};
        };

        const [state, setState] = React.useState<QueryState<T>>(initialState);

        /** A new key starts from its own cache entry instead of showing the previous key's data. */
        if (state.hash !== hash) setState(initialState());

        /** The latest props, read when a fetch starts, so inline `queryFn`/callbacks are always current. */
        const latest = React.useRef({queryKey, queryFn, ttl, enabled, onSuccess, onQueryError, emitEvent});
        latest.current = {queryKey, queryFn, ttl, enabled, onSuccess, onQueryError, emitEvent};

        const currentHash = React.useRef(hash);
        currentHash.current = hash;
        const isActive = React.useRef(true);
        const lastFetch = React.useRef(0);

        /**
         * Serves a fresh cache entry unless `force`, otherwise calls `queryFn`
         * and caches the result. A response is ignored by this component if it
         * unmounted, its key changed, or a newer fetch started meanwhile.
         */
        const fetchData = React.useCallback(
            async (force: boolean) => {
                const fetchId = ++lastFetch.current;
                const isStale = () => !isActive.current || currentHash.current !== hash || lastFetch.current !== fetchId;

                if (!force) {
                    const cached = readCache<T>(hash);
                    if (cached !== undefined) {
                        setState({hash, data: cached, error: null, isLoading: false});
                        return;
                    }
                }

                const {queryKey: key, queryFn: fn, ttl: entryTtl, onSuccess: success, onQueryError: failure, emitEvent: emit} = latest.current;
                setState(previous => ({...previous, isLoading: true}));

                let running = inflight.get(hash);
                if (!running) {
                    const promise = fn({request: options => send(options, emit)})
                        .then(data => {
                            if (inflight.get(hash)?.promise === promise) cache.set(hash, {queryKey: key, data, expiresAt: Date.now() + entryTtl});
                            return data;
                        })
                        .finally(() => {
                            if (inflight.get(hash)?.promise === promise) inflight.delete(hash);
                        });
                    running = {queryKey: key, promise};
                    inflight.set(hash, running);
                }

                try {
                    const data = (await running.promise) as T;
                    if (isStale()) return;

                    setState({hash, data, error: null, isLoading: false});
                    success?.(data);
                } catch (error) {
                    if (isStale()) return;

                    setState(previous => ({...previous, error, isLoading: false}));
                    failure?.(error);
                }
            },
            [hash],
        );

        React.useEffect(() => {
            isActive.current = true;
            return () => {
                isActive.current = false;
            };
        }, []);

        React.useEffect(() => {
            if (enabled) fetchData(false);
        }, [fetchData, enabled]);

        React.useEffect(() => {
            const entry: MountedQuery = {
                queryKey: latest.current.queryKey,
                isEnabled: () => latest.current.enabled,
                refetch: () => fetchData(true),
            };
            mounted.add(entry);
            return () => {
                mounted.delete(entry);
            };
        }, [fetchData]);

        const refetch = React.useCallback(() => fetchData(true), [fetchData]);

        return {data: state.data, error: state.error, isLoading: state.isLoading, refetch};
    }

    /**
     * Clears every cached entry whose key starts with `queryKey` (`['posts']`
     * matches `['posts', {id: 1}]`; no key clears everything), then refetches
     * the matching queries that are on screen. Matching in-flight requests are
     * dropped too, so the refetch never reuses a request that started before it.
     */
    async function invalidateQueries(queryKey: QueryKey = []): Promise<void> {
        cache.forEach((entry, hash) => {
            if (matchKey(entry.queryKey, queryKey)) cache.delete(hash);
        });
        inflight.forEach((running, hash) => {
            if (matchKey(running.queryKey, queryKey)) inflight.delete(hash);
        });

        const visible = [...mounted].filter(query => query.isEnabled() && matchKey(query.queryKey, queryKey));
        await Promise.all(visible.map(query => query.refetch()));
    }

    return {useAPI, useQuery, invalidateQueries};
}
