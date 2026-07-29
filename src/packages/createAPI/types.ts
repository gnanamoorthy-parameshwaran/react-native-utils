export type RequestBody = string | FormData | null;
export type CacheConfig = {key?: string; ttl: number};
export type CacheEntry = {value: unknown; expiresAt: number};
export type RetryOptions = {headers?: Headers; body?: RequestBody};

export type Retry = (options?: RetryOptions) => Promise<Response>;
export type EmitEvent = (event: string, payload?: Record<string, unknown>) => void;
export type OnBeforeRequestProps = {headers: Headers; emitEvent: EmitEvent};
export type OnAfterResponseProps = {response: Response; emitEvent: EmitEvent; retry: Retry; attempt: number};
export type OnBeforeResultProps = {response: Response; emitEvent: EmitEvent};
export type OnBeforeRequest = (props: OnBeforeRequestProps) => Promise<Omit<OnBeforeRequestProps, 'emitEvent'>>;
export type OnAfterResponse = (props: OnAfterResponseProps) => Promise<Response>;
export type OnBeforeResult<T = any> = (props: OnBeforeResultProps) => Promise<T>;

export type CacheStorage = {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
};

export type CreateAPIProps = {
    baseURL: string;
    throwException?: boolean;
    onBeforeRequest?: OnBeforeRequest;
    onAfterResponse?: OnAfterResponse;
    cache?: APICacheDriver;
    maxRetries?: number;
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
    cacheConfig?: CacheConfig;
    maxRetries?: number;
};

export type ValidationErrors = Record<string, string[]>;

export interface APICacheDriver {
    get<T>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown, ttl: number): Promise<void>;
    delete(key: string): Promise<void>;
    deleteAll(): Promise<void>;
}
