/**
 * A page-numbered list with useQuery: each page caches separately, the previous
 * page stays visible while the next loads, and a mutation invalidates every page.
 */
import React from 'react';
import {ActivityIndicator, Button, FlatList, Text, View} from 'react-native';

import useAPI, {invalidateQueries, useQuery} from './create-api-setup';

type Post = {id: number; title: string};

export function PostsScreen() {
    const [page, setPage] = React.useState(1);

    const {data, error, isLoading, isFetching, isPlaceholderData} = useQuery({
        queryKey: ['posts', {page}],
        queryFn: ({request}) => request<Post[]>({endpoint: `/posts?page=${page}`}),
        staleTime: 60_000,
        keepPreviousData: true,
    });

    if (isLoading) return <ActivityIndicator />;

    return (
        <View>
            {error ? <Text>{String(error)}</Text> : null}
            <FlatList data={data} keyExtractor={post => String(post.id)} renderItem={({item}) => <Text>{item.title}</Text>} />
            <Button title="Previous" disabled={page === 1} onPress={() => setPage(p => p - 1)} />
            <Button title="Next" disabled={isPlaceholderData} onPress={() => setPage(p => p + 1)} />
            {isFetching ? <ActivityIndicator /> : null}
        </View>
    );
}

/** A mutation uses useAPI's request, then clears every cached page; the visible one refetches. */
export function useDeletePost() {
    const {loading, request} = useAPI();

    const deletePost = async (id: number) => {
        await request({method: 'DELETE', endpoint: `/posts/${id}`});
        await invalidateQueries(['posts']);
    };

    return {deleting: loading, deletePost};
}
