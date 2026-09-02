import React from 'react';

import APIContext from './context/APIContext';
import MemoryCacheDriver from './drivers/MemoryCacheDriver';
import TaggedCacheDriver from './drivers/TaggedCacheDriver';

import {getCacheKey, parseResponseBody, validateAndThrowExceptions} from './util';

import type {CreateAPIProps, FetchProps, RequestBody, Retry} from './types';

export default function createAPI({
    baseURL,
    throwException,
    cache: cacheDriver = new MemoryCacheDriver(),
    onBeforeRequest,
    onAfterResponse,
    onError,
    maxRetries = 1,
}: CreateAPIProps) {
    const cache = new TaggedCacheDriver(cacheDriver);
    return ({loadInitially = false}: {loadInitially?: boolean} = {}) => {
        const {emitEvent} = React.useContext(APIContext);
        const [loading, setLoading] = React.useState<boolean>(loadInitially);

        const request = async <T>(options: FetchProps<T>): Promise<T> => {
            setLoading(true);
            const method = options.method ?? 'GET';
            const url = baseURL + options.endpoint;
            const retryLimit = options.maxRetries ?? maxRetries;

            let response: Response | undefined;

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

                    let attemptResponse = await fetch(url, {method, headers, signal: options.signal, body});

                    const retry: Retry = async retryOptions => {
                        if (attempt >= retryLimit) return attemptResponse;
                        attempt += 1;
                        return send(retryOptions);
                    };

                    if (onAfterResponse) attemptResponse = await onAfterResponse({response: attemptResponse, emitEvent, retry, attempt});
                    if (options.onAfterResponse)
                        attemptResponse = await options.onAfterResponse({response: attemptResponse, emitEvent, retry, attempt});

                    return attemptResponse;
                };

                response = await send();
                const result = options.onBeforeResult ? await options.onBeforeResult({response, emitEvent}) : await parseResponseBody(response);

                if (response.ok) {
                    if (cacheEntry) await cache.set(cacheEntry.key, result, cacheEntry.ttl, options.cacheConfig?.tags);
                    return result as T;
                }

                if (throwException) validateAndThrowExceptions({response, result});
                return result as T;
            } catch (error) {
                if (onError) await onError({error, url, options, response, emitEvent});
                throw error;
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

        const invalidateCacheGroup = async (tag: string) => {
            await cache.invalidateTag(tag);
        };

        return {loading, request, invalidateCache, invalidateCacheGroup};
    };
}
