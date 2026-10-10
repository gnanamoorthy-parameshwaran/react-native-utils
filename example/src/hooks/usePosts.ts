import {useQuery} from './useAPI';

export type Post = {userId: number; id: number; title: string; body: string};

const PAGE_SIZE = 10;

/** One page of posts, cached per page for `createAPI`'s `queryTtl`. */
export function usePostsQuery(page: number) {
    return useQuery({
        queryKey: ['posts', {page}],
        queryFn: ({request}) => request<Post[]>({endpoint: `/posts?_page=${page}&_limit=${PAGE_SIZE}`}),
    });
}
