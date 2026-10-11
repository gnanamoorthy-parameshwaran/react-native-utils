import React from 'react';
import {AppState} from 'react-native';

import APIContext from './context/APIContext';
import {hashKey, matchKey, noFocusEffect, parseResponseBody, replaceEqualDeep, validateAndThrowExceptions} from './util';

import type {
    CacheEntry,
    CreateAPIProps,
    EmitEvent,
    FetchProps,
    MountedQuery,
    QueryKey,
    QueryState,
    RequestBody,
    Retry,
    UseQueryOptions,
    UseQueryResult,
} from './types';

/** Default for how long unused query data stays in memory: 5 minutes. */
const DEFAULT_CACHE_TIME = 5 * 60 * 1000;

/**
 * Creates one API instance. `useAPI` is the request layer (base URL, hooks,
 * retry, errors) with a loading flag. `useQuery` caches results per query key:
 * fresh for `staleTime`, then shown while revalidating in the background until
 * `cacheTime`. `invalidateQueries` marks them stale by key prefix.
 */
export default function createAPI({
    baseURL,
    throwException,
    onBeforeRequest,
    onAfterResponse,
    onError,
    maxRetries = 1,
    staleTime: defaultStaleTime = 0,
    cacheTime: defaultCacheTime = DEFAULT_CACHE_TIME,
    useFocusEffect = noFocusEffect,
    revalidateOnAppForeground = false,
    subscribeToNetwork,
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
     * Revalidates the visible queries (mounted, enabled and focused) whose data
     * is stale or missing; fresh data is left alone. Runs when the app returns to
     * the foreground or the network comes back, if those are opted in.
     */
    function revalidateVisible(): void {
        mounted.forEach(query => {
            if (query.isEnabled() && query.isFocused()) query.revalidate();
        });
    }

    let appState = AppState.currentState;
    let isConnected = true;
    let stopListening: (() => void) | undefined;

    /**
     * Attaches the opted-in app-foreground and network listeners. They only
     * matter while a query is on screen, so they are attached when the first
     * query mounts and removed when the last one unmounts.
     */
    function startListening(): () => void {
        const stops: (() => void)[] = [];

        if (revalidateOnAppForeground) {
            appState = AppState.currentState;
            const subscription = AppState.addEventListener('change', next => {
                if (appState !== 'active' && next === 'active') revalidateVisible();
                appState = next;
            });
            stops.push(() => subscription.remove());
        }

        if (subscribeToNetwork) {
            stops.push(
                subscribeToNetwork(connected => {
                    if (connected && !isConnected) revalidateVisible();
                    isConnected = connected;
                }),
            );
        }

        return () => stops.forEach(stop => stop());
    }

    function addMounted(query: MountedQuery): void {
        mounted.add(query);
        if (mounted.size === 1) stopListening = startListening();
    }

    function removeMounted(query: MountedQuery): void {
        mounted.delete(query);
        if (mounted.size === 0) {
            stopListening?.();
            stopListening = undefined;
        }
    }

    /**
     * Requests currently running, by key hash. A fetch for a key that is already
     * loading awaits that request instead of sending another one, so several
     * components on the same key make a single call.
     */
    const inflight = new Map<string, {queryKey: QueryKey; promise: Promise<unknown>}>();

    /**
     * Returns cached data until it expires, with whether it is stale. Stale data
     * is still shown, but should be revalidated; an expired entry is dropped.
     */
    function readCache<T>(hash: string): {data: T; isStale: boolean} | undefined {
        const entry = cache.get(hash);
        if (!entry) return undefined;

        const now = Date.now();
        if (entry.expiresAt <= now) {
            cache.delete(hash);
            return undefined;
        }

        return {data: entry.data as T, isStale: entry.staleAt <= now};
    }

    /**
     * Stores a result, first dropping every expired entry so data nobody reads
     * again doesn't stay in memory. The entry is kept for `cacheTime`, or at
     * least until it goes stale; with both at 0 it is never stored.
     */
    function writeCache({
        hash,
        queryKey,
        data,
        staleTime,
        cacheTime,
    }: {
        hash: string;
        queryKey: QueryKey;
        data: unknown;
        staleTime: number;
        cacheTime: number;
    }): void {
        const now = Date.now();
        cache.forEach((entry, key) => {
            if (entry.expiresAt <= now) cache.delete(key);
        });

        const keepFor = Math.max(staleTime, cacheTime);
        if (keepFor > 0) cache.set(hash, {queryKey, data, staleAt: now + staleTime, expiresAt: now + keepFor});
    }

    function useQuery<T>({
        queryKey,
        queryFn,
        staleTime = defaultStaleTime,
        cacheTime = defaultCacheTime,
        enabled = true,
        keepPreviousData = false,
        onSuccess,
        onError: onQueryError,
    }: UseQueryOptions<T>): UseQueryResult<T> {
        const {emitEvent} = React.useContext(APIContext);
        const hash = hashKey(queryKey);

        /**
         * The state for the current key: its own cache entry, fresh or stale (stale
         * data is shown while it revalidates). Otherwise, with `keepPreviousData`,
         * the previous key's data stays on screen as placeholder (e.g. page 1
         * while page 2 loads) instead of going blank.
         */
        const stateForKey = (previous?: QueryState<T>): QueryState<T> => {
            const cached = readCache<T>(hash);
            const data = cached?.data;
            const isFetching = enabled && (cached === undefined || cached.isStale);

            if (data === undefined && keepPreviousData && previous?.data !== undefined) {
                return {hash, data: previous.data, error: null, isFetching, isPlaceholderData: true};
            }
            return {hash, data, error: null, isFetching, isPlaceholderData: false};
        };

        const [state, setState] = React.useState<QueryState<T>>(() => stateForKey());
        if (state.hash !== hash) setState(stateForKey(state));

        /** The latest props, read when a fetch starts, so inline `queryFn`/callbacks are always current. */
        const latest = React.useRef({queryKey, queryFn, staleTime, cacheTime, enabled, onSuccess, onQueryError, emitEvent});
        latest.current = {queryKey, queryFn, staleTime, cacheTime, enabled, onSuccess, onQueryError, emitEvent};

        const currentHash = React.useRef(hash);
        currentHash.current = hash;

        /** The data on screen now, so a new result can reuse its unchanged parts (structural sharing). */
        const currentData = React.useRef(state.data);
        currentData.current = state.data;
        const isActive = React.useRef(true);

        /** Without a focus hook every mounted query counts as focused; with one, it tracks focus and blur. */
        const isFocused = React.useRef(useFocusEffect === noFocusEffect);
        const lastFetch = React.useRef(0);

        /**
         * Serves a fresh cache entry unless `force`. Stale data is shown right
         * away while `queryFn` revalidates it in the background; with nothing
         * cached, it simply fetches. A response is ignored by this component if
         * it unmounted, its key changed, or a newer fetch started meanwhile.
         */
        const fetchData = React.useCallback(
            async (force: boolean) => {
                const fetchId = ++lastFetch.current;
                const isStale = () => !isActive.current || currentHash.current !== hash || lastFetch.current !== fetchId;

                if (!force) {
                    const cached = readCache<T>(hash);
                    if (cached) {
                        const data = replaceEqualDeep(currentData.current, cached.data);
                        setState({hash, data, error: null, isFetching: cached.isStale, isPlaceholderData: false});
                        if (!cached.isStale) return;
                    }
                }

                const {queryKey: key, queryFn: fn, onSuccess: success, onQueryError: failure, emitEvent: emit} = latest.current;
                const times = {staleTime: latest.current.staleTime, cacheTime: latest.current.cacheTime};
                setState(previous => ({...previous, isFetching: true}));

                let running = inflight.get(hash);
                if (!running) {
                    const promise = fn({request: options => send(options, emit)})
                        .then(data => {
                            if (inflight.get(hash)?.promise !== promise) return data;

                            const shared = replaceEqualDeep(cache.get(hash)?.data, data);
                            writeCache({hash, queryKey: key, data: shared, ...times});
                            return shared;
                        })
                        .finally(() => {
                            if (inflight.get(hash)?.promise === promise) inflight.delete(hash);
                        });
                    running = {queryKey: key, promise};
                    inflight.set(hash, running);
                }

                try {
                    const result = (await running.promise) as T;
                    if (isStale()) return;

                    const data = replaceEqualDeep(currentData.current, result);
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
         * On screen focus, revalidate if the data is stale or gone (including
         * after an invalidation while the screen was in the background). The
         * mount effect above may run alongside the first focus; both share one request.
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
                revalidate: () => fetchData(false),
            };
            addMounted(entry);
            return () => removeMounted(entry);
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
     * Marks every cached entry whose key starts with `queryKey` as stale
     * (`['posts']` matches `['posts', {id: 1}]`; no key matches everything),
     * then refetches the matching queries that are visible: mounted, enabled
     * and focused. Background screens revalidate when they regain focus,
     * unmounted ones on their next mount, showing the old data meanwhile.
     * Matching in-flight requests are dropped, so a refetch never reuses a
     * request that started before the invalidation.
     */
    async function invalidateQueries(queryKey: QueryKey = []): Promise<void> {
        cache.forEach((entry, hash) => {
            if (matchKey(entry.queryKey, queryKey)) cache.set(hash, {...entry, staleAt: 0});
        });
        inflight.forEach((running, hash) => {
            if (matchKey(running.queryKey, queryKey)) inflight.delete(hash);
        });

        const visible = [...mounted].filter(query => query.isEnabled() && query.isFocused() && matchKey(query.queryKey, queryKey));
        await Promise.all(visible.map(query => query.refetch()));
    }

    return {useAPI, useQuery, invalidateQueries};
}
