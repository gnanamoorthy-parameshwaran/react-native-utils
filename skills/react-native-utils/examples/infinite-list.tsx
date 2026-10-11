/**
 * An append-as-you-scroll list with useInfiniteQuery. The whole list is one
 * cache entry; pull to refresh (or invalidation) reloads only the first page.
 */
import {ActivityIndicator, FlatList, Text} from 'react-native';

import {invalidateQueries, useInfiniteQuery} from './create-api-setup';

/** A Laravel length-aware paginator response. */
type PostsPage = {data: {id: number; title: string}[]; meta: {current_page: number; last_page: number}};

export function PostsFeed() {
    const {data, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch} = useInfiniteQuery({
        queryKey: ['posts', 'infinite'],
        queryFn: ({request, pageParam}) => request<PostsPage>({endpoint: `/posts?page=${pageParam}`}),
        initialPageParam: 1,
        getNextPageParam: lastPage => (lastPage.meta.current_page < lastPage.meta.last_page ? lastPage.meta.current_page + 1 : undefined),
        staleTime: 60_000,
    });

    if (isLoading) return <ActivityIndicator />;

    return (
        <FlatList
            data={data?.pages.flatMap(page => page.data)}
            keyExtractor={post => String(post.id)}
            renderItem={({item}) => <Text>{item.title}</Text>}
            onEndReached={() => fetchNextPage()}
            onEndReachedThreshold={0.5}
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={refetch}
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : !hasNextPage ? <Text>No more posts</Text> : null}
        />
    );
}

/** After a mutation: `['posts']` also matches `['posts', 'infinite']`, so the feed reloads its first page. */
export const refreshPosts = () => invalidateQueries(['posts']);
