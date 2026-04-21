// src/pages/dashboard/DashboardPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Card, Col, DatePicker, Empty, Flex, Progress, Row,
    Select, Skeleton, Statistic, Table, Tabs, Typography, message
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import { useDashboardData } from '../../hooks/useDashboardData';
import { GenericPieChart, TrendBarChart } from '../../components/dashboard/DashboardCharts';
import { AiAnalysisCard } from '../../components/dashboard/AiAnalysisCard';
import * as api from '../../services/api';
import type { CategoryBreakdownItem, MonthComparisonResponse } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { COLOR_POSITIVE, COLOR_NEGATIVE, COLOR_ACCENT } from '../../theme/tokens';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface OutletContextType {
    transactionRefreshKey: number;
}

const PRESETS = (t: (k: string) => string) => [
    { label: t('dashboard.presets.lastWeek'), value: [dayjs().subtract(1, 'week').startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
    { label: t('dashboard.presets.lastMonth'), value: [dayjs().startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
    { label: t('dashboard.presets.last6Months'), value: [dayjs().subtract(6, 'month').startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
    { label: t('dashboard.presets.lastYear'), value: [dayjs().subtract(1, 'year').startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
];

export const DashboardPage = () => {
    const { t } = useTranslation();
    const { transactionRefreshKey } = useOutletContext<OutletContextType>();
    const isMobile = useMediaQuery('(max-width: 768px)');

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
        monthlyTrend,
        expenseComparison,
        portfolioValue,
        projection,
        hasData,
    } = useDashboardData(transactionRefreshKey, trendMonths);

    // Confronto mese scelto dall'utente
    const [comparisonMonth, setComparisonMonth] = useState<Dayjs>(dayjs());
    const [customComparison, setCustomComparison] = useState<MonthComparisonResponse | null>(null);
    const [loadingComparison, setLoadingComparison] = useState(false);

    const fetchCustomComparison = useCallback((month: Dayjs) => {
        setLoadingComparison(true);
        api.getMonthComparison(month.year(), month.month() + 1)
            .then(r => setCustomComparison(r.data))
            .catch(() => message.error(t('reports.loadError')))
            .finally(() => setLoadingComparison(false));
    }, [t]);

    useEffect(() => { fetchCustomComparison(comparisonMonth); }, []);

    const showCrypto = portfolioValue && portfolioValue.totalValue > 0;
    const statCols = showCrypto ? { xs: 24, sm: 12, md: 6 } : { xs: 24, sm: 8 };

    const breakdownColumns: ColumnsType<CategoryBreakdownItem> = [
        { title: t('reports.categoryName'), dataIndex: 'categoryName', key: 'categoryName' },
        {
            title: t('reports.total'), dataIndex: 'total', key: 'total',
            render: (v: number) => `${v.toFixed(2)} €`,
            defaultSortOrder: 'ascend',
            sorter: (a, b) => b.total - a.total,
        },
        { title: t('reports.percentage'), dataIndex: 'percentage', key: 'percentage', render: (v: number) => `${v.toFixed(1)}%` },
    ];

    const deltaStyle = (v: number, isExpense = false) => ({
        color: (isExpense ? v > 0 : v > 0) ? COLOR_NEGATIVE : COLOR_POSITIVE,
        fontSize: 12
    });

    if (loading) {
        return (
            <div style={{ padding: 24 }}>
                <Skeleton active paragraph={{ rows: 1 }} />
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                </Row>
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col xs={24} md={12}><Skeleton active paragraph={{ rows: 6 }} /></Col>
                    <Col xs={24} md={12}><Skeleton active paragraph={{ rows: 6 }} /></Col>
                </Row>
                <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: 16 }} />
            </div>
        );
    }

    return (
        <>
            {/* Header */}
            <Row justify="space-between" align="middle" gutter={[8, 8]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12}>
                    <Title level={2} style={{ margin: 0 }}>{t('dashboard.title')}</Title>
                </Col>
                <Col xs={24} sm={12}>
                    {isMobile ? (
                        <Flex vertical gap={8}>
                            <Select
                                value={showCustomPicker ? 'custom' : (PRESETS(t).findIndex(p =>
                                    dateRange?.[0]?.isSame(p.value[0], 'day') &&
                                    dateRange?.[1]?.isSame(p.value[1], 'day')
                                ))}
                                onChange={(idx: number | 'custom') => {
                                    if (idx === 'custom') {
                                        setShowCustomPicker(true);
                                    } else {
                                        setShowCustomPicker(false);
                                        setDateRange(PRESETS(t)[idx].value);
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
                        <Flex justify="flex-end">
                            <RangePicker
                                value={dateRange}
                                onChange={setDateRange}
                                style={{ width: '100%', maxWidth: 350 }}
                                presets={PRESETS(t)}
                            />
                        </Flex>
                    )}
                </Col>
            </Row>

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
                                    <div style={{ marginTop: 8, fontSize: '12px' }}>
                                        <Text type={expenseComparison.percentageChange >= 0 ? 'danger' : 'success'}>
                                            {expenseComparison.percentageChange.toFixed(2)}%
                                        </Text>
                                        <Text type="secondary"> {t('dashboard.vsPeriod', { period: t('dashboard.previousMonth') })}</Text>
                                    </div>
                                )}
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
                                            <Progress percent={Math.round((projection.daysElapsed / projection.daysInMonth) * 100)} size="small" />
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
                                        onChange={m => {
                                            if (m) {
                                                setComparisonMonth(m);
                                                fetchCustomComparison(m);
                                            }
                                        }}
                                    />
                                }
                            >
                                {loadingComparison ? (
                                    <Skeleton active paragraph={{ rows: 2 }} />
                                ) : customComparison ? (
                                    <Row gutter={[16, 8]}>
                                        <Col xs={12}>
                                            <Statistic title={t('dashboard.totalIncome')} value={customComparison.currentMonth?.income} precision={2} valueStyle={{ color: COLOR_POSITIVE, fontSize: '16px' }} suffix="€" prefix={<ArrowUpOutlined />} />
                                            <Text style={deltaStyle(customComparison.incomeChange)}>
                                                {customComparison.incomeChange >= 0 ? '+' : ''}{customComparison.incomeChange.toFixed(2)} €{' '}
                                                <Text type="secondary" style={{ fontSize: 11 }}>{t('reports.vsPreviousMonth')}</Text>
                                            </Text>
                                        </Col>
                                        <Col xs={12}>
                                            <Statistic title={t('dashboard.totalExpenses')} value={customComparison.currentMonth?.expense} precision={2} valueStyle={{ color: COLOR_NEGATIVE, fontSize: '16px' }} suffix="€" prefix={<ArrowDownOutlined />} />
                                            <Text style={deltaStyle(customComparison.expenseChange, true)}>
                                                {customComparison.expenseChange >= 0 ? '+' : ''}{customComparison.expenseChange.toFixed(2)} €{' '}
                                                <Text type="secondary" style={{ fontSize: 11 }}>{t('reports.vsPreviousMonth')}</Text>
                                            </Text>
                                        </Col>
                                    </Row>
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
                                                        <GenericPieChart data={expensesByCategory} />
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
                                                        <GenericPieChart data={incomeByCategory} />
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

                    {/* Andamento mensile */}
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24}>
                            <Card
                                title={t('dashboard.monthlyTrend')}
                                extra={
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
                                }
                            >
                                <TrendBarChart data={monthlyTrend} />
                            </Card>
                        </Col>
                    </Row>
                </>
            )}
        </>
    );
};
