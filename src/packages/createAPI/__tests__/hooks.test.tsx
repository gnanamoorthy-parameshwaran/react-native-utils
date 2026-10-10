import React from 'react';
import {act, renderHook, waitFor} from '@testing-library/react-native';

import createAPI from '../client';

import type {UseFocusEffect} from '../types';

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

    it('keeps the previous page on screen while the next page loads with keepPreviousData', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', queryTtl: 60_000});
        const queryFn = jest.fn(async ({page}: {page: number}) => `page ${page}`);

        const {result, rerender} = renderHook(
            ({page}: {page: number}) => useQuery({queryKey: ['list', {page}], queryFn: () => queryFn({page}), keepPreviousData: true}),
            {initialProps: {page: 1}},
        );
        await waitFor(() => expect(result.current.data).toBe('page 1'));

        rerender({page: 2});
        expect(result.current).toMatchObject({data: 'page 1', isPlaceholderData: true, isLoading: false, isFetching: true});
        await waitFor(() => expect(result.current).toMatchObject({data: 'page 2', isPlaceholderData: false, isFetching: false}));

        rerender({page: 1});
        expect(result.current).toMatchObject({data: 'page 1', isPlaceholderData: false, isFetching: false});
    });

    it('goes blank on a new key without keepPreviousData', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', queryTtl: 60_000});

        const {result, rerender} = renderHook(
            ({page}: {page: number}) => useQuery({queryKey: ['list', {page}], queryFn: async () => `page ${page}`}),
            {
                initialProps: {page: 1},
            },
        );
        await waitFor(() => expect(result.current.data).toBe('page 1'));

        rerender({page: 2});
        expect(result.current).toMatchObject({data: undefined, isLoading: true, isPlaceholderData: false});
        await waitFor(() => expect(result.current.data).toBe('page 2'));
    });

    it('reports a refetch over existing data as isFetching, not isLoading', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', queryTtl: 60_000});
        let resolve: (value: string) => void = () => {};
        const queryFn = jest
            .fn()
            .mockResolvedValueOnce('first')
            .mockImplementationOnce(() => new Promise<string>(r => (resolve = r)));

        const {result} = renderHook(() => useQuery<string>({queryKey: ['refetch'], queryFn}));
        await waitFor(() => expect(result.current.data).toBe('first'));

        act(() => {
            result.current.refetch();
        });
        expect(result.current).toMatchObject({data: 'first', isLoading: false, isFetching: true});

        await act(async () => resolve('second'));
        expect(result.current).toMatchObject({data: 'second', isFetching: false});
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

describe('useQuery with useFocusEffect', () => {
    it("accepts React Navigation's useFocusEffect without the library importing it", () => {
        type Fits = typeof import('@react-navigation/native').useFocusEffect extends UseFocusEffect ? true : false;
        const fits: Fits = true;
        expect(fits).toBe(true);
    });

    type Effect = Parameters<UseFocusEffect>[0];

    /**
     * Mimics a React Navigation screen: focus effects run while it is focused,
     * and their cleanups run on blur.
     */
    function createScreen(focused: boolean) {
        const effects = new Map<Effect, (() => void) | undefined>();
        const run = (effect: Effect) => effects.set(effect, effect() ?? undefined);
        const cleanup = (effect: Effect) => effects.get(effect)?.();

        return {
            register(effect: Effect) {
                effects.set(effect, undefined);
                if (focused) run(effect);
                return () => {
                    if (focused) cleanup(effect);
                    effects.delete(effect);
                };
            },
            focus: () =>
                act(async () => {
                    focused = true;
                    effects.forEach((_, effect) => run(effect));
                }),
            blur: () =>
                act(async () => {
                    focused = false;
                    effects.forEach((_, effect) => cleanup(effect));
                }),
        };
    }

    type Screen = ReturnType<typeof createScreen>;
    const ScreenContext = React.createContext<Screen>(createScreen(true));
    const useFakeFocusEffect: UseFocusEffect = effect => {
        const screen = React.useContext(ScreenContext);
        React.useEffect(() => screen.register(effect), [screen, effect]);
    };
    const onScreen = (screen: Screen) => ({
        wrapper: ({children}: {children: React.ReactNode}) => <ScreenContext.Provider value={screen}>{children}</ScreenContext.Provider>,
    });

    it('fetches on focus only once the cache has expired', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', useFocusEffect: useFakeFocusEffect});
        const queryFn = jest.fn(async () => 'data');
        const screen = createScreen(true);

        renderHook(() => useQuery({queryKey: ['focus'], queryFn, ttl: 30}), onScreen(screen));
        await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

        await screen.blur();
        await screen.focus();
        expect(queryFn).toHaveBeenCalledTimes(1);

        await act(() => new Promise<void>(resolve => setTimeout(resolve, 40)));
        await screen.blur();
        await screen.focus();
        await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });

    it('does not fetch a disabled query on focus', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', useFocusEffect: useFakeFocusEffect});
        const queryFn = jest.fn(async () => 'data');
        const screen = createScreen(true);

        renderHook(() => useQuery({queryKey: ['off'], queryFn, enabled: false}), onScreen(screen));
        await screen.blur();
        await screen.focus();
        expect(queryFn).not.toHaveBeenCalled();
    });

    it('refetches the focused screen on invalidation, and a background screen only when it regains focus', async () => {
        const {useQuery, invalidateQueries} = createAPI({baseURL: 'https://example.test', queryTtl: 60_000, useFocusEffect: useFakeFocusEffect});
        const listFn = jest.fn(async () => 'list');
        const detailFn = jest.fn(async () => 'detail');
        const listScreen = createScreen(true);
        const detailScreen = createScreen(true);

        const list = renderHook(() => useQuery({queryKey: ['posts'], queryFn: listFn}), onScreen(listScreen));
        await waitFor(() => expect(list.result.current.data).toBe('list'));

        await listScreen.blur();
        renderHook(() => useQuery({queryKey: ['posts', {id: 1}], queryFn: detailFn}), onScreen(detailScreen));
        await waitFor(() => expect(detailFn).toHaveBeenCalledTimes(1));

        await act(() => invalidateQueries(['posts']));
        expect(detailFn).toHaveBeenCalledTimes(2);
        expect(listFn).toHaveBeenCalledTimes(1);

        await detailScreen.blur();
        await listScreen.focus();
        await waitFor(() => expect(listFn).toHaveBeenCalledTimes(2));
    });
});
