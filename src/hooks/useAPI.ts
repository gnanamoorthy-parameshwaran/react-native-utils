import React from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import Constant from '@utils/Constant';

import type {ResponseFailedType} from '@apptypes/index';

export type useAPIType = {
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
  initialLoaders = {
    getting: false,
    patching: false,
    putting: false,
    deleting: false,
    posting: false,
  },
  OnInitialize,
}: useAPIType = {}) {
  const [state, setState] = React.useState(initialLoaders);

  async function Get<T>(options: FetchProps): Promise<T | ResponseFailedType> {
    setState(prev => ({...prev, getting: true}));
    try {
      return await Fetch({...options, method: 'GET'});
    } finally {
      setState(prev => ({...prev, getting: false}));
    }
  }

  async function Post<T>(options: FetchProps): Promise<T | ResponseFailedType> {
    setState(prev => ({...prev, posting: true}));
    try {
      return await Fetch({...options, method: 'POST'});
    } finally {
      setState(prev => ({...prev, posting: false}));
    }
  }

  async function Put<T>(options: FetchProps): Promise<T | ResponseFailedType> {
    setState(prev => ({...prev, putting: true}));
    try {
      return await Fetch({...options, method: 'PUT'});
    } finally {
      setState(prev => ({...prev, putting: false}));
    }
  }

  async function Patch<T>(options: FetchProps): Promise<T | ResponseFailedType> {
    setState(prev => ({...prev, patching: true}));
    try {
      return await Fetch({...options, method: 'PATCH'});
    } finally {
      setState(prev => ({...prev, patching: false}));
    }
  }

  async function Delete<T>(options: FetchProps): Promise<T | ResponseFailedType> {
    setState(prev => ({...prev, deleting: true}));
    try {
      return await Fetch({...options, method: 'DELETE'});
    } finally {
      setState(prev => ({...prev, deleting: false}));
    }
  }

  React.useEffect(() => {
    OnInitialize && OnInitialize();
  }, []);

  return {...state, Get, Post, Put, Patch, Delete, GetCacheKey, InvalidateCache};
}

async function InvalidateCache(key: string) {
  await AsyncStorage.removeItem(key);
}

function GetAuthorizationString(token: string) {
  return 'Bearer ' + token;
}

function GetCacheKey({method, endpoint}: {method: string; endpoint: string}) {
  return `${method}:${Constant.API_URL + endpoint}`;
}

async function Fetch(options: FetchProps) {
  const headers = options.headers || new Headers();
  const authorization = await AsyncStorage.getItem(Constant.LOCAL_STORAGE.AUTH_TOKEN);
  const Language = await AsyncStorage.getItem(Constant.LOCAL_STORAGE.LANGUAGE);
  authorization && headers.append('Authorization', GetAuthorizationString(authorization));
  headers.append('x-api-key', Constant.API_KEY);
  headers.append('Accept', 'application/json');
  headers.append('Accept-Language', Language || 'ta');

  /**
   * Get Cached response
   */
  if (options.cacheConfig?.key) {
    const cachedResponse = await AsyncStorage.getItem(options.cacheConfig?.key);
    if (cachedResponse) {
      const cachedResult = JSON.parse(cachedResponse);
      if (cachedResult && cachedResult?.expiry && cachedResult.expiry < new Date().getTime()) {
        await AsyncStorage.removeItem(options.cacheConfig?.key);
      } else {
        return cachedResult.result;
      }
    }
  }

  /**
   * Get network request
   */
  const requestOptions = {
    method: options.method,
    headers: headers,
    body: options.body,
  };
  const response = await fetch(Constant.API_URL + options.endpoint, requestOptions);
  const result = await response.json();

  if (response.ok && options.cacheConfig?.enabled) {
    if (options.cacheConfig.key) {
      const cacheStore = {
        result: result,
        expiry: new Date().getTime() + options.cacheConfig.timeout,
      };
      await AsyncStorage.setItem(options.cacheConfig.key, JSON.stringify(cacheStore));
    }
  }

  return result;
}
