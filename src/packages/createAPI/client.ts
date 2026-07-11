import React from 'react';

import APIContext from './context/APIContext';
import MemoryCacheDriver from './drivers/MemoryCacheDriver';

import { getCacheKey, validateAndThrowExceptions } from './util';

import type { CreateAPIProps, FetchProps } from './types';

export default function createAPI({
  baseURL,
  throwException,
  cache = new MemoryCacheDriver(),
  onBeforeRequest,
  onAfterResponse,
}: CreateAPIProps) {
  return ({ loadInitially = false }: { loadInitially?: boolean } = {}) => {
    const { emitEvent } = React.useContext(APIContext);
    const [loading, setLoading] = React.useState<boolean>(loadInitially);

    const request = async <T>(options: FetchProps) => {
      setLoading(true);
      const method = options.method ?? 'GET';

      try {
        if (options.cacheConfig) {
          const cacheKey =
            options.cacheConfig.key ??
            getCacheKey({ method, endpoint: options.endpoint });
          const cached = await cache.get<T>(cacheKey);
          if (cached) return cached;
        }

        let headers = options.headers || new Headers();
        let body = options.body;

        if (onBeforeRequest) {
          const result = await onBeforeRequest({ headers, emitEvent });
          headers = result.headers;
        }
        if (options.onBeforeRequest) {
          const result = await options.onBeforeRequest({ headers, emitEvent });
          headers = result.headers;
        }

        const url = baseURL + options.endpoint;
        let response = await fetch(url, {
          method: method,
          headers,
          signal: options.signal,
          body: body ? body : undefined,
        });

        if (onAfterResponse) {
          response = await onAfterResponse({ response, emitEvent });
        }
        if (options.onAfterResponse) {
          response = await options.onAfterResponse({ response, emitEvent });
        }

        const result = await response.json();

        if (response.ok) {
          if (options.cacheConfig) {
            const cacheKey =
              options.cacheConfig.key ??
              getCacheKey({ method, endpoint: options.endpoint });
            await cache.set(cacheKey, result, options.cacheConfig.ttl);
          }
          return result;
        }

        if (throwException) validateAndThrowExceptions({ response, result });
        else return result;
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

    return { loading, request, invalidateCache };
  };
}
