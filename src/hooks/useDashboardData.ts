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
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>([dayjs().startOf('year'), dayjs().endOf('year')]);
    const [portfolioValue, setPortfolioValue] = useState<PortfolioValueResponse | null>(null);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.getTransactionsByUserId(),
            api.getPortfolioValue('EUR').catch(err => {
                console.warn('Crypto fetch failed', err);
                return { data: null };
            })
        ])
            .then(([transactionsResp, cryptoResp]) => {
                setTransactions(transactionsResp.data);
                if (cryptoResp?.data) {
                    setPortfolioValue(cryptoResp.data);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [transactionRefreshKey]);

    const filteredTransactions = useMemo(() => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) {
            return transactions;
        }
        const [startDate, endDate] = dateRange;
        return transactions.filter(t => {
            const transactionDate = dayjs(t.date);
            return transactionDate.isAfter(startDate) && transactionDate.isBefore(endDate);
        });
    }, [transactions, dateRange]);

    const { totalIncome, totalExpenses, netBalance } = useMemo(() => {
        return filteredTransactions.reduce((acc, t) => {
            if (t.type === 'IN') {
                acc.totalIncome += t.amount;
            } else {
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
            if (t.type === 'IN') {
                trend[month].income += t.amount;
            } else {
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

        const [start, end] = dateRange;
        const duration = end.diff(start, 'day');
        const prevStart = start.subtract(duration + 1, 'day');
        const prevEnd = end.subtract(duration + 1, 'day');

        const currentExpenses = filteredTransactions
            .filter(t => t.type === 'OUT')
            .reduce((sum, t) => sum + t.amount, 0);

        const previousExpenses = transactions
            .filter(t => {
                const tDate = dayjs(t.date);
                return t.type === 'OUT' && tDate.isAfter(prevStart) && tDate.isBefore(prevEnd);
            })
            .reduce((sum, t) => sum + t.amount, 0);

        if (previousExpenses === 0) {
            return { percentageChange: currentExpenses > 0 ? 100 : 0, period: 'periodo precedente' };
        }

        const percentageChange = ((currentExpenses - previousExpenses) / previousExpenses) * 100;
        return { percentageChange, period: 'periodo precedente' };
    }, [transactions, dateRange, filteredTransactions]);

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
