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
    /** Default `ttl` (ms) for `useQuery` when a query doesn't set its own. Defaults to 0 (no caching). */
    queryTtl?: number;
    /**
     * Your navigation library's focus hook, e.g. React Navigation's `useFocusEffect`.
     * When given, a query fetches again on screen focus if its cache has expired.
     */
    useFocusEffect?: UseFocusEffect;
};

export type UseFocusEffect = (effect: () => undefined | void | (() => void)) => void;

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
    /** How long (ms) a result is served from cache before the next mount refetches. Defaults to `createAPI`'s `queryTtl`. */
    ttl?: number;
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
