export type CacheConfig = {key?: string; ttl: number};
export type CacheEntry = {value: unknown; expiresAt: number};
export type EmitEvent = (event: string, payload?: Record<string, unknown>) => void;

export type OnBeforeRequestProps = {headers: Headers; emitEvent: EmitEvent};
export type OnAfterResponseProps = {response: Response; emitEvent: EmitEvent};
export type OnBeforeRequest = (props: OnBeforeRequestProps) => Promise<Omit<OnBeforeRequestProps, 'emitEvent'>>;
export type OnAfterResponse = (props: OnAfterResponseProps) => Promise<Response>;

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
};

export type FetchProps = {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    endpoint: string;
    headers?: Headers;
    body?: string | FormData | null;
    onBeforeRequest?: OnBeforeRequest;
    onAfterResponse?: OnAfterResponse;
    signal?: AbortSignal;
    cacheConfig?: CacheConfig;
};

export type ValidationErrors = Record<string, string[]>;

export interface APICacheDriver {
    get<T>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown, ttl: number): Promise<void>;
    delete(key: string): Promise<void>;
    deleteAll(): Promise<void>;
}
