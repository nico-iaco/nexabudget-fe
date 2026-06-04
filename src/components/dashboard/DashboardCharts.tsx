import { Column, Line, Pie } from '@ant-design/charts';
import { Empty, Flex, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { BarData, LineData } from '../../hooks/useDashboardData';
import { usePreferences } from '../../contexts/PreferencesContext';
import { COLOR_POSITIVE, COLOR_NEGATIVE, COLOR_ACCENT } from '../../theme/tokens';

export { TrendDualChart } from './TrendDualChart';

const TooltipGlobalStyles = ({ isDark }: { isDark: boolean }) => (
    <style>{`
        .g2-tooltip {
            background-color: ${isDark ? '#1f1f1f' : '#ffffff'} !important;
            color: ${isDark ? '#ffffff' : '#000000'} !important;
            box-shadow: 0 3px 6px -4px rgba(0,0,0,0.48), 0 6px 16px 0 rgba(0,0,0,0.32), 0 9px 28px 8px rgba(0,0,0,0.2) !important;
        }
        .g2-tooltip * {
            color: ${isDark ? '#ffffff' : '#000000'} !important;
        }
        .g2-tooltip-title {
            color: ${isDark ? '#ffffff' : '#000000'} !important;
        }
        .g2-tooltip-list-item-label {
             color: ${isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.65)'} !important;
        }
    `}</style>
);

const formatCurrency = (v: number): string =>
    `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} €`;

interface PieChartProps {
    data: { type: string; value: number }[];
    centerLabel?: string;
}

export const GenericPieChart = ({ data, centerLabel }: PieChartProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const enriched = data.map(d => ({
        ...d,
        _amount: `${d.value.toFixed(2)} € (${total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0'}%)`,
    }));

    const config = {
        data: enriched,
        angleField: 'value',
        colorField: 'type',
        radius: 0.9,
        innerRadius: 0.62,
        label: false,
        theme: isDark ? 'dark' : undefined,
        legend: { position: 'right' as const },
        interactions: [{ type: 'element-active' }],
        tooltip: {
            title: { field: 'type' },
            items: [{ field: '_amount', name: t('reports.total') }],
        },
        statistic: {
            title: {
                style: { fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)' },
                content: centerLabel ?? t('reports.total'),
            },
            content: {
                style: { fontSize: '18px', fontWeight: 600, color: isDark ? '#fff' : '#000' },
                content: formatCurrency(total),
            },
        },
    };

    return (
        <>
            <TooltipGlobalStyles isDark={isDark} />
            <Pie {...config} />
        </>
    );
};

interface BarChartProps {
    data: BarData[];
}

export const TrendBarChart = ({ data }: BarChartProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

    const config = {
        data,
        xField: 'month',
        yField: 'value',
        colorField: 'type',
        isGroup: true,
        seriesField: 'type',
        theme: isDark ? 'dark' : undefined,
        columnStyle: { radius: [2, 2, 0, 0] },
        legend: { position: 'top-left' as const },
        xAxis: { label: { style: { fill: isDark ? '#ffffff' : '#000000' } } },
        yAxis: { label: { style: { fill: isDark ? '#ffffff' : '#000000' } } },
        // Traduce le chiavi stabili IN/OUT nelle label localizzate per legenda e tooltip
        meta: {
            type: {
                formatter: (v: string) => v === 'IN' ? t('charts.income') : t('charts.expense'),
            },
        },
    };

    return (
        <>
            <TooltipGlobalStyles isDark={isDark} />
            <Column {...config} />
        </>
    );
};


interface ComparisonBarsProps {
    currentIncome: number;
    previousIncome: number;
    currentExpense: number;
    previousExpense: number;
}

const fmtEur = (v: number) =>
    `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

interface ComparisonRowProps {
    label: string;
    current: number;
    previous: number;
    color: string;
    deltaIsBad: boolean;
    prevLabel: string;
    currLabel: string;
}

const ComparisonRow = ({ label, current, previous, color, deltaIsBad, prevLabel, currLabel }: ComparisonRowProps) => {
    const { Text } = Typography;
    const max = Math.max(current, previous, 1);
    const delta = current - previous;
    const pct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
    const deltaPositive = delta >= 0;
    const deltaColor = (deltaIsBad ? deltaPositive : !deltaPositive) ? COLOR_NEGATIVE : COLOR_POSITIVE;
    const DeltaIcon = deltaPositive ? ArrowUpOutlined : ArrowDownOutlined;

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
                <Text strong>{label}</Text>
                <Text style={{ color: deltaColor, fontSize: 13 }}>
                    <DeltaIcon style={{ fontSize: 11, marginRight: 4 }} />
                    {deltaPositive ? '+' : ''}{fmtEur(delta)}
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                        ({deltaPositive ? '+' : ''}{pct.toFixed(1)}%)
                    </Text>
                </Text>
            </Flex>
            <Flex vertical gap={4}>
                <div>
                    <Flex justify="space-between" style={{ marginBottom: 2 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>{prevLabel}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{fmtEur(previous)}</Text>
                    </Flex>
                    <div style={{ height: 8, backgroundColor: 'rgba(128,128,128,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(previous / max) * 100}%`, backgroundColor: '#bfbfbf', borderRadius: 4 }} />
                    </div>
                </div>
                <div>
                    <Flex justify="space-between" style={{ marginBottom: 2 }}>
                        <Text style={{ fontSize: 11 }}>{currLabel}</Text>
                        <Text style={{ fontSize: 11, fontWeight: 600 }}>{fmtEur(current)}</Text>
                    </Flex>
                    <div style={{ height: 8, backgroundColor: 'rgba(128,128,128,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(current / max) * 100}%`, backgroundColor: color, borderRadius: 4 }} />
                    </div>
                </div>
            </Flex>
        </div>
    );
};

export const ComparisonBars = ({
    currentIncome, previousIncome, currentExpense, previousExpense,
}: ComparisonBarsProps) => {
    const { t } = useTranslation();
    const prevLabel = t('reports.previousMonth');
    const currLabel = t('reports.currentMonth');

    return (
        <Flex vertical gap={20}>
            <ComparisonRow
                label={t('reports.typeIn')}
                current={currentIncome}
                previous={previousIncome}
                color={COLOR_POSITIVE}
                deltaIsBad={false}
                prevLabel={prevLabel}
                currLabel={currLabel}
            />
            <ComparisonRow
                label={t('reports.typeOut')}
                current={currentExpense}
                previous={previousExpense}
                color={COLOR_NEGATIVE}
                deltaIsBad={true}
                prevLabel={prevLabel}
                currLabel={currLabel}
            />
        </Flex>
    );
};

interface SparklineProps {
    values: number[];
    color?: string;
    height?: number;
}

export const Sparkline = ({ values, color = COLOR_ACCENT, height = 32 }: SparklineProps) => {
    if (!values || values.length < 2) return null;
    const w = 100;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = w / (values.length - 1);
    const points = values
        .map((v, i) => `${(i * stepX).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
        .join(' ');
    const areaPoints = `0,${height} ${points} ${w},${height}`;
    return (
        <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block', marginTop: 8 }}>
            <polygon points={areaPoints} fill={color} fillOpacity={0.18} />
            <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
    );
};

interface LineChartProps {
    data: LineData[];
}

export const NetBalanceLineChart = ({ data }: LineChartProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

    const config = {
        data,
        xField: 'label',
        yField: 'value',
        point: {
            size: 4,
            shape: 'square',
        },

        lineStyle: {
            lineWidth: 2,
        },
        theme: isDark ? 'dark' : undefined,
        xAxis: {
            label: {
                style: {
                    fill: isDark ? '#ffffff' : '#000000',
                },
            },
        },
        yAxis: {
            label: {
                style: {
                    fill: isDark ? '#ffffff' : '#000000',
                },
            },
        },
    };

    return (
        <>
            <TooltipGlobalStyles isDark={isDark} />
            <Line {...config} />
        </>
    );
};
