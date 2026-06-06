// src/hooks/useCategories.ts
// Hook React Query per le categorie dell'utente.
// Sostituisce il data-fetching manuale in Layout.tsx (fetchCategories).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import * as api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Category } from '../types/api';

/**
 * Restituisce la lista categorie dell'utente.
 * Normalizza sempre a un array (gestisce risposta non-array del backend).
 * Abilitato solo quando l'utente è autenticato.
 */
export const useCategories = () => {
    const { auth } = useAuth();
    const queryClient = useQueryClient();

    const { data, isPending, isError, refetch } = useQuery<Category[]>({
        queryKey: queryKeys.categories,
        queryFn: () =>
            api.getCategories().then(r =>
                Array.isArray(r.data) ? r.data : []
            ),
        enabled: !!auth,
        staleTime: 5 * 60 * 1000,
    });

    /**
     * Forza un refetch delle categorie.
     * Compatibile con la firma di `fetchCategories()` usata nei consumer dell'Outlet.
     */
    const fetchCategories = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    };

    return {
        categories: data ?? [],
        isLoading: isPending,
        isError,
        refetch,
        fetchCategories,
    };
};
