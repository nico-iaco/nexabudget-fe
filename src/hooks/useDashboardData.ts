import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import * as api from '../services/api';
import type {
    CategoryBreakdownItem,
    MonthComparisonResponse,
    MonthlyProjectionResponse,
    MonthlyTrendItem,
    MonthlySummaryResponse,
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

export const useDashboardData = (transactionRefreshKey: number, trendMonths = 12) => {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>([dayjs().startOf('month'), dayjs().endOf('month')]);

    const [monthComparison, setMonthComparison] = useState<MonthComparisonResponse | null>(null);
    const [monthlyTrendItems, setMonthlyTrendItems] = useState<MonthlyTrendItem[]>([]);
    const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdownItem[]>([]);
    const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryBreakdownItem[]>([]);
    const [projection, setProjection] = useState<MonthlyProjectionResponse | null>(null);
    const [portfolioValue, setPortfolioValue] = useState<PortfolioValueResponse | null>(null);
    const [budgetSummary, setBudgetSummary] = useState<MonthlySummaryResponse[]>([]);

    useEffect(() => {
        setLoading(true);

        const now = dayjs();
        const startDate = dateRange?.[0]?.format('YYYY-MM-DD') ?? now.startOf('year').format('YYYY-MM-DD');
        const endDate = dateRange?.[1]?.format('YYYY-MM-DD') ?? now.endOf('year').format('YYYY-MM-DD');

        const safe = <T,>(p: Promise<{ data: T }>, fallback: T): Promise<T> =>
            p.then(r => r.data ?? fallback).catch(() => fallback);

        Promise.all([
            safe(api.getMonthComparison(now.year(), now.month() + 1), null),
            safe(api.getMonthlyTrend(trendMonths), []),
            safe(api.getCategoryBreakdown(startDate, endDate), { startDate, endDate, grandTotal: 0, categories: [] }),
            safe(api.getMonthlyProjection(), null),
            safe(api.getPortfolioValue('EUR'), null),
            safe(api.getBudgetMonthlySummary(now.format('YYYY-MM-DD')), []),
        ]).then(([comp, trend, breakdown, proj, crypto, budgets]) => {
            setMonthComparison(comp);
            setMonthlyTrendItems(trend ?? []);
            setIncomeBreakdown((breakdown?.categories ?? []).filter(c => c.inferredType === 'IN'));
            setExpenseBreakdown((breakdown?.categories ?? []).filter(c => c.inferredType === 'OUT'));
            setProjection(proj);
            if (crypto) setPortfolioValue(crypto);
            setBudgetSummary(budgets ?? []);
        }).finally(() => setLoading(false));
    }, [transactionRefreshKey, dateRange, trendMonths]);

    // Totali calcolati dal monthly trend filtrato per dateRange (include anche transazioni senza categoria)
    const totalIncome = useMemo(() => {
        const start = dateRange?.[0];
        const end = dateRange?.[1];
        return monthlyTrendItems
            .filter(item => {
                const itemDate = dayjs(`${item.year}-${String(item.month).padStart(2, '0')}-01`);
                return (!start || !itemDate.isBefore(start, 'month')) &&
                       (!end || !itemDate.isAfter(end, 'month'));
            })
            .reduce((sum, item) => sum + item.income, 0);
    }, [monthlyTrendItems, dateRange]);

    const totalExpenses = useMemo(() => {
        const start = dateRange?.[0];
        const end = dateRange?.[1];
        return monthlyTrendItems
            .filter(item => {
                const itemDate = dayjs(`${item.year}-${String(item.month).padStart(2, '0')}-01`);
                return (!start || !itemDate.isBefore(start, 'month')) &&
                       (!end || !itemDate.isAfter(end, 'month'));
            })
            .reduce((sum, item) => sum + item.expense, 0);
    }, [monthlyTrendItems, dateRange]);

    const netBalance = totalIncome - totalExpenses;

    const expensesByCategory = useMemo((): PieData[] =>
        (expenseBreakdown ?? []).map(i => ({ type: i.categoryName, value: Math.abs(i.net) })),
        [expenseBreakdown]
    );

    const incomeByCategory = useMemo((): PieData[] =>
        (incomeBreakdown ?? []).map(i => ({ type: i.categoryName, value: i.net })),
        [incomeBreakdown]
    );

    const monthlyTrend = useMemo((): BarData[] => {
        const result: BarData[] = [];
        monthlyTrendItems.forEach(item => {
            const label = dayjs(`${item.year}-${String(item.month).padStart(2, '0')}-01`).format('MMM YY');
            result.push({ month: label, type: 'Entrate', value: item.income });
            result.push({ month: label, type: 'Uscite', value: item.expense });
        });
        return result;
    }, [monthlyTrendItems]);

    const hasData = totalIncome > 0 || totalExpenses > 0 || monthlyTrendItems.length > 0;

    const expenseComparison = useMemo(() => {
        if (!monthComparison) return null;
        const prev = monthComparison.previousMonth?.expense ?? 0;
        const current = monthComparison.currentMonth?.expense ?? 0;
        if (prev === 0) return { percentageChange: current > 0 ? 100 : 0 };
        const percentageChange = ((current - prev) / prev) * 100;
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
        incomeBreakdown,
        expenseBreakdown,
        monthlyTrend,
        expenseComparison,
        portfolioValue,
        projection,
        monthComparison,
        budgetSummary,
        hasData,
    };
};
