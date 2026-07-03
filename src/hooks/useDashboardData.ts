import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import * as api from '../services/api';
import { SERIES_INCOME, SERIES_EXPENSE } from '../theme/tokens';
import type {
    CategoryBreakdownItem,
    MonthComparisonResponse,
    MonthlyProjectionResponse,
    MonthlyTrendItem,
    MonthlyTrendResponse,
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

export interface TrendPoint {
    month: string;
    income: number;
    expense: number;
    net: number;
}

interface DashboardQueryResult {
    comp: MonthComparisonResponse | null;
    trend: MonthlyTrendResponse;
    incomeBreakdown: CategoryBreakdownItem[];
    expenseBreakdown: CategoryBreakdownItem[];
    totalIncome: number;
    totalExpenses: number;
    proj: MonthlyProjectionResponse | null;
    crypto: PortfolioValueResponse | null;
    budgets: MonthlySummaryResponse[];
    partialErrors: string[];
}

const EMPTY_TREND: MonthlyTrendResponse = { currency: 'EUR', items: [] };

export const useDashboardData = (transactionRefreshKey: number, trendMonths = 12) => {
    const { t } = useTranslation();
    const [dateRange, setDateRange] = useState<DateRange>([dayjs().startOf('month'), dayjs().endOf('month')]);

    const startKey = dateRange?.[0]?.format('YYYY-MM-DD') ?? null;
    const endKey = dateRange?.[1]?.format('YYYY-MM-DD') ?? null;

    const { data, isPending, refetch } = useQuery<DashboardQueryResult>({
        queryKey: ['dashboardData', transactionRefreshKey, startKey, endKey, trendMonths],
        queryFn: async () => {
            const now = dayjs();
            const startDate = startKey ?? now.startOf('year').format('YYYY-MM-DD');
            const endDate = endKey ?? now.endOf('year').format('YYYY-MM-DD');

            const partialErrors: string[] = [];
            const safe = <T,>(p: Promise<{ data: T }>, fallback: T, label: string): Promise<T> =>
                p.then(r => r.data ?? fallback).catch(err => {
                    console.error(`[dashboard] failed to load ${label}`, err);
                    partialErrors.push(label);
                    return fallback;
                });

            const EMPTY_BREAKDOWN = { startDate, endDate, currency: 'EUR', totalIncome: 0, totalExpense: 0, grandTotal: 0, categories: [] };

            const [comp, trend, breakdown, proj, crypto, budgets] = await Promise.all([
                safe(api.getMonthComparison(now.year(), now.month() + 1), null, 'monthComparison'),
                safe(api.getMonthlyTrend(trendMonths), EMPTY_TREND, 'monthlyTrend'),
                safe(api.getCategoryBreakdown(startDate, endDate), EMPTY_BREAKDOWN, 'categoryBreakdown'),
                safe(api.getMonthlyProjection(), null, 'monthlyProjection'),
                safe(api.getPortfolioValue('EUR'), null, 'portfolioValue'),
                safe(api.getBudgetMonthlySummary(now.format('YYYY-MM-DD')), [], 'budgetSummary'),
            ]);

            const categories = Array.isArray(breakdown?.categories) ? breakdown.categories : [];

            return {
                comp,
                trend: trend ?? EMPTY_TREND,
                incomeBreakdown: categories.filter(c => c.inferredType === 'IN'),
                expenseBreakdown: categories.filter(c => c.inferredType === 'OUT'),
                totalIncome: breakdown?.totalIncome ?? 0,
                totalExpenses: breakdown?.totalExpense ?? 0,
                proj,
                crypto,
                budgets: Array.isArray(budgets) ? budgets : [],
                partialErrors,
            };
        },
        placeholderData: keepPreviousData,
    });

    const lastReportedErrorsRef = useRef<string[] | null>(null);
    useEffect(() => {
        const partialErrors = data?.partialErrors;
        if (partialErrors && partialErrors.length > 0 && lastReportedErrorsRef.current !== partialErrors) {
            lastReportedErrorsRef.current = partialErrors;
            message.error(t('dashboard.loadError'));
        }
    }, [data?.partialErrors, t]);

    const monthComparison = data?.comp ?? null;
    const trendResponse = data?.trend ?? EMPTY_TREND;
    const monthlyTrendItems: MonthlyTrendItem[] = Array.isArray(trendResponse.items) ? trendResponse.items : [];
    const trendCurrency = trendResponse.currency ?? 'EUR';
    const uncategorizedLabel = t('reports.uncategorized');
    const relabelUncategorized = (items: CategoryBreakdownItem[]): CategoryBreakdownItem[] =>
        items.map(c => (c.categoryId === null ? { ...c, categoryName: uncategorizedLabel } : c));
    const incomeBreakdown = useMemo(
        () => relabelUncategorized(data?.incomeBreakdown ?? []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [data?.incomeBreakdown, uncategorizedLabel]
    );
    const expenseBreakdown = useMemo(
        () => relabelUncategorized(data?.expenseBreakdown ?? []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [data?.expenseBreakdown, uncategorizedLabel]
    );
    const portfolioValue = data?.crypto ?? null;
    const projection = data?.proj ?? null;
    const budgetSummary = useMemo(
        () =>
            [...(data?.budgets ?? [])].sort((a, b) =>
                a.categoryName.localeCompare(b.categoryName)
            ),
        [data?.budgets]
    );

    const totalIncome = data?.totalIncome ?? 0;
    const totalExpenses = data?.totalExpenses ?? 0;
    const netBalance = totalIncome - totalExpenses;

    const expensesByCategory = useMemo((): PieData[] =>
        expenseBreakdown.map(i => ({ type: i.categoryName, value: Math.abs(i.net) })),
        [expenseBreakdown]
    );

    const incomeByCategory = useMemo((): PieData[] =>
        incomeBreakdown.map(i => ({ type: i.categoryName, value: i.net })),
        [incomeBreakdown]
    );

    const monthlyTrend = useMemo((): BarData[] => {
        const result: BarData[] = [];
        monthlyTrendItems.forEach(item => {
            const label = dayjs(`${item.year}-${String(item.month).padStart(2, '0')}-01`).format('MMM YY');
            // Usiamo le costanti SERIES_* come chiave stabile (non la stringa tradotta)
            // così il color-mapping nei grafici non dipende dalla lingua attiva.
            result.push({ month: label, type: SERIES_INCOME, value: item.income });
            result.push({ month: label, type: SERIES_EXPENSE, value: item.expense });
        });
        return result;
    }, [monthlyTrendItems]);

    const trendPoints = useMemo((): TrendPoint[] =>
        monthlyTrendItems.map(item => ({
            month: dayjs(`${item.year}-${String(item.month).padStart(2, '0')}-01`).format('MMM YY'),
            income: item.income,
            expense: item.expense,
            net: item.net,
        })),
        [monthlyTrendItems]
    );

    const incomeSparkline = useMemo(
        () => monthlyTrendItems.slice(-6).map(i => i.income),
        [monthlyTrendItems]
    );
    const expenseSparkline = useMemo(
        () => monthlyTrendItems.slice(-6).map(i => i.expense),
        [monthlyTrendItems]
    );
    const netSparkline = useMemo(
        () => monthlyTrendItems.slice(-6).map(i => i.net),
        [monthlyTrendItems]
    );

    const hasData = totalIncome > 0 || totalExpenses > 0 || monthlyTrendItems.length > 0;

    // Use server-provided change when available (avoids div-by-zero ambiguity client-side).
    const expenseComparison = useMemo(() => {
        if (!monthComparison) return null;
        const prev = monthComparison.previousMonth?.expense ?? 0;
        const current = monthComparison.currentMonth?.expense ?? 0;
        if (prev === 0) return { percentageChange: current > 0 ? 100 : 0 };
        return { percentageChange: ((current - prev) / prev) * 100 };
    }, [monthComparison]);

    return {
        loading: isPending,
        refetch,
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
        trendPoints,
        incomeSparkline,
        expenseSparkline,
        netSparkline,
        expenseComparison,
        portfolioValue,
        projection,
        monthComparison,
        budgetSummary,
        hasData,
        trendCurrency,
    };
};
