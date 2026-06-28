import React from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

export type ResponseFailedType = {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
};

export type APIConfig = {
  apiUrl: string;
  apiKey: string;
  storageKeys?: {
    authToken?: string;
    language?: string;
  };
};

export type useAPIType = {
  config: APIConfig;
  initialLoaders?: {
    getting?: boolean;
    patching?: boolean;
    putting?: boolean;
    deleting?: boolean;
    posting?: boolean;
  };
  OnInitialize?: () => void;
};

export type FetchProps = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  headers?: Headers;
  body?: FormData | string | null;
  cacheConfig?: {
    key: string;
    enabled: boolean;
    timeout: number;
  };
};

/**
 * Custom hook for API calls
 * @param params The parameters for the API calls
 * @returns An object containing the API call methods and loading states
 */
export default function useAPI({
  config,
  initialLoaders = {
    getting: false,
    patching: false,
    putting: false,
    deleting: false,
    posting: false,
  },
  OnInitialize,
}: useAPIType) {
  const [state, setState] = React.useState(initialLoaders);

  async function Get<T>(options: FetchProps): Promise<T | ResponseFailedType> {
    setState((prev) => ({ ...prev, getting: true }));
    try {
      return await Fetch(config, { ...options, method: 'GET' });
    } finally {
      setState((prev) => ({ ...prev, getting: false }));
    }
  }

  async function Post<T>(options: FetchProps): Promise<T | ResponseFailedType> {
    setState((prev) => ({ ...prev, posting: true }));
    try {
      return await Fetch(config, { ...options, method: 'POST' });
    } finally {
      setState((prev) => ({ ...prev, posting: false }));
    }
  }

  async function Put<T>(options: FetchProps): Promise<T | ResponseFailedType> {
    setState((prev) => ({ ...prev, putting: true }));
    try {
      return await Fetch(config, { ...options, method: 'PUT' });
    } finally {
      setState((prev) => ({ ...prev, putting: false }));
    }
  }

  async function Patch<T>(
    options: FetchProps
  ): Promise<T | ResponseFailedType> {
    setState((prev) => ({ ...prev, patching: true }));
    try {
      return await Fetch(config, { ...options, method: 'PATCH' });
    } finally {
      setState((prev) => ({ ...prev, patching: false }));
    }
  }

  async function Delete<T>(
    options: FetchProps
  ): Promise<T | ResponseFailedType> {
    setState((prev) => ({ ...prev, deleting: true }));
    try {
      return await Fetch(config, { ...options, method: 'DELETE' });
    } finally {
      setState((prev) => ({ ...prev, deleting: false }));
    }
  }

  React.useEffect(() => {
    OnInitialize?.();
  }, [OnInitialize]);

  return {
    ...state,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    GetCacheKey: (opts: { method: string; endpoint: string }) =>
      GetCacheKey(config, opts),
    InvalidateCache,
  };
}

async function InvalidateCache(key: string) {
  await AsyncStorage.removeItem(key);
}

function GetCacheKey(
  config: APIConfig,
  { method, endpoint }: { method: string; endpoint: string }
) {
  return `${method}:${config.apiUrl + endpoint}`;
}

async function Fetch(config: APIConfig, options: FetchProps) {
  const authTokenKey = config.storageKeys?.authToken ?? 'auth_token';
  const languageKey = config.storageKeys?.language ?? 'language';

  const headers = options.headers || new Headers();
  const authorization = await AsyncStorage.getItem(authTokenKey);
  const language = await AsyncStorage.getItem(languageKey);
  if (authorization) {
    headers.append('Authorization', 'Bearer ' + authorization);
  }
  headers.append('x-api-key', config.apiKey);
  headers.append('Accept', 'application/json');
  headers.append('Accept-Language', language ?? 'ta');

  if (options.cacheConfig?.key) {
    const cachedResponse = await AsyncStorage.getItem(options.cacheConfig.key);
    if (cachedResponse) {
      const cachedResult = JSON.parse(cachedResponse);
      if (
        cachedResult &&
        cachedResult?.expiry &&
        cachedResult.expiry < new Date().getTime()
      ) {
        await AsyncStorage.removeItem(options.cacheConfig.key);
      } else {
        return cachedResult.result;
      }
    }
  }

  const requestOptions = {
    method: options.method,
    headers: headers,
    body: options.body,
  };
  const response = await fetch(
    config.apiUrl + options.endpoint,
    requestOptions
  );
  const result = await response.json();

  if (response.ok && options.cacheConfig?.enabled) {
    if (options.cacheConfig.key) {
      const cacheStore = {
        result: result,
        expiry: new Date().getTime() + options.cacheConfig.timeout,
      };
      await AsyncStorage.setItem(
        options.cacheConfig.key,
        JSON.stringify(cacheStore)
      );
    }
  }

  return result;
}
