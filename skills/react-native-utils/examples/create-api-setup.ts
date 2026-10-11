/**
 * The app's single API instance, conventionally `src/hooks/useAPI.ts`.
 * The generator's `useAPIImportPath` points here and imports the default export.
 * Wrap the app root in `<APIContextWrapper emitEvent={...}>` so `emitEvent` reaches a handler.
 */
import {createAPI} from '@gnanamoorthy/react-native-utils';
import {useFocusEffect} from '@react-navigation/native';

/** App-specific helpers, assumed to exist in the project. */
declare function getToken(): Promise<string>;
declare function refreshToken(): Promise<void>;
declare function reportError(error: unknown, url: string): void;

/** Stands in for `import NetInfo from '@react-native-community/netinfo'`. */
declare const NetInfo: {addEventListener: (listener: (state: {isConnected: boolean | null}) => void) => () => void};

const {useAPI, useQuery, useInfiniteQuery, invalidateQueries} = createAPI({
    baseURL: 'https://api.example.com',
    throwException: true,
    maxRetries: 1,
    staleTime: 60_000,
    useFocusEffect,
    revalidateOnAppForeground: true,
    subscribeToNetwork: listener => NetInfo.addEventListener(state => listener(!!state.isConnected)),
    onBeforeRequest: async ({headers}) => {
        headers.set('Accept', 'application/json');
        headers.set('Authorization', `Bearer ${await getToken()}`);
        return {headers};
    },
    onAfterResponse: async ({response, retry, emitEvent}) => {
        if (response.status !== 401) return response;

        try {
            await refreshToken();
            return retry();
        } catch {
            emitEvent('session-expired');
            return response;
        }
    },
    onError: ({error, url}) => reportError(error, url),
});

export {useQuery, useInfiniteQuery, invalidateQueries};
export default useAPI;
