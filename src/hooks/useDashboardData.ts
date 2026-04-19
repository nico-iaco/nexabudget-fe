import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import * as api from '../services/api';
import type {
    CategoryBreakdownItem,
    MonthComparisonResponse,
    MonthlyProjectionResponse,
    MonthlyTrendItem,
    PortfolioValueResponse
} from '../types/api';

export type DateRange = [Dayjs | null, Dayjs | null] | null;

export interface BarData {
    month: string;
    type: string;
    value: number;
}

export interface PieData {
    type: string;
    value: number;
}

export interface LineData {
    label: string;
    value: number;
    monthlyNet: number;
}

export const useDashboardData = (transactionRefreshKey: number) => {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>([dayjs().startOf('year'), dayjs().endOf('year')]);

    const [monthComparison, setMonthComparison] = useState<MonthComparisonResponse | null>(null);
    const [monthlyTrendItems, setMonthlyTrendItems] = useState<MonthlyTrendItem[]>([]);
    const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdownItem[]>([]);
    const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryBreakdownItem[]>([]);
    const [projection, setProjection] = useState<MonthlyProjectionResponse | null>(null);
    const [portfolioValue, setPortfolioValue] = useState<PortfolioValueResponse | null>(null);

    useEffect(() => {
        setLoading(true);

        const now = dayjs();
        const startDate = dateRange?.[0]?.format('YYYY-MM-DD') ?? now.startOf('year').format('YYYY-MM-DD');
        const endDate = dateRange?.[1]?.format('YYYY-MM-DD') ?? now.endOf('year').format('YYYY-MM-DD');

        Promise.all([
            api.getMonthComparison(now.year(), now.month() + 1),
            api.getMonthlyTrend(12),
            api.getCategoryBreakdown('IN', startDate, endDate),
            api.getCategoryBreakdown('OUT', startDate, endDate),
            api.getMonthlyProjection(),
            api.getPortfolioValue('EUR').catch(() => ({ data: null })),
        ]).then(([compResp, trendResp, incResp, expResp, projResp, cryptoResp]) => {
            setMonthComparison(compResp.data);
            setMonthlyTrendItems(trendResp.data);
            setIncomeBreakdown(incResp.data.items);
            setExpenseBreakdown(expResp.data.items);
            setProjection(projResp.data);
            if (cryptoResp.data) setPortfolioValue(cryptoResp.data);
        }).catch(console.error).finally(() => setLoading(false));
    }, [transactionRefreshKey, dateRange]);

    const totalIncome = monthComparison?.currentIncome ?? 0;
    const totalExpenses = monthComparison?.currentExpense ?? 0;
    const netBalance = totalIncome - totalExpenses;

    const expensesByCategory = useMemo((): PieData[] =>
        expenseBreakdown.map(i => ({ type: i.categoryName, value: i.total })),
        [expenseBreakdown]
    );

    const incomeByCategory = useMemo((): PieData[] =>
        incomeBreakdown.map(i => ({ type: i.categoryName, value: i.total })),
        [incomeBreakdown]
    );

    const monthlyTrend = useMemo((): BarData[] => {
        const result: BarData[] = [];
        monthlyTrendItems.forEach(item => {
            const label = dayjs(`${item.year}-${String(item.month).padStart(2, '0')}-01`).format('MMM YY');
            result.push({ month: label, type: 'Entrate', value: item.totalIncome });
            result.push({ month: label, type: 'Uscite', value: item.totalExpense });
        });
        return result;
    }, [monthlyTrendItems]);

    const hasData = totalIncome > 0 || totalExpenses > 0 || monthlyTrendItems.length > 0;

    const expenseComparison = useMemo(() => {
        if (!monthComparison) return null;
        const prev = monthComparison.previousExpense;
        if (prev === 0) return { percentageChange: monthComparison.currentExpense > 0 ? 100 : 0 };
        const percentageChange = ((monthComparison.currentExpense - prev) / prev) * 100;
        return { percentageChange };
    }, [monthComparison]);

    return {
        loading,
        dateRange,
        setDateRange,
        totalIncome,
        totalExpenses,
        netBalance,
        expensesByCategory,
        incomeByCategory,
        monthlyTrend,
        expenseComparison,
        portfolioValue,
        projection,
        monthComparison,
        hasData,
    };
};
