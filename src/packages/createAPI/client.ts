import React from 'react';

import APIContext from './context/APIContext';
import {hashKey, matchKey, parseResponseBody, validateAndThrowExceptions} from './util';

import type {CreateAPIProps, EmitEvent, FetchProps, QueryKey, RequestBody, Retry, UseQueryOptions, UseQueryResult} from './types';

type CacheEntry = {queryKey: QueryKey; data: unknown; expiresAt: number};
type MountedQuery = {queryKey: QueryKey; isEnabled: () => boolean; isFocused: () => boolean; refetch: () => Promise<void>};
type QueryState<T> = {hash: string; data: T | undefined; error: unknown; isFetching: boolean; isPlaceholderData: boolean};

/** Stand-in when no focus hook is passed to `createAPI`, so `useQuery` calls the same hooks every render. */
function noFocusEffect(): void {}

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
    useFocusEffect = noFocusEffect,
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

    /** Every mounted `useQuery`, so invalidation can refetch the ones that are visible. */
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

    /**
     * Stores a result, first dropping every expired entry so data nobody reads
     * again doesn't stay in memory. A result with no `ttl` is never stored,
     * since it would already count as expired.
     */
    function writeCache({hash, queryKey, data, ttl}: {hash: string; queryKey: QueryKey; data: unknown; ttl: number}): void {
        const now = Date.now();
        cache.forEach((entry, key) => {
            if (entry.expiresAt <= now) cache.delete(key);
        });

        if (ttl > 0) cache.set(hash, {queryKey, data, expiresAt: now + ttl});
    }

    function useQuery<T>({
        queryKey,
        queryFn,
        ttl = queryTtl,
        enabled = true,
        keepPreviousData = false,
        onSuccess,
        onError: onQueryError,
    }: UseQueryOptions<T>): UseQueryResult<T> {
        const {emitEvent} = React.useContext(APIContext);
        const hash = hashKey(queryKey);

        /**
         * The state for the current key: its own cache entry if fresh. Otherwise,
         * with `keepPreviousData`, the previous key's data stays on screen as
         * placeholder (e.g. page 1 while page 2 loads) instead of going blank.
         */
        const stateForKey = (previous?: QueryState<T>): QueryState<T> => {
            const data = readCache<T>(hash);
            const isFetching = enabled && data === undefined;

            if (data === undefined && keepPreviousData && previous?.data !== undefined) {
                return {hash, data: previous.data, error: null, isFetching, isPlaceholderData: true};
            }
            return {hash, data, error: null, isFetching, isPlaceholderData: false};
        };

        const [state, setState] = React.useState<QueryState<T>>(() => stateForKey());
        if (state.hash !== hash) setState(stateForKey(state));

        /** The latest props, read when a fetch starts, so inline `queryFn`/callbacks are always current. */
        const latest = React.useRef({queryKey, queryFn, ttl, enabled, onSuccess, onQueryError, emitEvent});
        latest.current = {queryKey, queryFn, ttl, enabled, onSuccess, onQueryError, emitEvent};

        const currentHash = React.useRef(hash);
        currentHash.current = hash;
        const isActive = React.useRef(true);

        /** Without a focus hook every mounted query counts as focused; with one, it tracks focus and blur. */
        const isFocused = React.useRef(useFocusEffect === noFocusEffect);
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
                        setState({hash, data: cached, error: null, isFetching: false, isPlaceholderData: false});
                        return;
                    }
                }

                const {queryKey: key, queryFn: fn, ttl: entryTtl, onSuccess: success, onQueryError: failure, emitEvent: emit} = latest.current;
                setState(previous => ({...previous, isFetching: true}));

                let running = inflight.get(hash);
                if (!running) {
                    const promise = fn({request: options => send(options, emit)})
                        .then(data => {
                            if (inflight.get(hash)?.promise === promise) writeCache({hash, queryKey: key, data, ttl: entryTtl});
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

                    setState({hash, data, error: null, isFetching: false, isPlaceholderData: false});
                    success?.(data);
                } catch (error) {
                    if (isStale()) return;

                    setState(previous => ({...previous, error, isFetching: false}));
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

        /**
         * On screen focus, fetch again only if the cache has expired (or was
         * invalidated while the screen was in the background). The mount effect
         * above may run alongside the first focus; both share one request.
         */
        const onFocus = React.useCallback(() => {
            isFocused.current = true;
            if (latest.current.enabled) fetchData(false);
            return () => {
                isFocused.current = false;
            };
        }, [fetchData]);
        useFocusEffect(onFocus);

        React.useEffect(() => {
            const entry: MountedQuery = {
                queryKey: latest.current.queryKey,
                isEnabled: () => latest.current.enabled,
                isFocused: () => isFocused.current,
                refetch: () => fetchData(true),
            };
            mounted.add(entry);
            return () => {
                mounted.delete(entry);
            };
        }, [fetchData]);

        const refetch = React.useCallback(() => fetchData(true), [fetchData]);

        return {
            data: state.data,
            error: state.error,
            isLoading: state.isFetching && state.data === undefined,
            isFetching: state.isFetching,
            isPlaceholderData: state.isPlaceholderData,
            refetch,
        };
    }

    /**
     * Clears every cached entry whose key starts with `queryKey` (`['posts']`
     * matches `['posts', {id: 1}]`; no key clears everything), then refetches
     * the matching queries that are visible: mounted, enabled and focused.
     * Background screens fetch when they regain focus, unmounted ones on their
     * next mount. Matching in-flight requests are dropped too, so a refetch
     * never reuses a request that started before the invalidation.
     */
    async function invalidateQueries(queryKey: QueryKey = []): Promise<void> {
        cache.forEach((entry, hash) => {
            if (matchKey(entry.queryKey, queryKey)) cache.delete(hash);
        });
        inflight.forEach((running, hash) => {
            if (matchKey(running.queryKey, queryKey)) inflight.delete(hash);
        });

        const visible = [...mounted].filter(query => query.isEnabled() && query.isFocused() && matchKey(query.queryKey, queryKey));
        await Promise.all(visible.map(query => query.refetch()));
    }

    return {useAPI, useQuery, invalidateQueries};
}
