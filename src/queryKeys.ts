// src/queryKeys.ts
// Fonte unica di verità per tutte le query key React Query.
// Cambiare un key qui si propaga a tutti i useQuery e invalidateQueries.
import type { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
    // Account e saldo
    accounts: ['accounts'] as const,
    totalBalance: ['accounts', 'total-balance', 'preferred'] as const,

    // Categorie
    categories: ['categories'] as const,

    // Transazioni paginate. `queryKeys.transactions()` senza argomenti è il prefisso che
    // invalida tutte le liste (paginata desktop e infinita mobile, ogni conto e filtro).
    transactions: (scope?: {
        accountId?: string;
        page?: number;
        size?: number;
        filters?: unknown;
        mode?: 'paged' | 'infinite';
    }) => ['transactions', scope ?? {}] as const,

    // Prefissi dei dati derivati: invalidano in un colpo tutte le varianti (range, mesi).
    dashboardAll: ['dashboardData'] as const,
    reportsAll: ['reports'] as const,

    // Dashboard (mantiene la stessa struttura usata da useDashboardData)
    // `currency`: il portafoglio crypto è chiesto nella valuta di base dell'utente.
    dashboard: (
        refreshKey: number,
        startKey: string | null,
        endKey: string | null,
        trendMonths: number,
        currency: string
    ) => ['dashboardData', refreshKey, startKey, endKey, trendMonths, currency] as const,

    // Confronto mese su mese. Chiave condivisa fra useDashboardData (mese corrente) e
    // DashboardPage (mese scelto dall'utente): quando coincidono — cioè nel caso di
    // default — React Query deduplica le due richieste in una sola.
    monthComparison: (year: number, month: number) =>
        ['reports', 'month-comparison', year, month] as const,

    // Report trend saldo (mantiene la stessa struttura usata da BalanceTrendSection)
    balanceTrend: (startDate: string | null, endDate: string | null) =>
        ['reports', 'balance-trend', startDate, endDate] as const,

    // Patrimonio netto: sotto il prefisso 'reports' così `invalidateDerivedData` lo rinfresca
    // dopo ogni mutazione su conti, transazioni, crypto e valuta (cambia la liquidità/crypto).
    netWorth: (currency: string) => ['reports', 'net-worth', currency] as const,
    netWorthHistory: (months: number, currency: string) =>
        ['reports', 'net-worth-history', months, currency] as const,

    // Investimenti. `investmentsAll` è il prefisso per invalidare tutto in un colpo.
    investmentsAll: ['investments'] as const,
    investmentPortfolio: (currency: string) => ['investments', 'portfolio', currency] as const,
    investmentHistory: (months: number, currency: string) =>
        ['investments', 'history', months, currency] as const,
    investmentPerformance: (startDate: string, endDate: string) =>
        ['investments', 'performance', startDate, endDate] as const,
    investmentAsset: (id: string) => ['investments', 'asset', id] as const,
    investmentOperations: (assetId: string) => ['investments', 'operations', assetId] as const,
} as const;

/**
 * Invalida i dati derivati dai movimenti (totali, trend, breakdown, budget del mese,
 * confronto mensile, trend saldo). Va chiamata dopo ogni mutazione che cambia
 * transazioni, conti, budget, holding o valuta: altrimenti dashboard e report restano
 * vecchi fino allo scadere della loro staleTime.
 */
export const invalidateDerivedData = (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
};

/**
 * Da chiamare dopo ogni scrittura su asset, operazioni o prezzo manuale: il backend
 * invalida la sua cache (~15 min) e qui si rifanno portafoglio, storico, performance e
 * anche il patrimonio netto (che include gli investimenti).
 */
export const invalidateInvestmentData = (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.investmentsAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
};
