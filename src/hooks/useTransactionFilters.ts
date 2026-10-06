// src/hooks/useTransactionFilters.ts
// Filtri, ordinamento e pagina della lista transazioni, conservati nella query string.
// Vivevano in useState: uscendo dalla pagina e tornando indietro si perdevano, e una vista
// filtrata non si poteva salvare nei preferiti né condividere.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import type { TransactionFilters } from '../services/api';

export interface TableFilters {
    type?: 'IN' | 'OUT';
    categoryId?: string;
    startDate?: Dayjs | null;
    endDate?: Dayjs | null;
    search?: string;
}

// Solo i campi che il backend sa ordinare: account e categoria erano offerti in UI ma
// ricadevano su `date` lato server, poi la Table riordinava i soli 20 elementi visibili.
export type TransactionSortField = 'date' | 'description' | 'amount';

export interface TransactionSort {
    field: TransactionSortField;
    order: 'ascend' | 'descend';
}

export const DEFAULT_TRANSACTION_SORT: TransactionSort = { field: 'date', order: 'descend' };

const SORT_FIELDS: readonly TransactionSortField[] = ['date', 'description', 'amount'];
const DATE_FORMAT = 'YYYY-MM-DD';

// Nomi brevi per la query string: /transactions?q=…&type=OUT&from=2026-01-01
const P = {
    search: 'q',
    type: 'type',
    category: 'category',
    from: 'from',
    to: 'to',
    sort: 'sort',
    dir: 'dir',
    page: 'page',
} as const;

const parseDate = (raw: string | null): Dayjs | undefined => {
    if (!raw) return undefined;
    const d = dayjs(raw, DATE_FORMAT, true);
    return d.isValid() ? d : undefined;
};

const validDateString = (raw: string | null): string | undefined =>
    parseDate(raw) ? raw ?? undefined : undefined;

export const useTransactionFilters = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const filters = useMemo<TableFilters>(() => {
        const type = searchParams.get(P.type);
        return {
            type: type === 'IN' || type === 'OUT' ? type : undefined,
            categoryId: searchParams.get(P.category) ?? undefined,
            startDate: parseDate(searchParams.get(P.from)),
            endDate: parseDate(searchParams.get(P.to)),
            search: searchParams.get(P.search) ?? undefined,
        };
    }, [searchParams]);

    const sort = useMemo<TransactionSort>(() => {
        const field = searchParams.get(P.sort) as TransactionSortField | null;
        return {
            field: field && SORT_FIELDS.includes(field) ? field : DEFAULT_TRANSACTION_SORT.field,
            order: searchParams.get(P.dir) === 'asc' ? 'ascend' : 'descend',
        };
    }, [searchParams]);

    const page = useMemo(() => {
        const n = Number(searchParams.get(P.page));
        return Number.isInteger(n) && n > 0 ? n : 1;
    }, [searchParams]);

    // Parametri per l'API costruiti dalle stringhe dell'URL, non dai Dayjs: l'oggetto
    // finisce nella query key, e così resta uguale finché l'URL non cambia.
    const apiFilters = useMemo<TransactionFilters>(() => ({
        type: filters.type,
        categoryId: filters.categoryId,
        startDate: validDateString(searchParams.get(P.from)),
        endDate: validDateString(searchParams.get(P.to)),
        search: filters.search?.trim() || undefined,
        sortBy: sort.field,
        sortDir: sort.order === 'ascend' ? 'ASC' : 'DESC',
    }), [searchParams, filters.type, filters.categoryId, filters.search, sort]);

    // `replace`: filtrare non deve riempire la cronologia, così "indietro" porta alla
    // pagina precedente e non al filtro precedente. Ogni cambio di filtro o ordinamento
    // riparte dalla prima pagina.
    const update = useCallback((patch: Record<string, string | undefined>, resetPage = true) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(patch).forEach(([key, value]) => {
                if (value) next.set(key, value);
                else next.delete(key);
            });
            if (resetPage) next.delete(P.page);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const filtersToParams = (f: TableFilters): Record<string, string | undefined> => ({
        [P.type]: f.type,
        [P.category]: f.categoryId,
        [P.from]: f.startDate?.format(DATE_FORMAT),
        [P.to]: f.endDate?.format(DATE_FORMAT),
    });

    const sortToParams = (s: TransactionSort): Record<string, string | undefined> => ({
        // I default restano fuori dall'URL.
        [P.sort]: s.field === DEFAULT_TRANSACTION_SORT.field ? undefined : s.field,
        [P.dir]: s.order === DEFAULT_TRANSACTION_SORT.order ? undefined : 'asc',
    });

    const setFilter = <K extends keyof Omit<TableFilters, 'search'>>(key: K, value: TableFilters[K]) =>
        update(filtersToParams({ ...filters, [key]: value }));

    const setSearch = (search: string | undefined) => update({ [P.search]: search || undefined });

    const setSort = (s: TransactionSort) => update(sortToParams(s));

    /** Filtri (esclusa la ricerca) e ordinamento insieme: il drawer mobile li applica in blocco. */
    const applyFiltersAndSort = (f: TableFilters, s: TransactionSort) =>
        update({ ...filtersToParams(f), ...sortToParams(s) });

    const setPage = (p: number) => update({ [P.page]: p > 1 ? String(p) : undefined }, false);

    const clearFilters = () => update({
        ...filtersToParams({}),
        [P.search]: undefined,
    });

    const hasActiveFilters = !!(filters.type || filters.categoryId || filters.startDate || filters.endDate || filters.search?.trim());

    return {
        filters,
        sort,
        page,
        apiFilters,
        hasActiveFilters,
        setFilter,
        setSearch,
        setSort,
        applyFiltersAndSort,
        setPage,
        clearFilters,
    };
};
