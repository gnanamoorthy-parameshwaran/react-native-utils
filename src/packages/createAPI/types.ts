export type RequestBody = string | FormData | null;
export type RetryOptions = {headers?: Headers; body?: RequestBody};

export type Retry = (options?: RetryOptions) => Promise<Response>;
export type EmitEvent = (event: string, payload?: Record<string, unknown>) => void;
export type OnBeforeRequestProps = {headers: Headers; emitEvent: EmitEvent};
export type OnAfterResponseProps = {response: Response; emitEvent: EmitEvent; retry: Retry; attempt: number};
export type OnBeforeResultProps = {response: Response; emitEvent: EmitEvent};
export type OnBeforeRequest = (props: OnBeforeRequestProps) => Promise<Omit<OnBeforeRequestProps, 'emitEvent'>>;
export type OnAfterResponse = (props: OnAfterResponseProps) => Promise<Response>;
export type OnBeforeResult<T = any> = (props: OnBeforeResultProps) => Promise<T>;
export type OnErrorProps = {error: unknown; url: string; options: FetchProps; response?: Response; emitEvent: EmitEvent};
export type OnError = (props: OnErrorProps) => Promise<void> | void;

export type CreateAPIProps = {
    baseURL: string;
    throwException?: boolean;
    onBeforeRequest?: OnBeforeRequest;
    onAfterResponse?: OnAfterResponse;
    onError?: OnError;
    maxRetries?: number;
    /** Default `staleTime` (ms) for queries that don't set one. Defaults to 0: revalidate on every mount. */
    staleTime?: number;
    /** Default `cacheTime` (ms) for queries that don't set one. Defaults to 5 minutes. */
    cacheTime?: number;
    /**
     * Your navigation library's focus hook, e.g. React Navigation's `useFocusEffect`.
     * When given, a query revalidates on screen focus if its data is stale.
     */
    useFocusEffect?: UseFocusEffect;
    /**
     * Revalidate the stale or failed queries on screen when the app returns to the
     * foreground (React Native `AppState`). Off by default.
     */
    revalidateOnAppForeground?: boolean;
    /**
     * Subscribes to connectivity changes and returns an unsubscribe function, e.g.
     * `listener => NetInfo.addEventListener(state => listener(!!state.isConnected))`.
     * When given, the stale or failed queries on screen revalidate when the network comes back.
     */
    subscribeToNetwork?: SubscribeToNetwork;
};

export type UseFocusEffect = (effect: () => undefined | void | (() => void)) => void;
export type SubscribeToNetwork = (listener: (isConnected: boolean) => void) => () => void;

export type FetchProps<T = any> = {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    endpoint: string;
    headers?: Headers;
    body?: RequestBody;
    onBeforeRequest?: OnBeforeRequest;
    onAfterResponse?: OnAfterResponse;
    onBeforeResult?: OnBeforeResult<T>;
    signal?: AbortSignal;
    maxRetries?: number;
};

export type ValidationErrors = Record<string, string[]>;

export type QueryKey = readonly unknown[];
export type Request = <T = any>(options: FetchProps<T>) => Promise<T>;

export type QueryFunctionContext = {
    /** `useAPI().request` without the loading state. */
    request: Request;
};

export type UseQueryOptions<T> = {
    queryKey: QueryKey;
    queryFn: (context: QueryFunctionContext) => Promise<T>;
    /** How long (ms) a result counts as fresh and is served with no request. Afterwards it is stale: still shown, but revalidated in the background on the next mount or focus. Defaults to `createAPI`'s `staleTime`. */
    staleTime?: number;
    /** How long (ms) a result stays in memory for reuse, including while stale. Defaults to `createAPI`'s `cacheTime`. */
    cacheTime?: number;
    /** Set to false to defer fetching until it becomes true or `refetch()` is called. */
    enabled?: boolean;
    /** While a new key loads, keep showing the previous key's data (e.g. page 1 while page 2 loads). */
    keepPreviousData?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: unknown) => void;
};

export type UseQueryResult<T> = {
    data: T | undefined;
    error: unknown;
    /** True while fetching with nothing to show yet: the first load, or a new key without `keepPreviousData`. */
    isLoading: boolean;
    /** True whenever a request for this query is in flight, including refetches over existing data. */
    isFetching: boolean;
    /** True while `data` is the previous key's data, shown by `keepPreviousData` until the new key loads. */
    isPlaceholderData: boolean;
    /** Fetches again, ignoring the cache. */
    refetch: () => Promise<void>;
};
