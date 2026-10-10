/**
 * Caching a generated client method on a screen. The generator emits plain API
 * clients; the screen chooses the query key and TTL.
 */
import React from 'react';
import {Text} from 'react-native';

import {invalidateQueries, useQuery} from './create-api-setup';

/**
 * Stands in for a generated hook such as
 * `src/generated/clients/V1/BusinessUnit/useInvoice.ts`.
 */
type GetInvoicesResponse = {data: {id: number; total: number}[]; meta: {current_page: number; last_page: number}};
declare function useInvoice(props: {businessUnit: number}): {
    getInvoices: (props?: {params?: {page?: number}}) => Promise<GetInvoicesResponse>;
};

export function InvoicesScreen({businessUnit}: {businessUnit: number}) {
    const [page] = React.useState(1);
    const {getInvoices} = useInvoice({businessUnit});

    const {data} = useQuery({
        queryKey: ['invoices', {businessUnit, page}],
        queryFn: () => getInvoices({params: {page}}),
        ttl: 300_000,
        keepPreviousData: true,
    });

    return <Text>{data ? `${data.data.length} invoices, page ${data.meta.current_page} of ${data.meta.last_page}` : 'Loading…'}</Text>;
}

/** After creating or editing an invoice: clears every cached page for every business unit. */
export const refreshInvoices = () => invalidateQueries(['invoices']);
