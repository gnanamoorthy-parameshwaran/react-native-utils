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
};

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
    onSuccess?: (data: T) => void;
    onError?: (error: unknown) => void;
};

export type UseQueryResult<T> = {
    data: T | undefined;
    error: unknown;
    /** True while a request for this query is in flight. */
    isLoading: boolean;
    /** Fetches again, ignoring the cache. */
    refetch: () => Promise<void>;
};
