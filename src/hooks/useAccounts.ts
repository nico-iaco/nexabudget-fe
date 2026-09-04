// src/hooks/useAccounts.ts
// Hook React Query per account e saldo totale.
// Sostituisce il data-fetching manuale in Layout.tsx (fetchAccounts).
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Account } from '../types/api';

// Riferimento stabile: vedi nota in useCategories.
const EMPTY_ACCOUNTS: Account[] = [];

/**
 * Restituisce la lista account e il saldo totale preferito dell'utente.
 * Abilitato solo quando l'utente è autenticato.
 */
export const useAccounts = () => {
    const { auth } = useAuth();
    const queryClient = useQueryClient();

    const accountsQuery = useQuery<Account[]>({
        queryKey: queryKeys.accounts,
        queryFn: () => api.getAccounts().then(r => r.data),
        enabled: !!auth,
        staleTime: 2 * 60 * 1000,
    });

    const balanceQuery = useQuery<number>({
        queryKey: queryKeys.totalBalance,
        queryFn: () => api.getTotalPreferredBalance().then(r => r.data),
        enabled: !!auth,
        staleTime: 2 * 60 * 1000,
    });

    /**
     * Forza un refetch degli account e del saldo.
     * Compatibile con la firma di `fetchAccounts(background?)` usata nei consumer dell'Outlet.
     */
    // Le due invalidazioni vanno in parallelo: `invalidateQueries` risolve a refetch
    // completato, quindi in serie erano due round-trip in fila invece che simultanei —
    // su un percorso invocato a ogni salvataggio, import, sync e tick di polling.
    const fetchAccounts = useCallback(async (_background?: boolean): Promise<Account[]> => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
            queryClient.invalidateQueries({ queryKey: queryKeys.totalBalance }),
        ]);
        return queryClient.getQueryData<Account[]>(queryKeys.accounts) ?? EMPTY_ACCOUNTS;
    }, [queryClient]);

    return {
        accounts: accountsQuery.data ?? EMPTY_ACCOUNTS,
        totalBalance: balanceQuery.data ?? 0,
        isLoading: accountsQuery.isPending,
        isFetching: accountsQuery.isFetching,
        isError: accountsQuery.isError,
        refetch: accountsQuery.refetch,
        fetchAccounts,
    };
};
