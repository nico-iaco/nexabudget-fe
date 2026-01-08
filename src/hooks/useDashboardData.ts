import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import * as api from '../services/api';
import type { Transaction, PortfolioValueResponse } from '../types/api';

export type DateRange = [Dayjs | null, Dayjs | null] | null;

export interface BarData {
    month: string;
    type: string;
    value: number;
}

export interface LineData {
    label: string;
    value: number;
    monthlyNet: number;
}

export const useDashboardData = (transactionRefreshKey: number) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>([dayjs().startOf('year'), dayjs().endOf('year')]);
    const [portfolioValue, setPortfolioValue] = useState<PortfolioValueResponse | null>(null);

    useEffect(() => {
        setLoading(true);

        const fetchTransactions = async () => {
            try {
                if (dateRange && dateRange[0] && dateRange[1]) {
                    const [startDate, endDate] = dateRange;
                    const formattedStart = startDate.format('YYYY-MM-DD');
                    const formattedEnd = endDate.format('YYYY-MM-DD');

                    // Calculate previous period
                    // prevEnd = start - 1 day
                    const prevEnd = startDate.subtract(1, 'day');
                    const duration = endDate.diff(startDate, 'day');
                    // prevStart = prevEnd - duration
                    const prevStart = prevEnd.subtract(duration, 'day');

                    const formattedPrevStart = prevStart.format('YYYY-MM-DD');
                    const formattedPrevEnd = prevEnd.format('YYYY-MM-DD');

                    const [currentResp, prevResp, cryptoResp] = await Promise.all([
                        api.getTransactionsBetweenDates(formattedStart, formattedEnd),
                        api.getTransactionsBetweenDates(formattedPrevStart, formattedPrevEnd),
                        api.getPortfolioValue('EUR').catch(err => {
                            console.warn('Crypto fetch failed', err);
                            return { data: null };
                        })
                    ]);

                    setTransactions(currentResp.data);
                    setPreviousTransactions(prevResp.data);
                    if (cryptoResp?.data) {
                        setPortfolioValue(cryptoResp.data);
                    }
                } else {
                    // Fallback to fetching all if no date range (or handle differently)
                    // For now, let's default to fetching all transactions if no range is selected, 
                    // though the UI initializes with a range.
                    const [transactionsResp, cryptoResp] = await Promise.all([
                        api.getTransactionsByUserId(),
                        api.getPortfolioValue('EUR').catch(err => {
                            console.warn('Crypto fetch failed', err);
                            return { data: null };
                        })
                    ]);
                    setTransactions(transactionsResp.data);
                    setPreviousTransactions([]); // No previous period comparison possible without range
                    if (cryptoResp?.data) {
                        setPortfolioValue(cryptoResp.data);
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [transactionRefreshKey, dateRange]);

    // Since transactions are already filtered by the API, filteredTransactions is just transactions
    const filteredTransactions = transactions;

    const { totalIncome, totalExpenses, netBalance } = useMemo(() => {
        return filteredTransactions.reduce((acc, t) => {
            if (t.type === 'IN' && t.transferId === null) {
                acc.totalIncome += t.amount;
            } else if (t.type === 'OUT' && t.transferId === null) {
                acc.totalExpenses += t.amount;
            }
            acc.netBalance = acc.totalIncome - acc.totalExpenses;
            return acc;
        }, { totalIncome: 0, totalExpenses: 0, netBalance: 0 });
    }, [filteredTransactions]);

    const expensesByCategory = useMemo(() => {
        const categoryMap: { [key: string]: number } = {};
        filteredTransactions
            .filter(t => t.type === 'OUT' && t.categoryName)
            .forEach(t => {
                const category = t.categoryName!;
                if (!categoryMap[category]) {
                    categoryMap[category] = 0;
                }
                categoryMap[category] += t.amount;
            });

        return Object.entries(categoryMap)
            .map(([type, value]) => ({ type, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredTransactions]);

    const incomeByCategory = useMemo(() => {
        const categoryMap: { [key: string]: number } = {};
        filteredTransactions
            .filter(t => t.type === 'IN' && t.categoryName)
            .forEach(t => {
                const category = t.categoryName!;
                if (!categoryMap[category]) {
                    categoryMap[category] = 0;
                }
                categoryMap[category] += t.amount;
            });

        return Object.entries(categoryMap)
            .map(([type, value]) => ({ type, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredTransactions]);

    const monthlyTrend = useMemo((): BarData[] => {
        const trend: { [month: string]: { income: number; expense: number } } = {};

        filteredTransactions.forEach(t => {
            const month = dayjs(t.date).format('YYYY-MM');
            if (!trend[month]) {
                trend[month] = { income: 0, expense: 0 };
            }
            if (t.type === 'IN' && t.transferId === null) {
                trend[month].income += t.amount;
            } else if (t.type === 'OUT' && t.transferId === null) {
                trend[month].expense += t.amount;
            }
        });

        const result: BarData[] = [];
        Object.keys(trend).forEach(month => {
            result.push({ month: dayjs(month).format('MMM YY'), type: 'Entrate', value: trend[month].income });
            result.push({ month: dayjs(month).format('MMM YY'), type: 'Uscite', value: trend[month].expense });
        });

        return result.sort((a, b) => dayjs(a.month, 'MMM YY').valueOf() - dayjs(b.month, 'MMM YY').valueOf());
    }, [filteredTransactions]);

    const monthlyNetBalance = useMemo((): LineData[] => {
        const balanceByMonth: { [key: string]: number } = {};

        filteredTransactions.forEach(t => {
            const month = dayjs(t.date).format('YYYY-MM');
            if (!balanceByMonth[month]) {
                balanceByMonth[month] = 0;
            }
            balanceByMonth[month] += t.type === 'IN' ? t.amount : -t.amount;
        });

        const sortedMonths = Object.entries(balanceByMonth)
            .map(([month, value]) => ({ month, value }))
            .sort((a, b) => a.month.localeCompare(b.month));

        let cumulativeBalance = 0;
        return sortedMonths.map(item => {
            cumulativeBalance += item.value;
            return {
                label: dayjs(item.month).endOf('month').format('YYYY-MM-DD'),
                value: cumulativeBalance,
                monthlyNet: item.value,
            };
        });
    }, [filteredTransactions]);

    const expenseComparison = useMemo(() => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) return null;

        const currentExpenses = filteredTransactions
            .filter(t => t.type === 'OUT')
            .reduce((sum, t) => sum + t.amount, 0);

        const previousExpenses = previousTransactions
            .filter(t => t.type === 'OUT')
            .reduce((sum, t) => sum + t.amount, 0);

        if (previousExpenses === 0) {
            return { percentageChange: currentExpenses > 0 ? 100 : 0, period: 'periodo precedente' };
        }

        const percentageChange = ((currentExpenses - previousExpenses) / previousExpenses) * 100;
        return { percentageChange, period: 'periodo precedente' };
    }, [filteredTransactions, previousTransactions, dateRange]);

    return {
        transactions,
        loading,
        dateRange,
        setDateRange,
        filteredTransactions,
        totalIncome,
        totalExpenses,
        netBalance,
        expensesByCategory,
        incomeByCategory,
        monthlyTrend,
        monthlyNetBalance,
        expenseComparison,
        portfolioValue
    };
};
