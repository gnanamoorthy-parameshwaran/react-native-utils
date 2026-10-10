import {act, renderHook, waitFor} from '@testing-library/react-native';

import createAPI from '../client';

const flush = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

describe('useQuery', () => {
    it('fetches on mount and serves the cache within the ttl', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', queryTtl: 60_000});
        const queryFn = jest.fn(async () => 'hello');

        const first = renderHook(() => useQuery({queryKey: ['greeting'], queryFn}));
        expect(first.result.current.isLoading).toBe(true);
        await waitFor(() => expect(first.result.current).toMatchObject({data: 'hello', isLoading: false}));
        first.unmount();

        const second = renderHook(() => useQuery({queryKey: ['greeting'], queryFn}));
        expect(second.result.current).toMatchObject({data: 'hello', isLoading: false});
        await flush();
        expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('refetches once the ttl has passed', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test'});
        const queryFn = jest.fn(async () => 'value');

        const first = renderHook(() => useQuery({queryKey: ['k'], queryFn, ttl: 20}));
        await waitFor(() => expect(first.result.current.data).toBe('value'));
        first.unmount();

        await act(() => new Promise<void>(resolve => setTimeout(resolve, 30)));
        renderHook(() => useQuery({queryKey: ['k'], queryFn, ttl: 20}));
        await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });

    it('does not fetch while disabled, and fetches once enabled', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', queryTtl: 60_000});
        const queryFn = jest.fn(async () => 1);

        const {result, rerender} = renderHook(({enabled}: {enabled: boolean}) => useQuery({queryKey: ['lazy'], queryFn, enabled}), {
            initialProps: {enabled: false},
        });
        await flush();
        expect(queryFn).not.toHaveBeenCalled();
        expect(result.current.isLoading).toBe(false);

        rerender({enabled: true});
        await waitFor(() => expect(result.current.data).toBe(1));
    });

    it('invalidates by key prefix: refetches mounted queries and clears unmounted ones', async () => {
        const {useQuery, invalidateQueries} = createAPI({baseURL: 'https://example.test', queryTtl: 60_000});
        const postFn = jest.fn(async () => 'post');
        const userFn = jest.fn(async () => 'user');

        const hidden = renderHook(() => useQuery({queryKey: ['posts', {id: 2}], queryFn: postFn}));
        await waitFor(() => expect(hidden.result.current.data).toBe('post'));
        hidden.unmount();

        const visible = renderHook(() => useQuery({queryKey: ['posts', {id: 1}], queryFn: postFn}));
        const users = renderHook(() => useQuery({queryKey: ['users'], queryFn: userFn}));
        await waitFor(() => expect(visible.result.current.data).toBe('post'));
        await waitFor(() => expect(users.result.current.data).toBe('user'));
        expect(postFn).toHaveBeenCalledTimes(2);

        await act(() => invalidateQueries(['posts']));
        expect(postFn).toHaveBeenCalledTimes(3);
        expect(userFn).toHaveBeenCalledTimes(1);

        renderHook(() => useQuery({queryKey: ['posts', {id: 2}], queryFn: postFn}));
        await waitFor(() => expect(postFn).toHaveBeenCalledTimes(4));
    });

    it('makes one request for two components on the same key, on mount and on invalidation', async () => {
        const {useQuery, invalidateQueries} = createAPI({baseURL: 'https://example.test', queryTtl: 60_000});
        const queryFn = jest.fn(async () => 'shared');

        const a = renderHook(() => useQuery({queryKey: ['posts', {page: 1}], queryFn}));
        const b = renderHook(() => useQuery({queryKey: ['posts', {page: 1}], queryFn}));
        await waitFor(() => expect(a.result.current.data).toBe('shared'));
        await waitFor(() => expect(b.result.current.data).toBe('shared'));
        expect(queryFn).toHaveBeenCalledTimes(1);

        await act(() => invalidateQueries(['posts']));
        expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it('calls onSuccess and onError', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test'});
        const onSuccess = jest.fn();
        const onError = jest.fn();

        renderHook(() => useQuery({queryKey: ['ok'], queryFn: async () => 'ok', onSuccess}));
        const failing = renderHook(() => useQuery({queryKey: ['bad'], queryFn: () => Promise.reject(new Error('boom')), onError}));

        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('ok'));
        await waitFor(() => expect(onError).toHaveBeenCalledWith(new Error('boom')));
        expect(failing.result.current).toMatchObject({error: new Error('boom'), isLoading: false});
    });

    it('passes a request that goes through the createAPI pipeline', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test'});
        const fetchMock = jest.fn(async () => new Response(JSON.stringify({id: 7}), {status: 200}));
        global.fetch = fetchMock as unknown as typeof fetch;

        const {result} = renderHook(() => useQuery({queryKey: ['post', 7], queryFn: ({request}) => request<{id: number}>({endpoint: '/posts/7'})}));

        await waitFor(() => expect(result.current.data).toEqual({id: 7}));
        expect(fetchMock).toHaveBeenCalledWith('https://example.test/posts/7', expect.objectContaining({method: 'GET'}));
    });
});
