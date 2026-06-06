// src/hooks/useAccounts.ts
// Hook React Query per account e saldo totale.
// Sostituisce il data-fetching manuale in Layout.tsx (fetchAccounts).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Account } from '../types/api';

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
    const fetchAccounts = async (_background?: boolean): Promise<Account[]> => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
        await queryClient.invalidateQueries({ queryKey: queryKeys.totalBalance });
        return queryClient.getQueryData<Account[]>(queryKeys.accounts) ?? [];
    };

    return {
        accounts: accountsQuery.data ?? [],
        totalBalance: balanceQuery.data ?? 0,
        isLoading: accountsQuery.isPending,
        isFetching: accountsQuery.isFetching,
        isError: accountsQuery.isError,
        refetch: accountsQuery.refetch,
        fetchAccounts,
    };
};
