import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
    App,
    Card,
    Col,
    DatePicker,
    Empty,
    Flex,
    Row,
    Skeleton,
    Statistic,
    Table,
    Typography,
} from 'antd';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import type { ColumnsType } from 'antd/es/table';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { AxiosError } from 'axios';
import * as api from '../../services/api';
import type { BalanceTrendItem, BalanceTrendResponse } from '../../types/api';
import { usePreferences } from '../../contexts/PreferencesContext';
import { COLOR_ACCENT, COLOR_NEGATIVE, COLOR_POSITIVE, SPACING } from '../../theme/tokens';

const BalanceTrendChart = lazy(() =>
    import('./BalanceTrendChart').then(m => ({ default: m.BalanceTrendChart })),
);

const { RangePicker } = DatePicker;
const { Text } = Typography;

const DEBOUNCE_MS = 300;

const defaultRange = (): [Dayjs, Dayjs] => [
    dayjs().subtract(11, 'month').startOf('month'),
    dayjs().endOf('month'),
];

const useDebounced = <T,>(value: T, delay = DEBOUNCE_MS): T => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
};

export const BalanceTrendSection = () => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const { message } = App.useApp();
    const { isSmallMobile } = useBreakpoints();

    const locale = preferences.language === 'en' ? 'en-US' : 'it-IT';

    const [range, setRange] = useState<[Dayjs, Dayjs]>(defaultRange);
    const [startDate, endDate] = range;

    const isValidRange = !!startDate && !!endDate && !endDate.isBefore(startDate, 'day');

    const debouncedStart = useDebounced(startDate?.format('YYYY-MM-DD'));
    const debouncedEnd = useDebounced(endDate?.format('YYYY-MM-DD'));

    const queryEnabled = isValidRange && !!debouncedStart && !!debouncedEnd;

    const { data, isPending, isFetching, isError, error } = useQuery<BalanceTrendResponse>({
        queryKey: ['reports', 'balance-trend', debouncedStart, debouncedEnd],
        queryFn: () => api.getBalanceTrend({ startDate: debouncedStart!, endDate: debouncedEnd! }).then(r => r.data),
        enabled: queryEnabled,
        placeholderData: keepPreviousData,
    });

    useEffect(() => {
        if (!isError || !error) return;
        const status = error instanceof AxiosError ? error.response?.status : undefined;
        if (status && status >= 400) {
            message.error(t('reports.balanceTrend.loadError'));
        } else {
            message.error(t('reports.loadError'));
        }
    }, [isError, error, message, t]);

    const currency = data?.currency ?? 'EUR';

    const currencyFmt = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'currency', currency }),
        [locale, currency],
    );
    const signedCurrencyFmt = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'currency', currency, signDisplay: 'exceptZero' }),
        [locale, currency],
    );

    const monthLabel = useMemo(() => {
        const fmt = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' });
        return (year: number, month: number) => {
            const d = new Date(year, month - 1, 1);
            const formatted = fmt.format(d);
            return formatted.charAt(0).toUpperCase() + formatted.slice(1);
        };
    }, [locale]);

    const items = data?.items ?? [];
    const opening = data?.openingBalance ?? 0;
    const closing = items.length > 0 ? items[items.length - 1].closingBalance : opening;
    const absChange = closing - opening;
    const pctChange = opening !== 0 ? (absChange / Math.abs(opening)) * 100 : null;
    const changePositive = absChange >= 0;
    const changeColor = changePositive ? COLOR_POSITIVE : COLOR_NEGATIVE;

    const chartPoints = useMemo(
        () => items.map(it => ({
            year: it.year,
            month: it.month,
            label: monthLabel(it.year, it.month),
            monthlyNet: it.monthlyNet,
            closingBalance: it.closingBalance,
        })),
        [items, monthLabel],
    );

    const tableColumns: ColumnsType<BalanceTrendItem> = [
        {
            title: t('reports.balanceTrend.month'),
            key: 'month',
            render: (_, item) => monthLabel(item.year, item.month),
        },
        {
            title: t('reports.balanceTrend.monthlyNet'),
            dataIndex: 'monthlyNet',
            key: 'monthlyNet',
            align: 'right',
            render: (v: number) => (
                <Text style={{ color: v < 0 ? COLOR_NEGATIVE : undefined }}>
                    {signedCurrencyFmt.format(v)}
                </Text>
            ),
        },
        {
            title: t('reports.balanceTrend.closingBalance'),
            dataIndex: 'closingBalance',
            key: 'closingBalance',
            align: 'right',
            render: (v: number) => currencyFmt.format(v),
        },
    ];

    const datePicker = (
        <RangePicker
            value={range}
            allowClear={false}
            onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                    setRange([dates[0], dates[1]]);
                }
            }}
            style={isSmallMobile ? { width: '100%' } : undefined}
        />
    );

    const isLoading = queryEnabled && isPending;

    const cardTitle = isSmallMobile ? (
        <Flex vertical gap={8} style={{ paddingTop: 8, paddingBottom: 8 }}>
            <Typography.Text strong style={{ fontSize: 16 }}>
                {t('reports.balanceTrend.title')}
            </Typography.Text>
            {datePicker}
        </Flex>
    ) : (
        t('reports.balanceTrend.title')
    );

    return (
        <Card title={cardTitle} extra={isSmallMobile ? undefined : datePicker}>
            {!isValidRange && (
                <Empty description={t('reports.balanceTrend.invalidRange')} />
            )}

            {isValidRange && isLoading && (
                <>
                    <Row gutter={[SPACING.md, SPACING.md]}>
                        <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 90 }} /></Col>
                        <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 90 }} /></Col>
                        <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 90 }} /></Col>
                    </Row>
                    <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: SPACING.md }} />
                </>
            )}

            {isValidRange && !isLoading && data && (
                <>
                    <Row gutter={[SPACING.md, SPACING.md]}>
                        <Col xs={24} sm={8}>
                            <Card size="small">
                                <Statistic
                                    title={t('reports.balanceTrend.openingBalance')}
                                    value={opening}
                                    precision={2}
                                    valueStyle={{ color: COLOR_ACCENT }}
                                    formatter={(val) => currencyFmt.format(Number(val))}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card size="small">
                                <Statistic
                                    title={t('reports.balanceTrend.closingBalanceFinal')}
                                    value={closing}
                                    precision={2}
                                    valueStyle={{ color: closing >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE }}
                                    formatter={(val) => currencyFmt.format(Number(val))}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card size="small">
                                <Statistic
                                    title={t('reports.balanceTrend.change')}
                                    value={absChange}
                                    precision={2}
                                    valueStyle={{ color: changeColor }}
                                    prefix={changePositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                    formatter={(val) => signedCurrencyFmt.format(Number(val))}
                                />
                                {pctChange !== null && (
                                    <Text style={{ color: changeColor, fontSize: 12 }}>
                                        {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
                                    </Text>
                                )}
                            </Card>
                        </Col>
                    </Row>

                    <div style={{ marginTop: SPACING.lg, opacity: isFetching ? 0.7 : 1, transition: 'opacity 0.15s' }}>
                        {items.length === 0 ? (
                            <Empty description={t('charts.noData')} />
                        ) : (
                            <>
                                <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
                                    <BalanceTrendChart
                                        points={chartPoints}
                                        currency={currency}
                                        locale={locale}
                                    />
                                </Suspense>

                                <Table
                                    style={{ marginTop: SPACING.md }}
                                    size="small"
                                    rowKey={(item) => `${item.year}-${item.month}`}
                                    columns={tableColumns}
                                    dataSource={items}
                                    pagination={false}
                                    scroll={{ x: 'max-content' }}
                                />
                            </>
                        )}
                    </div>
                </>
            )}
        </Card>
    );
};
