// src/pages/dashboard/DashboardPage.tsx
import { useState, lazy, Suspense } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Button, Card, Col, DatePicker, Empty, Flex, Progress, Row,
    Select, Skeleton, Statistic, Table, Tabs, Typography
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useDashboardData } from '../../hooks/useDashboardData';
import { usePageTitle } from '../../hooks/usePageTitle';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

// On mobile we load a lightweight chart bundle (no G2Plot); on desktop the full one.
// Evaluated once at module load — device type is fixed for a PWA session.
const _isMobileAtLoad = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
const _chartsModule = () =>
    _isMobileAtLoad
        ? import('../../components/dashboard/DashboardChartsMobile')
        : import('../../components/dashboard/DashboardCharts');
const GenericPieChart = lazy(() => _chartsModule().then(m => ({ default: m.GenericPieChart })));
const TrendDualChart = lazy(() => _chartsModule().then(m => ({ default: m.TrendDualChart })));
const ComparisonBars = lazy(() => _chartsModule().then(m => ({ default: m.ComparisonBars })));
const Sparkline = lazy(() => _chartsModule().then(m => ({ default: m.Sparkline })));
import { AiAnalysisCard } from '../../components/dashboard/AiAnalysisCard';
import { BalanceTrendSection } from '../../components/reports/BalanceTrendSection';
import * as api from '../../services/api';
import type { CategoryBreakdownItem, MonthComparisonResponse, MonthlySummaryResponse } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { COLOR_POSITIVE, COLOR_NEGATIVE, COLOR_ACCENT, SPACING } from '../../theme/tokens';
import { PageHeader } from '../../components/PageHeader';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface OutletContextType {
    transactionRefreshKey: number;
}

const PRESETS = (t: (k: string) => string) => [
    { label: t('dashboard.presets.lastWeek'), value: () => [dayjs().subtract(1, 'week').startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
    { label: t('dashboard.presets.lastMonth'), value: () => [dayjs().startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
    { label: t('dashboard.presets.last6Months'), value: () => [dayjs().subtract(6, 'month').startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
    { label: t('dashboard.presets.lastYear'), value: () => [dayjs().subtract(1, 'year').startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
];

export const DashboardPage = () => {
    const { t } = useTranslation();
    const { transactionRefreshKey } = useOutletContext<OutletContextType>();
    const isMobile = useMediaQuery('(max-width: 768px)');

    usePageTitle(t('dashboard.title'));

    const [trendMonths, setTrendMonths] = useState(12);
    const [showCustomPicker, setShowCustomPicker] = useState(false);

    const {
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
        trendPoints,
        incomeSparkline,
        expenseSparkline,
        netSparkline,
        expenseComparison,
        portfolioValue,
        projection,
        budgetSummary,
        hasData,
        refetch: refetchDashboard,
    } = useDashboardData(transactionRefreshKey, trendMonths);

    usePullToRefresh(refetchDashboard ?? (() => {}), isMobile);

    // Confronto mese scelto dall'utente — cached via React Query.
    const [comparisonMonth, setComparisonMonth] = useState<Dayjs>(dayjs());
    const { data: customComparison, isPending: loadingComparison } = useQuery<MonthComparisonResponse | null>({
        queryKey: ['monthComparison', comparisonMonth.year(), comparisonMonth.month() + 1, transactionRefreshKey],
        queryFn: () =>
            api.getMonthComparison(comparisonMonth.year(), comparisonMonth.month() + 1)
                .then(r => r.data)
                .catch(() => null),
        placeholderData: keepPreviousData,
    });

    const showCrypto = portfolioValue && portfolioValue.totalValue > 0;
    const statCols = showCrypto ? { xs: 24, sm: 12, md: 6 } : { xs: 24, sm: 8 };

    const breakdownColumns: ColumnsType<CategoryBreakdownItem> = [
        { title: t('reports.categoryName'), dataIndex: 'categoryName', key: 'categoryName' },
        {
            title: t('reports.net'), dataIndex: 'net', key: 'net',
            render: (v: number) => `${v.toFixed(2)} €`,
            defaultSortOrder: 'ascend',
            sorter: (a, b) => b.net - a.net,
        },
        { title: t('reports.percentage'), dataIndex: 'percentage', key: 'percentage', render: (v: number) => `${v.toFixed(1)}%` },
    ];

    const budgetProgressColor = (pct: number): string => {
        if (pct >= 100) return COLOR_NEGATIVE;
        if (pct >= 75) return '#faad14';
        return COLOR_POSITIVE;
    };

    const renderBudgetSummaryItem = (item: MonthlySummaryResponse) => (
        <Col key={item.budgetId} xs={24} sm={12} lg={8}>
            <div style={{ marginBottom: 4 }}>
                <Flex justify="space-between" align="center">
                    <Text strong style={{ fontSize: 13 }}>{item.categoryName}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.spent.toFixed(2)} / {item.limit.toFixed(2)} €
                    </Text>
                </Flex>
                <Progress
                    aria-label={`${t('budgets.used')}: ${item.percentageUsed.toFixed(0)}%`}
                    percent={Math.min(item.percentageUsed, 100)}
                    size="small"
                    strokeColor={budgetProgressColor(item.percentageUsed)}
                    format={pct => <Text style={{ fontSize: 11 }}>{pct}%</Text>}
                />
                <Flex justify="space-between">
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        {t('dashboard.budgetSummary.remaining')}: {item.remaining.toFixed(2)} €
                    </Text>
                </Flex>
            </div>
        </Col>
    );

    if (loading) {
        return (
            <>
                <PageHeader title={t('dashboard.title')} />
                <Skeleton active paragraph={{ rows: 1 }} />
                <Row gutter={[SPACING.md, SPACING.md]} style={{ marginTop: SPACING.md }}>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                </Row>
                <Row gutter={[SPACING.md, SPACING.md]} style={{ marginTop: SPACING.md }}>
                    <Col xs={24} md={12}><Skeleton active paragraph={{ rows: 6 }} /></Col>
                    <Col xs={24} md={12}><Skeleton active paragraph={{ rows: 6 }} /></Col>
                </Row>
                <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: SPACING.md }} />
            </>
        );
    }

    const filterControls = (
        <div style={{ width: isMobile ? '100%' : 'auto' }}>
            {isMobile ? (
                        <Flex vertical gap={8}>
                            <Select
                                value={showCustomPicker ? 'custom' : (PRESETS(t).findIndex(p => {
                                    const v = p.value();
                                    return dateRange?.[0]?.isSame(v[0], 'day') && dateRange?.[1]?.isSame(v[1], 'day');
                                }))}
                                onChange={(idx: number | 'custom') => {
                                    if (idx === 'custom') {
                                        setShowCustomPicker(true);
                                    } else {
                                        setShowCustomPicker(false);
                                        setDateRange(PRESETS(t)[idx].value());
                                    }
                                }}
                                style={{ width: '100%' }}
                                options={[
                                    ...PRESETS(t).map((p, i) => ({ value: i, label: p.label })),
                                    { value: 'custom', label: t('dashboard.presets.custom') },
                                ]}
                            />
                            {showCustomPicker && (
                                <Flex gap={8}>
                                    <DatePicker
                                        value={dateRange?.[0] ?? null}
                                        onChange={d => setDateRange([d, dateRange?.[1] ?? null])}
                                        placeholder={t('dashboard.presets.startDate')}
                                        style={{ flex: 1 }}
                                    />
                                    <DatePicker
                                        value={dateRange?.[1] ?? null}
                                        onChange={d => setDateRange([dateRange?.[0] ?? null, d])}
                                        placeholder={t('dashboard.presets.endDate')}
                                        style={{ flex: 1 }}
                                    />
                                </Flex>
                            )}
                        </Flex>
                    ) : (
                        <Flex gap={6} align="center" justify="flex-end" wrap>
                            {PRESETS(t).map((p, i) => {
                                const v = p.value();
                                const isActive = dateRange?.[0]?.isSame(v[0], 'day') && dateRange?.[1]?.isSame(v[1], 'day');
                                return (
                                    <Button
                                        key={i}
                                        size="small"
                                        type={isActive ? 'primary' : 'default'}
                                        onClick={() => setDateRange(p.value())}
                                    >
                                        {p.label}
                                    </Button>
                                );
                            })}
                            <RangePicker
                                value={dateRange}
                                onChange={(dates) => setDateRange(dates)}
                                style={{ maxWidth: 280 }}
                            />
                        </Flex>
                    )}
        </div>
    );

    return (
        <>
            <PageHeader title={t('dashboard.title')} actions={filterControls} />

            {!hasData ? (
                <Empty description={t('dashboard.empty')} style={{ marginTop: 48 }} />
            ) : (
                <>
                    {/* Statistiche mese corrente */}
                    <Row gutter={[16, 16]}>
                        <Col {...statCols}>
                            <Card>
                                <Statistic
                                    title={t('dashboard.netBalance')}
                                    value={netBalance}
                                    precision={2}
                                    valueStyle={{ color: netBalance >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE }}
                                    prefix={netBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                    suffix="€"
                                />
                                <Suspense fallback={null}>
                                    <Sparkline values={netSparkline} color={netBalance >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE} />
                                </Suspense>
                            </Card>
                        </Col>
                        <Col {...statCols}>
                            <Card>
                                <Statistic
                                    title={t('dashboard.totalIncome')}
                                    value={totalIncome}
                                    precision={2}
                                    valueStyle={{ color: COLOR_POSITIVE }}
                                    prefix={<ArrowUpOutlined />}
                                    suffix="€"
                                />
                                <Suspense fallback={null}>
                                    <Sparkline values={incomeSparkline} color={COLOR_POSITIVE} />
                                </Suspense>
                            </Card>
                        </Col>
                        <Col {...statCols}>
                            <Card>
                                <Statistic
                                    title={t('dashboard.totalExpenses')}
                                    value={totalExpenses}
                                    precision={2}
                                    valueStyle={{ color: COLOR_NEGATIVE }}
                                    prefix={<ArrowDownOutlined />}
                                    suffix="€"
                                />
                                {expenseComparison && (
                                    <div style={{ marginTop: 4, fontSize: '12px' }}>
                                        <Text type={expenseComparison.percentageChange >= 0 ? 'danger' : 'success'}>
                                            {expenseComparison.percentageChange.toFixed(2)}%
                                        </Text>
                                        <Text type="secondary"> {t('dashboard.vsPeriod', { period: t('dashboard.previousMonth') })}</Text>
                                    </div>
                                )}
                                <Suspense fallback={null}>
                                    <Sparkline values={expenseSparkline} color={COLOR_NEGATIVE} />
                                </Suspense>
                            </Card>
                        </Col>
                        {showCrypto && (
                            <Col {...statCols}>
                                <Card>
                                    <Statistic
                                        title={t('dashboard.cryptoPortfolio')}
                                        value={portfolioValue.totalValue}
                                        precision={2}
                                        valueStyle={{ color: COLOR_ACCENT }}
                                        prefix={portfolioValue.currency === 'EUR' ? '€' : '$'}
                                    />
                                </Card>
                            </Col>
                        )}
                    </Row>

                    {/* Analisi Finanziaria AI */}
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24}>
                            <AiAnalysisCard />
                        </Col>
                    </Row>

                    {/* Panoramica Budget del Mese */}
                    {budgetSummary.length > 0 && (
                        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                            <Col xs={24}>
                                <Card title={t('dashboard.budgetSummary.title')}>
                                    <Row gutter={[16, 16]}>
                                        {budgetSummary.map(renderBudgetSummaryItem)}
                                    </Row>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Proiezione + Confronto mese affiancati */}
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        {projection && (
                            <Col xs={24} lg={12}>
                                <Card title={t('dashboard.projection')} style={{ height: '100%' }}>
                                    <Row gutter={[16, 8]} align="middle">
                                        <Col xs={12} sm={8}>
                                            <Statistic title={t('reports.projectedIncome')} value={projection.projectedMonthlyIncome} precision={2} valueStyle={{ color: COLOR_POSITIVE, fontSize: '16px' }} suffix="€" />
                                        </Col>
                                        <Col xs={12} sm={8}>
                                            <Statistic title={t('reports.projectedExpense')} value={projection.projectedMonthlyExpense} precision={2} valueStyle={{ color: COLOR_NEGATIVE, fontSize: '16px' }} suffix="€" />
                                        </Col>
                                        <Col xs={12} sm={8}>
                                            <Statistic
                                                title={t('reports.projectedSavings')}
                                                value={projection.projectedMonthlySavings}
                                                precision={2}
                                                valueStyle={{ color: projection.projectedMonthlySavings >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE, fontSize: '16px' }}
                                                suffix="€"
                                            />
                                        </Col>
                                        <Col xs={24}>
                                            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                                                {t('dashboard.projectionDay', { elapsed: projection.daysElapsed, total: projection.daysInMonth })}
                                            </Text>
                                            <Progress aria-label={t('dashboard.projectionDay', { elapsed: projection.daysElapsed, total: projection.daysInMonth })} percent={Math.round((projection.daysElapsed / projection.daysInMonth) * 100)} size="small" />
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        )}
                        <Col xs={24} lg={projection ? 12 : 24}>
                            <Card
                                title={t('reports.comparison')}
                                style={{ height: '100%' }}
                                extra={
                                    <DatePicker.MonthPicker
                                        value={comparisonMonth}
                                        onChange={m => { if (m) setComparisonMonth(m); }}
                                    />
                                }
                            >
                                {loadingComparison ? (
                                    <Skeleton active paragraph={{ rows: 2 }} />
                                ) : customComparison ? (
                                    <Suspense fallback={<Skeleton active paragraph={{ rows: 2 }} />}>
                                        <ComparisonBars
                                            currentIncome={customComparison.currentMonth?.income ?? 0}
                                            previousIncome={customComparison.previousMonth?.income ?? 0}
                                            currentExpense={customComparison.currentMonth?.expense ?? 0}
                                            previousExpense={customComparison.previousMonth?.expense ?? 0}
                                        />
                                    </Suspense>
                                ) : (
                                    <Empty />
                                )}
                            </Card>
                        </Col>
                    </Row>

                    {/* Pie charts + tabella breakdown */}
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24}>
                            <Card title={t('reports.categoryBreakdown')}>
                                <Tabs
                                    items={[
                                        {
                                            key: 'OUT',
                                            label: t('reports.typeOut'),
                                            children: (
                                                <Row gutter={[16, 16]}>
                                                    <Col xs={24} md={10}>
                                                        <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
                                                            <GenericPieChart data={expensesByCategory} />
                                                        </Suspense>
                                                    </Col>
                                                    <Col xs={24} md={14}>
                                                        <Table
                                                            columns={breakdownColumns}
                                                            dataSource={expenseBreakdown}
                                                            rowKey="categoryId"
                                                            size="small"
                                                            pagination={false}
                                                            locale={{ emptyText: <Empty description={t('charts.noData')} /> }}
                                                        />
                                                    </Col>
                                                </Row>
                                            ),
                                        },
                                        {
                                            key: 'IN',
                                            label: t('reports.typeIn'),
                                            children: (
                                                <Row gutter={[16, 16]}>
                                                    <Col xs={24} md={10}>
                                                        <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
                                                            <GenericPieChart data={incomeByCategory} />
                                                        </Suspense>
                                                    </Col>
                                                    <Col xs={24} md={14}>
                                                        <Table
                                                            columns={breakdownColumns}
                                                            dataSource={incomeBreakdown}
                                                            rowKey="categoryId"
                                                            size="small"
                                                            pagination={false}
                                                            locale={{ emptyText: <Empty description={t('charts.noData')} /> }}
                                                        />
                                                    </Col>
                                                </Row>
                                            ),
                                        },
                                    ]}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {/* Andamento saldo netto cumulato */}
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24}>
                            <BalanceTrendSection />
                        </Col>
                    </Row>

                    {/* Andamento mensile */}
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24}>
                            <Card
                                title={t('dashboard.monthlyTrend')}
                                {...(!isMobile && {
                                    extra: (
                                        <Flex gap="small" align="center">
                                            <Text type="secondary">{t('reports.trendMonths')}:</Text>
                                            <Select
                                                value={trendMonths}
                                                onChange={setTrendMonths}
                                                size="small"
                                                style={{ width: 110 }}
                                                options={[
                                                    { value: 6, label: t('reports.months6') },
                                                    { value: 12, label: t('reports.months12') },
                                                    { value: 24, label: t('reports.months24') },
                                                ]}
                                            />
                                        </Flex>
                                    )
                                })}
                            >
                                {isMobile && (
                                    <Flex justify="flex-end" style={{ marginBottom: 8 }}>
                                        <Select
                                            value={trendMonths}
                                            onChange={setTrendMonths}
                                            size="small"
                                            style={{ width: 110 }}
                                            options={[
                                                { value: 6, label: t('reports.months6') },
                                                { value: 12, label: t('reports.months12') },
                                                { value: 24, label: t('reports.months24') },
                                            ]}
                                        />
                                    </Flex>
                                )}
                                <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
                                    <TrendDualChart points={trendPoints} />
                                </Suspense>
                            </Card>
                        </Col>
                    </Row>
                </>
            )}
        </>
    );
};
