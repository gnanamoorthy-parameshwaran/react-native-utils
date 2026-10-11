import React from 'react';
import {ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';

import {invalidateQueries} from './hooks/useAPI';
import {usePostsInfiniteQuery, usePostsQuery, type Post} from './hooks/usePosts';

export default function App() {
    const [mode, setMode] = React.useState<'paged' | 'infinite'>('paged');

    return (
        <SafeAreaView style={styles.container}>
            <View>
                <Text style={styles.title}>React Native Utils</Text>
                <Text style={styles.subtitle}>useQuery caching demo</Text>
            </View>

            <View style={styles.row}>
                <Button title="Paged" disabled={mode === 'paged'} onPress={() => setMode('paged')} />
                <Button title="Infinite" disabled={mode === 'infinite'} onPress={() => setMode('infinite')} />
            </View>

            {mode === 'paged' ? <PagedPosts /> : <InfinitePosts />}

            <Button title="Invalidate posts" onPress={() => invalidateQueries(['posts'])} />
        </SafeAreaView>
    );
}

/**
 * The header and the list read the same page key. Revisiting a page within
 * the TTL renders from cache with no request in the network log.
 */
function PagedPosts() {
    const [page, setPage] = React.useState(1);
    const {data, error, isLoading, isFetching, isPlaceholderData} = usePostsQuery(page);

    return (
        <View style={styles.fill}>
            <PageSummary page={page} />
            <View style={styles.row}>
                <Button title="Previous" disabled={page === 1} onPress={() => setPage(p => p - 1)} />
                <Text>Page {page}</Text>
                <Button title="Next" disabled={isPlaceholderData || page === 10} onPress={() => setPage(p => p + 1)} />
                {isFetching && <ActivityIndicator />}
            </View>

            {isLoading && <ActivityIndicator />}
            {error ? <Text>{String(error)}</Text> : null}
            <FlatList
                style={[styles.fill, isPlaceholderData && styles.dimmed]}
                data={data}
                keyExtractor={item => String(item.id)}
                renderItem={({item}) => <PostRow post={item} />}
            />
        </View>
    );
}

/**
 * One cached list that grows as it scrolls. Pull to refresh (or invalidation)
 * reloads only the first page.
 */
function InfinitePosts() {
    const {data, error, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch} = usePostsInfiniteQuery();

    if (isLoading) return <ActivityIndicator />;

    return (
        <View style={styles.fill}>
            {error ? <Text>{String(error)}</Text> : null}
            <FlatList
                style={styles.fill}
                data={data?.pages.flat()}
                keyExtractor={item => String(item.id)}
                renderItem={({item}) => <PostRow post={item} />}
                onEndReached={() => fetchNextPage()}
                onEndReachedThreshold={0.5}
                refreshing={isFetching && !isFetchingNextPage}
                onRefresh={refetch}
                ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : !hasNextPage ? <Text>No more posts</Text> : null}
            />
        </View>
    );
}

function PageSummary({page}: {page: number}) {
    const {data} = usePostsQuery(page);
    return <Text>{data ? `${data.length} posts on this page` : '...'}</Text>;
}

const PostRow = React.memo(function PostRow({post}: {post: Post}) {
    return (
        <View style={styles.post}>
            <Text style={styles.postTitle}>
                #{post.id} {post.title}
            </Text>
        </View>
    );
});

function Button({title, onPress, disabled}: {title: string; onPress: () => void; disabled?: boolean}) {
    return (
        <Pressable style={[styles.button, disabled && styles.dimmed]} disabled={disabled} onPress={onPress}>
            <Text style={styles.tabText}>{title}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1, gap: 10, padding: 10, paddingTop: 30, paddingBottom: 50},
    fill: {flex: 1},
    title: {fontSize: 24, fontWeight: 'bold'},
    subtitle: {fontSize: 16},
    tabText: {color: 'white', textAlign: 'center'},
    row: {flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8},
    button: {backgroundColor: 'black', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8},
    dimmed: {opacity: 0.5},
    post: {padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'lightgray'},
    postTitle: {fontSize: 14},
});
