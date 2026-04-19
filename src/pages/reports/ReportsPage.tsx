import { useCallback, useEffect, useState } from 'react';
import {
    Card, Col, DatePicker, Empty, Flex, Progress, Row,
    Select, Skeleton, Statistic, Table, Typography, message
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import * as api from '../../services/api';
import type {
    CategoryBreakdownItem,
    MonthComparisonResponse,
    MonthlyProjectionResponse,
    MonthlyTrendItem
} from '../../types/api';
import { GenericPieChart, TrendBarChart } from '../../components/dashboard/DashboardCharts';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const ReportsPage = () => {
    const { t } = useTranslation();

    const [projection, setProjection] = useState<MonthlyProjectionResponse | null>(null);
    const [loadingProjection, setLoadingProjection] = useState(true);

    const now = dayjs();
    const [comparisonMonth, setComparisonMonth] = useState<Dayjs>(now);
    const [comparison, setComparison] = useState<MonthComparisonResponse | null>(null);
    const [loadingComparison, setLoadingComparison] = useState(false);

    const [trendMonths, setTrendMonths] = useState<number>(12);
    const [trendItems, setTrendItems] = useState<MonthlyTrendItem[]>([]);
    const [loadingTrend, setLoadingTrend] = useState(true);

    const [breakdownType, setBreakdownType] = useState<'IN' | 'OUT'>('OUT');
    const [breakdownRange, setBreakdownRange] = useState<[Dayjs | null, Dayjs | null]>([
        now.startOf('month'), now.endOf('month')
    ]);
    const [breakdownItems, setBreakdownItems] = useState<CategoryBreakdownItem[]>([]);
    const [loadingBreakdown, setLoadingBreakdown] = useState(false);

    useEffect(() => {
        api.getMonthlyProjection()
            .then(r => setProjection(r.data))
            .catch(() => message.error(t('reports.loadError')))
            .finally(() => setLoadingProjection(false));
    }, []);

    useEffect(() => {
        setLoadingTrend(true);
        api.getMonthlyTrend(trendMonths)
            .then(r => setTrendItems(r.data))
            .catch(() => message.error(t('reports.loadError')))
            .finally(() => setLoadingTrend(false));
    }, [trendMonths]);

    const fetchComparison = useCallback((month: Dayjs) => {
        setLoadingComparison(true);
        api.getMonthComparison(month.year(), month.month() + 1)
            .then(r => setComparison(r.data))
            .catch(() => message.error(t('reports.loadError')))
            .finally(() => setLoadingComparison(false));
    }, [t]);

    useEffect(() => { fetchComparison(comparisonMonth); }, []);

    const fetchBreakdown = useCallback(() => {
        const [start, end] = breakdownRange;
        if (!start || !end) return;
        setLoadingBreakdown(true);
        api.getCategoryBreakdown(breakdownType, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))
            .then(r => setBreakdownItems(r.data.items))
            .catch(() => message.error(t('reports.loadError')))
            .finally(() => setLoadingBreakdown(false));
    }, [breakdownType, breakdownRange, t]);

    useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);

    const trendBarData = trendItems.flatMap(item => {
        const label = dayjs(`${item.year}-${String(item.month).padStart(2, '0')}-01`).format('MMM YY');
        return [
            { month: label, type: 'Entrate', value: item.totalIncome },
            { month: label, type: 'Uscite', value: item.totalExpense },
        ];
    });

    const pieData = breakdownItems.map(i => ({ type: i.categoryName, value: i.total }));

    const breakdownColumns: ColumnsType<CategoryBreakdownItem> = [
        { title: t('reports.categoryName'), dataIndex: 'categoryName', key: 'categoryName' },
        {
            title: t('reports.total'), dataIndex: 'total', key: 'total',
            render: (v: number) => `${v.toFixed(2)} €`,
            sorter: (a, b) => b.total - a.total,
            defaultSortOrder: 'ascend',
        },
        { title: t('reports.percentage'), dataIndex: 'percentage', key: 'percentage', render: (v: number) => `${v.toFixed(1)}%` },
        { title: t('reports.transactionCount'), dataIndex: 'transactionCount', key: 'transactionCount' },
    ];

    const deltaColor = (v: number) => v >= 0 ? '#cf1322' : '#3f8600';

    return (
        <>
            <Title level={2} style={{ marginBottom: 24 }}>{t('reports.title')}</Title>

            {/* Proiezione mensile */}
            <Card title={t('reports.projection')} style={{ marginBottom: 16 }}>
                {loadingProjection ? <Skeleton active paragraph={{ rows: 2 }} /> : (
                    projection ? (
                        <Row gutter={[16, 8]} align="middle">
                            <Col xs={24} sm={6}>
                                <Statistic title={t('reports.projectedIncome')} value={projection.projectedIncome} precision={2} valueStyle={{ color: '#3f8600' }} suffix="€" />
                            </Col>
                            <Col xs={24} sm={6}>
                                <Statistic title={t('reports.projectedExpense')} value={projection.projectedExpense} precision={2} valueStyle={{ color: '#cf1322' }} suffix="€" />
                            </Col>
                            <Col xs={24} sm={6}>
                                <Statistic
                                    title={t('reports.projectedSavings')}
                                    value={projection.projectedSavings}
                                    precision={2}
                                    valueStyle={{ color: projection.projectedSavings >= 0 ? '#3f8600' : '#cf1322' }}
                                    suffix="€"
                                />
                            </Col>
                            <Col xs={24} sm={6}>
                                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                                    {t('reports.daysElapsed', { elapsed: projection.daysElapsed, total: projection.daysInMonth })}
                                </Text>
                                <Progress percent={Math.round((projection.daysElapsed / projection.daysInMonth) * 100)} size="small" />
                            </Col>
                        </Row>
                    ) : <Empty />
                )}
            </Card>

            {/* Confronto mensile */}
            <Card
                title={t('reports.comparison')}
                extra={
                    <DatePicker.MonthPicker
                        value={comparisonMonth}
                        onChange={(m) => {
                            if (m) {
                                setComparisonMonth(m);
                                fetchComparison(m);
                            }
                        }}
                    />
                }
                style={{ marginBottom: 16 }}
            >
                {loadingComparison ? <Skeleton active paragraph={{ rows: 2 }} /> : (
                    comparison ? (
                        <Row gutter={[16, 8]}>
                            <Col xs={12} sm={6}>
                                <Statistic title={`${t('reports.currentMonth')} — ${t('dashboard.totalIncome')}`} value={comparison.currentIncome} precision={2} valueStyle={{ color: '#3f8600' }} suffix="€" prefix={<ArrowUpOutlined />} />
                            </Col>
                            <Col xs={12} sm={6}>
                                <Statistic title={`${t('reports.previousMonth')} — ${t('dashboard.totalIncome')}`} value={comparison.previousIncome} precision={2} suffix="€" />
                                <Text style={{ color: deltaColor(comparison.incomeChange), fontSize: 12 }}>
                                    {comparison.incomeChange >= 0 ? '+' : ''}{comparison.incomeChange.toFixed(2)} €
                                </Text>
                            </Col>
                            <Col xs={12} sm={6}>
                                <Statistic title={`${t('reports.currentMonth')} — ${t('dashboard.totalExpenses')}`} value={comparison.currentExpense} precision={2} valueStyle={{ color: '#cf1322' }} suffix="€" prefix={<ArrowDownOutlined />} />
                            </Col>
                            <Col xs={12} sm={6}>
                                <Statistic title={`${t('reports.previousMonth')} — ${t('dashboard.totalExpenses')}`} value={comparison.previousExpense} precision={2} suffix="€" />
                                <Text style={{ color: deltaColor(-comparison.expenseChange), fontSize: 12 }}>
                                    {comparison.expenseChange >= 0 ? '+' : ''}{comparison.expenseChange.toFixed(2)} €
                                </Text>
                            </Col>
                        </Row>
                    ) : <Empty />
                )}
            </Card>

            {/* Andamento mensile */}
            <Card
                title={t('reports.trend')}
                extra={
                    <Select
                        value={trendMonths}
                        onChange={setTrendMonths}
                        style={{ width: 120 }}
                        options={[
                            { value: 6, label: t('reports.months6') },
                            { value: 12, label: t('reports.months12') },
                            { value: 24, label: t('reports.months24') },
                        ]}
                    />
                }
                style={{ marginBottom: 16 }}
            >
                {loadingTrend ? <Skeleton active paragraph={{ rows: 4 }} /> : (
                    trendBarData.length > 0 ? <TrendBarChart data={trendBarData} /> : <Empty />
                )}
            </Card>

            {/* Breakdown per categoria */}
            <Card
                title={t('reports.categoryBreakdown')}
                extra={
                    <Flex gap="small" wrap="wrap">
                        <Select
                            value={breakdownType}
                            onChange={v => setBreakdownType(v)}
                            style={{ width: 110 }}
                            options={[
                                { value: 'OUT', label: t('reports.typeOut') },
                                { value: 'IN', label: t('reports.typeIn') },
                            ]}
                        />
                        <RangePicker
                            value={breakdownRange}
                            onChange={v => setBreakdownRange(v ?? [null, null])}
                        />
                    </Flex>
                }
            >
                {loadingBreakdown ? <Skeleton active paragraph={{ rows: 4 }} /> : (
                    breakdownItems.length > 0 ? (
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={10}>
                                <GenericPieChart data={pieData} />
                            </Col>
                            <Col xs={24} md={14}>
                                <Table
                                    columns={breakdownColumns}
                                    dataSource={breakdownItems}
                                    rowKey="categoryId"
                                    size="small"
                                    pagination={false}
                                />
                            </Col>
                        </Row>
                    ) : <Empty />
                )}
            </Card>
        </>
    );
};
