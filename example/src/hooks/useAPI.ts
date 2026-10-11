import {createAPI} from '@gnanamoorthy/react-native-utils';

const {useAPI, useQuery, invalidateQueries} = createAPI({
    baseURL: 'https://jsonplaceholder.typicode.com',
    staleTime: 60_000,
    onBeforeRequest: async props => {
        props.headers.set('Accept', 'application/json');
        return props;
    },
    onAfterResponse: async props => {
        console.log('[api]', props.response.status, props.response.url);
        return props.response;
    },
});

export {useQuery, invalidateQueries};
export default useAPI;
