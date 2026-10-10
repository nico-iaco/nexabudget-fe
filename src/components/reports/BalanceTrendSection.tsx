import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
    App,
    Card,
    Col,
    DatePicker,
    Flex,
    Row,
    Skeleton,
    Table,
    Typography,
    theme,
} from 'antd';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import type { ColumnsType } from 'antd/es/table';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { getApiErrorStatus } from '../../utils/apiError';
import * as api from '../../services/api';
import { queryKeys } from '../../queryKeys';
import type { BalanceTrendItem, BalanceTrendResponse } from '../../types/api';
import { usePreferences } from '../../contexts/PreferencesContext';
import { SPACING, FONT_SIZE, getSemanticColors } from '../../theme/tokens';
import { DatePresetPicker } from '../common/DatePresetPicker';
import { EmptyState } from '../common/EmptyState';
import { InlineError } from '../common/InlineError';
import { StatCard } from '../common/StatCard';
import { formatMoney, formatPercent } from '../../utils/format';
import { getRangePresets, lastMonthsRange } from '../../utils/datePresets';

const BalanceTrendChart = lazy(() =>
    import('./BalanceTrendChart').then(m => ({ default: m.BalanceTrendChart })),
);

const { RangePicker } = DatePicker;
const { Text } = Typography;

const DEBOUNCE_MS = 300;

const defaultRange = (): [Dayjs, Dayjs] => lastMonthsRange(12);

// Preset condivisi (utils/datePresets): stesse etichette e stessi intervalli delle altre
// pagine ("Ultimi 12 mesi", non "12 mesi").
const TREND_PRESETS = (t: (k: string) => string) =>
    getRangePresets(t, ['last3Months', 'last6Months', 'last12Months', 'last24Months']);

const useDebounced = <T,>(value: T, delay = DEBOUNCE_MS): T => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
};

interface BalanceTrendSectionProps {
    /**
     * Tabella mese per mese sotto il grafico. Sulla dashboard è nascosta: ripeteva gli
     * stessi valori del grafico (fino a 24 righe) in fondo a una pagina già lunga.
     */
    showTable?: boolean;
}

export const BalanceTrendSection = ({ showTable = true }: BalanceTrendSectionProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const { message } = App.useApp();
    const { isSmallMobile } = useBreakpoints();
    const { token } = theme.useToken();
    const semantic = getSemanticColors(preferences.theme === 'dark');

    const locale = preferences.language === 'en' ? 'en-US' : 'it-IT';

    const [range, setRange] = useState<[Dayjs, Dayjs]>(defaultRange);
    const [startDate, endDate] = range;

    const isValidRange = !!startDate && !!endDate && !endDate.isBefore(startDate, 'day');

    const debouncedStart = useDebounced(startDate?.format('YYYY-MM-DD'));
    const debouncedEnd = useDebounced(endDate?.format('YYYY-MM-DD'));

    const queryEnabled = isValidRange && !!debouncedStart && !!debouncedEnd;

    const { data, isPending, isFetching, isError, error, refetch } = useQuery<BalanceTrendResponse>({
        queryKey: queryKeys.balanceTrend(debouncedStart, debouncedEnd),
        queryFn: () => api.getBalanceTrend({ startDate: debouncedStart!, endDate: debouncedEnd! }).then(r => r.data),
        enabled: queryEnabled,
        placeholderData: keepPreviousData,
    });

    useEffect(() => {
        if (!isError || !error) return;
        const status = getApiErrorStatus(error);
        if (status && status >= 400) {
            message.error(t('reports.balanceTrend.loadError'));
        } else {
            message.error(t('reports.loadError'));
        }
    }, [isError, error, message, t]);

    const currency = data?.currency ?? 'EUR';

    // Formattazione condivisa (utils/format): separatori coerenti col resto dell'app.
    const formatAmount = (v: number) => formatMoney(v, currency);
    const formatSignedAmount = (v: number) => formatMoney(v, currency, { signed: true });

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
    const changeColor = changePositive ? semantic.positive : semantic.negative;

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
                <Text style={{ color: v < 0 ? semantic.negative : undefined }}>
                    {formatSignedAmount(v)}
                </Text>
            ),
        },
        {
            title: t('reports.balanceTrend.closingBalance'),
            dataIndex: 'closingBalance',
            key: 'closingBalance',
            align: 'right',
            render: (v: number) => formatAmount(v),
        },
    ];

    const desktopDatePicker = (
        <RangePicker
            value={range}
            allowClear={false}
            onChange={(dates) => {
                if (dates && dates[0] && dates[1]) setRange([dates[0], dates[1]]);
            }}
            presets={TREND_PRESETS(t)}
        />
    );

    const isLoading = queryEnabled && isPending;

    const cardTitle = isSmallMobile ? (
        <Flex vertical gap={8} style={{ paddingTop: 8, paddingBottom: 8 }}>
            <Typography.Text strong style={{ fontSize: FONT_SIZE.xl }}>
                {t('reports.balanceTrend.title')}
            </Typography.Text>
            <DatePresetPicker
                presets={TREND_PRESETS(t)}
                value={range}
                onChange={(r) => { if (r[0] && r[1]) setRange([r[0], r[1]]); }}
                customLabel={t('dashboard.presets.custom')}
                startPlaceholder={t('dashboard.presets.startDate')}
                endPlaceholder={t('dashboard.presets.endDate')}
            />
        </Flex>
    ) : (
        t('reports.balanceTrend.title')
    );

    return (
        <Card title={cardTitle} extra={isSmallMobile ? undefined : desktopDatePicker}>
            {!isValidRange && (
                <EmptyState description={t('reports.balanceTrend.invalidRange')} />
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

            {/* Errore senza dati da mostrare: prima la card restava vuota, senza spiegazioni. */}
            {isValidRange && !isLoading && !data && isError && (
                <InlineError
                    message={t('reports.balanceTrend.loadError')}
                    onRetry={() => { void refetch(); }}
                />
            )}

            {isValidRange && !isLoading && data && (
                <>
                    <Row gutter={[SPACING.md, SPACING.md]}>
                        <Col xs={24} sm={8}>
                            <StatCard
                                size="small"
                                title={t('reports.balanceTrend.openingBalance')}
                                value={opening}
                                color={token.colorPrimary}
                                currency={currency}
                            />
                        </Col>
                        <Col xs={24} sm={8}>
                            <StatCard
                                size="small"
                                title={t('reports.balanceTrend.closingBalanceFinal')}
                                value={closing}
                                color={closing >= 0 ? semantic.positive : semantic.negative}
                                currency={currency}
                            />
                        </Col>
                        <Col xs={24} sm={8}>
                            <StatCard
                                size="small"
                                title={t('reports.balanceTrend.change')}
                                value={absChange}
                                color={changeColor}
                                prefix={changePositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                formatter={(val) => formatSignedAmount(Number(val))}
                                footer={pctChange !== null && (
                                    <Text style={{ color: changeColor, fontSize: FONT_SIZE.sm }}>
                                        {formatPercent(pctChange, 2, true)}
                                    </Text>
                                )}
                            />
                        </Col>
                    </Row>

                    <div style={{ marginTop: SPACING.lg, opacity: isFetching ? 0.7 : 1, transition: 'opacity 0.15s' }}>
                        {items.length === 0 ? (
                            <EmptyState description={t('charts.noData')} />
                        ) : (
                            <>
                                <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
                                    <BalanceTrendChart
                                        points={chartPoints}
                                        currency={currency}
                                    />
                                </Suspense>

                                {showTable && <Table
                                    style={{ marginTop: SPACING.md }}
                                    size="small"
                                    rowKey={(item) => `${item.year}-${item.month}`}
                                    columns={tableColumns}
                                    dataSource={items}
                                    pagination={false}
                                    scroll={{ x: 'max-content' }}
                                />}
                            </>
                        )}
                    </div>
                </>
            )}
        </Card>
    );
};
