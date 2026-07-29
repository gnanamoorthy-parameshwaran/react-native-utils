import React from 'react';

import APIContext from './context/APIContext';
import MemoryCacheDriver from './drivers/MemoryCacheDriver';

import {getCacheKey, parseResponseBody, validateAndThrowExceptions} from './util';

import type {CreateAPIProps, FetchProps, RequestBody, Retry} from './types';

export default function createAPI({
    baseURL,
    throwException,
    cache = new MemoryCacheDriver(),
    onBeforeRequest,
    onAfterResponse,
    maxRetries = 1,
}: CreateAPIProps) {
    return ({loadInitially = false}: {loadInitially?: boolean} = {}) => {
        const {emitEvent} = React.useContext(APIContext);
        const [loading, setLoading] = React.useState<boolean>(loadInitially);

        const request = async <T>(options: FetchProps<T>): Promise<T> => {
            setLoading(true);
            const method = options.method ?? 'GET';
            const url = baseURL + options.endpoint;
            const retryLimit = options.maxRetries ?? maxRetries;

            try {
                const cacheEntry = options.cacheConfig
                    ? {key: options.cacheConfig.key ?? getCacheKey({method, endpoint: options.endpoint}), ttl: options.cacheConfig.ttl}
                    : undefined;

                if (cacheEntry) {
                    const cached = await cache.get<T>(cacheEntry.key);
                    if (cached) return cached;
                }

                let attempt = 0;

                const send = async (overrides?: {headers?: Headers; body?: RequestBody}): Promise<Response> => {
                    let headers = new Headers(overrides?.headers ?? options.headers);
                    const body = overrides?.body ? overrides.body : options.body;

                    if (onBeforeRequest) ({headers} = await onBeforeRequest({headers, emitEvent}));
                    if (options.onBeforeRequest) ({headers} = await options.onBeforeRequest({headers, emitEvent}));

                    let response = await fetch(url, {method, headers, signal: options.signal, body});

                    const retry: Retry = async retryOptions => {
                        if (attempt >= retryLimit) return response;
                        attempt += 1;
                        return send(retryOptions);
                    };

                    if (onAfterResponse) response = await onAfterResponse({response, emitEvent, retry, attempt});
                    if (options.onAfterResponse) response = await options.onAfterResponse({response, emitEvent, retry, attempt});

                    return response;
                };

                const response = await send();
                const result = options.onBeforeResult ? await options.onBeforeResult({response, emitEvent}) : await parseResponseBody(response);

                if (response.ok) {
                    if (cacheEntry) await cache.set(cacheEntry.key, result, cacheEntry.ttl);
                    return result as T;
                }

                if (throwException) validateAndThrowExceptions({response, result});
                return result as T;
            } finally {
                setLoading(false);
            }
        };

        const invalidateCache = async (key?: string) => {
            if (key) {
                await cache.delete(key);
            } else {
                await cache.deleteAll();
            }
        };

        return {loading, request, invalidateCache};
    };
}
