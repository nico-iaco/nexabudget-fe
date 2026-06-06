// src/queryKeys.ts
// Fonte unica di verità per tutte le query key React Query.
// Cambiare un key qui si propaga a tutti i useQuery e invalidateQueries.

export const queryKeys = {
    // Account e saldo
    accounts: ['accounts'] as const,
    totalBalance: ['accounts', 'total-balance', 'preferred'] as const,

    // Categorie
    categories: ['categories'] as const,

    // Transazioni paginate
    transactions: (scope?: {
        accountId?: string;
        page?: number;
        size?: number;
        filters?: unknown;
        sort?: unknown;
    }) => ['transactions', scope ?? {}] as const,

    // Dashboard (mantiene la stessa struttura usata da useDashboardData)
    dashboard: (
        refreshKey: number,
        startKey: string | null,
        endKey: string | null,
        trendMonths: number
    ) => ['dashboardData', refreshKey, startKey, endKey, trendMonths] as const,

    // Report trend saldo (mantiene la stessa struttura usata da BalanceTrendSection)
    balanceTrend: (startDate: string | null, endDate: string | null) =>
        ['reports', 'balance-trend', startDate, endDate] as const,
} as const;
