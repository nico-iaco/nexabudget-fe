import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as api from '../services/api';
import { queryKeys } from '../queryKeys';
import { useDefaultCurrency } from './useDefaultCurrency';

/**
 * Portafoglio investimenti nella valuta di base dell'utente. Query condivisa fra la pagina
 * Investimenti e il dettaglio asset: stessa chiave, una sola richiesta. I prezzi arrivano
 * da provider esterni (Yahoo) che possono rispondere lentamente o con errori: il backend
 * li tiene in cache ~15 minuti e ogni scrittura la invalida (vedi invalidateInvestmentData).
 */
export const useInvestmentPortfolio = () => {
    const currency = useDefaultCurrency();
    return useQuery({
        queryKey: queryKeys.investmentPortfolio(currency),
        queryFn: () => api.getInvestmentPortfolio(currency).then(r => r.data),
    });
};

export const useInvestmentHistory = (months: number) => {
    const currency = useDefaultCurrency();
    return useQuery({
        queryKey: queryKeys.investmentHistory(months, currency),
        queryFn: () => api.getInvestmentHistory(months, currency).then(r => r.data),
        placeholderData: keepPreviousData,
    });
};

export const useInvestmentPerformance = (startDate: string, endDate: string) =>
    useQuery({
        queryKey: queryKeys.investmentPerformance(startDate, endDate),
        queryFn: () => api.getInvestmentPerformance(startDate, endDate).then(r => r.data),
        placeholderData: keepPreviousData,
    });

export const useNetWorth = () => {
    const currency = useDefaultCurrency();
    return useQuery({
        queryKey: queryKeys.netWorth(currency),
        queryFn: () => api.getNetWorth(currency).then(r => r.data),
    });
};

export const useNetWorthHistory = (months: number) => {
    const currency = useDefaultCurrency();
    return useQuery({
        queryKey: queryKeys.netWorthHistory(months, currency),
        queryFn: () => api.getNetWorthHistory(months, currency).then(r => r.data),
        placeholderData: keepPreviousData,
    });
};
