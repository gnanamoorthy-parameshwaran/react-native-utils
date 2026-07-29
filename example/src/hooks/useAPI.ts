import {createAPI} from '@gnanamoorthy/react-native-utils';

export default createAPI({
    baseURL: 'http://192.168.1.3:81/api',
    onBeforeRequest: async props => {
        props.headers.set('Accept', 'application/json');
        return props;
    },
    onAfterResponse: async props => {
        return props.response;
    },
});
