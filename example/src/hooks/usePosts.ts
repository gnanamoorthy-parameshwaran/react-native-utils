import {useInfiniteQuery, useQuery} from './useAPI';

export type Post = {userId: number; id: number; title: string; body: string};

const PAGE_SIZE = 10;

/** One page of posts, cached per page; the previous page stays visible while the next one loads. */
export function usePostsQuery(page: number) {
    return useQuery({
        queryKey: ['posts', {page}],
        queryFn: ({request}) => request<Post[]>({endpoint: `/posts?_page=${page}&_limit=${PAGE_SIZE}`}),
        keepPreviousData: true,
    });
}

/** Every post, loaded one page at a time as the list scrolls; a short page means the end was reached. */
export function usePostsInfiniteQuery() {
    return useInfiniteQuery({
        queryKey: ['posts', 'infinite'],
        queryFn: ({request, pageParam}) => request<Post[]>({endpoint: `/posts?_page=${pageParam}&_limit=${PAGE_SIZE}`}),
        initialPageParam: 1,
        getNextPageParam: (lastPage, _allPages, lastPageParam) => (lastPage.length === PAGE_SIZE ? lastPageParam + 1 : undefined),
    });
}
