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

const {useAPI, useQuery, invalidateQueries} = createAPI({
    baseURL: 'https://api.example.com',
    throwException: true,
    maxRetries: 1,
    queryTtl: 60_000,
    useFocusEffect,
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

export {useQuery, invalidateQueries};
export default useAPI;
