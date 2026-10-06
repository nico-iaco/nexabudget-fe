// src/hooks/useTransactionsList.ts
// Lista transazioni su React Query. Desktop: una pagina alla volta (Table con paginazione).
// Mobile: lista infinita con "carica altri". Entrambe vivono sotto il prefisso
// `queryKeys.transactions()`, quindi le invalidazioni fatte altrove (es. useAccountSync a
// fine sincronizzazione) aggiornano la lista: con il vecchio fetch imperativo andavano perse.
import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as api from '../services/api';
import type { TransactionFilters } from '../services/api';
import { queryKeys } from '../queryKeys';

export const TRANSACTIONS_PAGE_SIZE = 20;

const fetchTransactionsPage = (accountId: string | undefined, page: number, filters: TransactionFilters) =>
    (accountId
        ? api.getTransactionsByAccountIdPaged(accountId, page, TRANSACTIONS_PAGE_SIZE, filters)
        : api.getTransactionsPaged(page, TRANSACTIONS_PAGE_SIZE, filters)
    ).then(r => r.data);

interface UseTransactionsListOptions {
    accountId?: string;
    filters: TransactionFilters;
    /** Pagina 1-based, usata solo in modalità paginata. */
    page: number;
    /** true su mobile: lista infinita invece della paginazione numerata. */
    infinite: boolean;
}

export const useTransactionsList = ({ accountId, filters, page, infinite }: UseTransactionsListOptions) => {
    // Le due query sono sempre dichiarate (regole degli hook), ma solo una è abilitata.
    const paged = useQuery({
        queryKey: queryKeys.transactions({ accountId, filters, page, size: TRANSACTIONS_PAGE_SIZE, mode: 'paged' }),
        queryFn: () => fetchTransactionsPage(accountId, page - 1, filters),
        enabled: !infinite,
        // Cambiando pagina o filtro restano a schermo i dati precedenti (con lo stato di
        // caricamento) invece di svuotare la lista.
        placeholderData: keepPreviousData,
    });

    const list = useInfiniteQuery({
        queryKey: queryKeys.transactions({ accountId, filters, size: TRANSACTIONS_PAGE_SIZE, mode: 'infinite' }),
        queryFn: ({ pageParam }) => fetchTransactionsPage(accountId, pageParam, filters),
        initialPageParam: 0,
        getNextPageParam: last =>
            last.page.number + 1 < last.page.totalPages ? last.page.number + 1 : undefined,
        enabled: infinite,
        placeholderData: keepPreviousData,
    });

    const transactions = useMemo(
        () => (infinite
            ? list.data?.pages.flatMap(p => p.content) ?? []
            : paged.data?.content ?? []),
        [infinite, list.data, paged.data]
    );

    const active = infinite ? list : paged;
    const firstPage = infinite ? list.data?.pages[0] : paged.data;

    return {
        transactions,
        total: firstPage?.page.totalElements ?? 0,
        /** true quando c'è qualcosa da mostrare, anche se di un caricamento precedente. */
        hasData: active.data !== undefined,
        /** Primo caricamento, oppure cambio di filtri/pagina con i dati precedenti ancora a schermo. */
        isLoading: active.isPending || active.isPlaceholderData,
        isError: active.isError,
        refetch: () => { void active.refetch(); },
        hasNextPage: infinite && !!list.hasNextPage,
        fetchNextPage: () => { void list.fetchNextPage(); },
        isFetchingNextPage: list.isFetchingNextPage,
    };
};
