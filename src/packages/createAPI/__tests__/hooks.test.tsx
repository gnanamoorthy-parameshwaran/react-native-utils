import React from 'react';
import {AppState, Text} from 'react-native';
import {act, render, renderHook, waitFor} from '@testing-library/react-native';

import createAPI from '../client';
import {hashKey} from '../util';

import type {SubscribeToNetwork, UseFocusEffect} from '../types';

const flush = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

describe('useQuery', () => {
    it('fetches on mount and serves the cache within the stale time', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
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

    it('refetches once the stale time has passed', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test'});
        const queryFn = jest.fn(async () => 'value');

        const first = renderHook(() => useQuery({queryKey: ['k'], queryFn, staleTime: 20}));
        await waitFor(() => expect(first.result.current.data).toBe('value'));
        first.unmount();

        await act(() => new Promise<void>(resolve => setTimeout(resolve, 30)));
        renderHook(() => useQuery({queryKey: ['k'], queryFn, staleTime: 20}));
        await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });

    it('does not fetch while disabled, and fetches once enabled', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
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
        const {useQuery} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
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
        const {useQuery} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});

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
        const {useQuery} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
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
        const {useQuery, invalidateQueries} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
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
        const {useQuery, invalidateQueries} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
        const queryFn = jest.fn(async () => 'shared');

        const a = renderHook(() => useQuery({queryKey: ['posts', {page: 1}], queryFn}));
        const b = renderHook(() => useQuery({queryKey: ['posts', {page: 1}], queryFn}));
        await waitFor(() => expect(a.result.current.data).toBe('shared'));
        await waitFor(() => expect(b.result.current.data).toBe('shared'));
        expect(queryFn).toHaveBeenCalledTimes(1);

        await act(() => invalidateQueries(['posts']));
        expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it('drops expired entries from memory on the next write, and never stores results with no stale or cache time', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test'});
        const deleteSpy = jest.spyOn(Map.prototype, 'delete');
        const setSpy = jest.spyOn(Map.prototype, 'set');
        const cacheWrites = () =>
            setSpy.mock.calls.filter(([, value]) => typeof value === 'object' && value !== null && 'expiresAt' in value).map(([key]) => key);

        const old = renderHook(() => useQuery({queryKey: ['old'], queryFn: async () => 'old', staleTime: 10, cacheTime: 10}));
        await waitFor(() => expect(old.result.current.data).toBe('old'));
        old.unmount();
        expect(cacheWrites()).toContain(hashKey(['old']));

        await act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));
        deleteSpy.mockClear();
        const fresh = renderHook(() => useQuery({queryKey: ['fresh'], queryFn: async () => 'fresh', staleTime: 60_000}));
        await waitFor(() => expect(fresh.result.current.data).toBe('fresh'));
        expect(deleteSpy).toHaveBeenCalledWith(hashKey(['old']));

        const uncached = renderHook(() => useQuery({queryKey: ['uncached'], queryFn: async () => 'uncached', staleTime: 0, cacheTime: 0}));
        await waitFor(() => expect(uncached.result.current.data).toBe('uncached'));
        expect(cacheWrites()).not.toContain(hashKey(['uncached']));

        deleteSpy.mockRestore();
        setSpy.mockRestore();
    });

    it('keeps the same data reference when a refetch returns unchanged data', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
        const queryFn = jest.fn(async () => [{id: 1, title: 'a'}]);

        const {result} = renderHook(() => useQuery({queryKey: ['same'], queryFn}));
        await waitFor(() => expect(result.current.data).toBeDefined());
        const before = result.current.data;

        await act(() => result.current.refetch());
        expect(queryFn).toHaveBeenCalledTimes(2);
        expect(result.current.data).toBe(before);
    });

    it('re-renders only the memoized rows whose item changed', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
        type Item = {id: number; title: string};
        let response: Item[] = [
            {id: 1, title: 'a'},
            {id: 2, title: 'b'},
            {id: 3, title: 'c'},
        ];
        const rowRenders: Record<number, number> = {};

        const Row = React.memo(function Row({item}: {item: Item}) {
            rowRenders[item.id] = (rowRenders[item.id] ?? 0) + 1;
            return <Text>{item.title}</Text>;
        });
        let refetch: () => Promise<void> = async () => {};
        function List() {
            const query = useQuery({queryKey: ['rows'], queryFn: async () => JSON.parse(JSON.stringify(response)) as Item[]});
            refetch = query.refetch;
            return (
                <>
                    {query.data?.map(item => (
                        <Row key={item.id} item={item} />
                    ))}
                </>
            );
        }

        const screen = render(<List />);
        await waitFor(() => expect(screen.getByText('c')).toBeTruthy());

        response = [response[0]!, {id: 2, title: 'b (edited)'}, response[2]!];
        await act(() => refetch());

        expect(screen.getByText('b (edited)')).toBeTruthy();
        expect(rowRenders).toEqual({1: 1, 2: 2, 3: 1});
    });

    it('shows stale data instantly on remount and revalidates it in the background', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test'});
        let resolveNext: (value: string) => void = () => {};
        const queryFn = jest
            .fn()
            .mockResolvedValueOnce('v1')
            .mockImplementationOnce(() => new Promise<string>(resolve => (resolveNext = resolve)));

        const first = renderHook(() => useQuery<string>({queryKey: ['swr'], queryFn, staleTime: 10}));
        await waitFor(() => expect(first.result.current.data).toBe('v1'));
        first.unmount();

        await act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));
        const second = renderHook(() => useQuery<string>({queryKey: ['swr'], queryFn, staleTime: 10}));
        expect(second.result.current).toMatchObject({data: 'v1', isLoading: false, isFetching: true});

        await act(async () => resolveNext('v2'));
        expect(second.result.current).toMatchObject({data: 'v2', isFetching: false});
        expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it('revalidates on every mount by default (staleTime 0) while showing the cached data', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test'});
        const queryFn = jest.fn(async () => 'data');

        const first = renderHook(() => useQuery({queryKey: ['default'], queryFn}));
        await waitFor(() => expect(first.result.current.data).toBe('data'));
        first.unmount();

        const second = renderHook(() => useQuery({queryKey: ['default'], queryFn}));
        expect(second.result.current).toMatchObject({data: 'data', isLoading: false});
        await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(second.result.current.isFetching).toBe(false));
    });

    it('starts blank once the cache time has passed', async () => {
        const {useQuery} = createAPI({baseURL: 'https://example.test'});
        const queryFn = jest.fn(async () => 'data');

        const first = renderHook(() => useQuery({queryKey: ['gone'], queryFn, staleTime: 5, cacheTime: 10}));
        await waitFor(() => expect(first.result.current.data).toBe('data'));
        first.unmount();

        await act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));
        const second = renderHook(() => useQuery({queryKey: ['gone'], queryFn, staleTime: 5, cacheTime: 10}));
        expect(second.result.current).toMatchObject({data: undefined, isLoading: true});
        await waitFor(() => expect(second.result.current).toMatchObject({data: 'data', isLoading: false}));
    });

    it('keeps invalidated data for unmounted screens, showing it while they revalidate', async () => {
        const {useQuery, invalidateQueries} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
        const queryFn = jest.fn(async () => 'post');

        const hidden = renderHook(() => useQuery({queryKey: ['posts', {id: 2}], queryFn}));
        await waitFor(() => expect(hidden.result.current.data).toBe('post'));
        hidden.unmount();

        await act(() => invalidateQueries(['posts']));
        expect(queryFn).toHaveBeenCalledTimes(1);

        const again = renderHook(() => useQuery({queryKey: ['posts', {id: 2}], queryFn}));
        expect(again.result.current).toMatchObject({data: 'post', isLoading: false, isFetching: true});
        await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(again.result.current.isFetching).toBe(false));
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

        renderHook(() => useQuery({queryKey: ['focus'], queryFn, staleTime: 30}), onScreen(screen));
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
        const {useQuery, invalidateQueries} = createAPI({baseURL: 'https://example.test', staleTime: 60_000, useFocusEffect: useFakeFocusEffect});
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

describe('useQuery revalidation on app foreground and network reconnect', () => {
    type AppStateHandler = (state: string) => void;

    /** Captures the AppState listener the library attaches, so the test can drive state changes. */
    function mockAppState() {
        const handlers: AppStateHandler[] = [];
        const remove = jest.fn();
        Object.defineProperty(AppState, 'currentState', {value: 'active', configurable: true});
        jest.mocked(AppState.addEventListener).mockImplementation(((_type: string, handler: AppStateHandler) => {
            handlers.push(handler);
            return {remove};
        }) as unknown as typeof AppState.addEventListener);
        const change = (state: string) => act(async () => handlers.forEach(handler => handler(state)));
        return {change, remove, handlers};
    }

    /** A stand-in for a connectivity library: the test decides when the network goes up or down. */
    function mockNetwork() {
        const listeners = new Set<(isConnected: boolean) => void>();
        const subscribeToNetwork: SubscribeToNetwork = listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        };
        const setConnected = (connected: boolean) => act(async () => listeners.forEach(listener => listener(connected)));
        return {subscribeToNetwork, setConnected, listeners};
    }

    afterEach(() => {
        jest.mocked(AppState.addEventListener).mockReset();
    });

    it('revalidates stale queries on screen when the app returns to the foreground, leaving fresh ones alone', async () => {
        const appState = mockAppState();
        const {useQuery} = createAPI({baseURL: 'https://example.test', revalidateOnAppForeground: true});
        const staleFn = jest.fn(async () => 'stale');
        const freshFn = jest.fn(async () => 'fresh');

        const stale = renderHook(() => useQuery({queryKey: ['stale'], queryFn: staleFn, staleTime: 0}));
        const fresh = renderHook(() => useQuery({queryKey: ['fresh'], queryFn: freshFn, staleTime: 60_000}));
        await waitFor(() => expect(stale.result.current.data).toBe('stale'));
        await waitFor(() => expect(fresh.result.current.data).toBe('fresh'));

        await appState.change('background');
        expect(staleFn).toHaveBeenCalledTimes(1);

        await appState.change('active');
        await waitFor(() => expect(staleFn).toHaveBeenCalledTimes(2));
        expect(freshFn).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(stale.result.current.isFetching).toBe(false));
    });

    it('does not listen to AppState unless opted in', async () => {
        mockAppState();
        const {useQuery} = createAPI({baseURL: 'https://example.test'});

        const query = renderHook(() => useQuery({queryKey: ['plain'], queryFn: async () => 'data'}));
        await waitFor(() => expect(query.result.current.data).toBe('data'));
        expect(AppState.addEventListener).not.toHaveBeenCalled();
    });

    it('retries a query that failed while offline once the network comes back', async () => {
        const network = mockNetwork();
        const {useQuery} = createAPI({baseURL: 'https://example.test', subscribeToNetwork: network.subscribeToNetwork});
        const queryFn = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('online');

        const query = renderHook(() => useQuery<string>({queryKey: ['net'], queryFn}));
        await waitFor(() => expect(query.result.current.error).toEqual(new Error('offline')));

        await network.setConnected(false);
        await network.setConnected(true);
        await waitFor(() => expect(query.result.current).toMatchObject({data: 'online', error: null}));
        expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it('ignores network events that are not an offline to online transition', async () => {
        const network = mockNetwork();
        const {useQuery} = createAPI({baseURL: 'https://example.test', subscribeToNetwork: network.subscribeToNetwork});
        const queryFn = jest.fn(async () => 'data');

        const query = renderHook(() => useQuery({queryKey: ['steady'], queryFn}));
        await waitFor(() => expect(query.result.current.data).toBe('data'));

        await network.setConnected(true);
        await network.setConnected(true);
        expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('attaches listeners with the first mounted query and removes them with the last', async () => {
        const appState = mockAppState();
        const network = mockNetwork();
        const {useQuery} = createAPI({
            baseURL: 'https://example.test',
            revalidateOnAppForeground: true,
            subscribeToNetwork: network.subscribeToNetwork,
        });
        expect(appState.handlers).toHaveLength(0);
        expect(network.listeners.size).toBe(0);

        const first = renderHook(() => useQuery({queryKey: ['a'], queryFn: async () => 'a'}));
        const second = renderHook(() => useQuery({queryKey: ['b'], queryFn: async () => 'b'}));
        await waitFor(() => expect(second.result.current.data).toBe('b'));
        expect(appState.handlers).toHaveLength(1);
        expect(network.listeners.size).toBe(1);

        first.unmount();
        expect(appState.remove).not.toHaveBeenCalled();
        second.unmount();
        expect(appState.remove).toHaveBeenCalledTimes(1);
        expect(network.listeners.size).toBe(0);
    });
});

describe('useInfiniteQuery', () => {
    type Page = {items: number[]; next?: number};

    /** A fake three-page server: page n holds [n*10, n*10+1]; the last page has no `next`. */
    function pagedServer() {
        const queryFn = jest.fn(async ({pageParam}: {pageParam: number}): Promise<Page> => ({
            items: [pageParam * 10, pageParam * 10 + 1],
            next: pageParam < 3 ? pageParam + 1 : undefined,
        }));
        const options = {queryFn, initialPageParam: 1, getNextPageParam: (lastPage: Page) => lastPage.next};
        return {queryFn, options};
    }

    const items = (data?: {pages: Page[]}) => data?.pages.flatMap(page => page.items);

    it('loads the first page, then appends pages until there is no next page', async () => {
        const {useInfiniteQuery} = createAPI({baseURL: 'https://example.test'});
        const {queryFn, options} = pagedServer();

        const {result} = renderHook(() => useInfiniteQuery({queryKey: ['feed'], ...options}));
        expect(result.current.isLoading).toBe(true);
        await waitFor(() => expect(items(result.current.data)).toEqual([10, 11]));
        expect(result.current.hasNextPage).toBe(true);

        await act(() => result.current.fetchNextPage());
        await act(() => result.current.fetchNextPage());
        expect(items(result.current.data)).toEqual([10, 11, 20, 21, 30, 31]);
        expect(result.current.data?.pageParams).toEqual([1, 2, 3]);
        expect(result.current.hasNextPage).toBe(false);

        await act(() => result.current.fetchNextPage());
        expect(queryFn).toHaveBeenCalledTimes(3);
    });

    it('flags isFetchingNextPage during a next-page fetch and ignores fetchNextPage while one is running', async () => {
        const {useInfiniteQuery} = createAPI({baseURL: 'https://example.test'});
        let resolvePage: (page: Page) => void = () => {};
        const queryFn = jest
            .fn()
            .mockResolvedValueOnce({items: [10], next: 2})
            .mockImplementationOnce(() => new Promise<Page>(resolve => (resolvePage = resolve)));

        const {result} = renderHook(() =>
            useInfiniteQuery<Page, number>({queryKey: ['slow-feed'], queryFn, initialPageParam: 1, getNextPageParam: last => last.next}),
        );
        await waitFor(() => expect(result.current.data).toBeDefined());
        expect(result.current.isFetchingNextPage).toBe(false);

        act(() => {
            result.current.fetchNextPage();
            result.current.fetchNextPage();
        });
        expect(result.current).toMatchObject({isFetchingNextPage: true, isFetching: true, isLoading: false});
        expect(queryFn).toHaveBeenCalledTimes(2);

        await act(async () => resolvePage({items: [20]}));
        expect(result.current).toMatchObject({isFetchingNextPage: false, isFetching: false, hasNextPage: false});
        expect(items(result.current.data)).toEqual([10, 20]);
    });

    it('reloads only the first page on refetch and on invalidation', async () => {
        const {useInfiniteQuery, invalidateQueries} = createAPI({baseURL: 'https://example.test', staleTime: 60_000});
        const {queryFn, options} = pagedServer();

        const {result} = renderHook(() => useInfiniteQuery({queryKey: ['posts', 'infinite'], ...options}));
        await waitFor(() => expect(result.current.data).toBeDefined());
        await act(() => result.current.fetchNextPage());
        expect(result.current.data?.pages).toHaveLength(2);

        await act(() => result.current.refetch());
        expect(result.current.data?.pages).toHaveLength(1);
        expect(queryFn).toHaveBeenLastCalledWith(expect.objectContaining({pageParam: 1}));

        await act(() => result.current.fetchNextPage());
        await act(() => invalidateQueries(['posts']));
        expect(result.current.data?.pageParams).toEqual([1]);
        expect(queryFn).toHaveBeenCalledTimes(5);
    });

    it('shows the cached pages instantly on remount and revalidates them in the background', async () => {
        const {useInfiniteQuery} = createAPI({baseURL: 'https://example.test'});
        const {queryFn, options} = pagedServer();

        const first = renderHook(() => useInfiniteQuery({queryKey: ['cached-feed'], ...options}));
        await waitFor(() => expect(first.result.current.data).toBeDefined());
        await act(() => first.result.current.fetchNextPage());
        first.unmount();

        const second = renderHook(() => useInfiniteQuery({queryKey: ['cached-feed'], ...options}));
        expect(second.result.current).toMatchObject({isLoading: false, isFetching: true});
        expect(items(second.result.current.data)).toEqual([10, 11, 20, 21]);
        await waitFor(() => expect(second.result.current.isFetching).toBe(false));
        expect(items(second.result.current.data)).toEqual([10, 11]);
        expect(queryFn).toHaveBeenCalledTimes(3);
    });

    it('makes one request for two components on the same list', async () => {
        const {useInfiniteQuery} = createAPI({baseURL: 'https://example.test'});
        const {queryFn, options} = pagedServer();

        const a = renderHook(() => useInfiniteQuery({queryKey: ['shared-feed'], ...options}));
        const b = renderHook(() => useInfiniteQuery({queryKey: ['shared-feed'], ...options}));
        await waitFor(() => expect(a.result.current.data).toBeDefined());
        await waitFor(() => expect(b.result.current.data).toBeDefined());
        expect(queryFn).toHaveBeenCalledTimes(1);
    });
});
