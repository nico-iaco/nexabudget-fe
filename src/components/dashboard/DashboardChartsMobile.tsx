import { Empty, Flex, Progress, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { BarData } from '../../hooks/useDashboardData';
import { usePreferences } from '../../contexts/PreferencesContext';
import { COLOR_POSITIVE, COLOR_NEGATIVE, COLOR_ACCENT } from '../../theme/tokens';

export { TrendDualChart } from './TrendDualChart';

const { Text } = Typography;

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
    const sorted = [...data].sort((a, b) => b.value - a.value);
    return (
        <Flex vertical gap={10}>
            <Flex vertical align="center" style={{ marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {centerLabel ?? t('reports.total')}
                </Text>
                <Text strong style={{ fontSize: 18 }}>{formatCurrency(total)}</Text>
            </Flex>
            {sorted.map((item) => {
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                    <div key={item.type}>
                        <Flex justify="space-between" style={{ marginBottom: 2 }}>
                            <Text style={{ fontSize: 13 }}>{item.type}</Text>
                            <Text style={{ fontSize: 13 }} type="secondary">
                                {item.value.toFixed(2)} ({pct}%)
                            </Text>
                        </Flex>
                        <Progress
                            aria-label={`${item.type} ${pct}%`}
                            percent={pct}
                            showInfo={false}
                            size="small"
                            strokeColor={isDark ? '#177ddc' : '#1890ff'}
                        />
                    </div>
                );
            })}
        </Flex>
    );
};

interface BarChartProps {
    data: BarData[];
}

export const TrendBarChart = ({ data }: BarChartProps) => {
    const { t } = useTranslation();
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

    const months = [...new Set(data.map(d => d.month))];
    const maxValue = Math.max(...data.map(d => d.value), 1);

    const colorFor = (type: string) =>
        type === 'Entrate' ? COLOR_POSITIVE : COLOR_NEGATIVE;

    const types = [...new Set(data.map(d => d.type))];

    return (
        <div>
            {/* Legend */}
            <Flex gap={12} style={{ marginBottom: 8 }}>
                {types.map(type => (
                    <Flex key={type} align="center" gap={4}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colorFor(type) }} />
                        <Text style={{ fontSize: 11 }}>{type}</Text>
                    </Flex>
                ))}
            </Flex>

            {/* Bars */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'flex', gap: 6, minWidth: months.length * 52, alignItems: 'flex-end', height: 140, paddingBottom: 20, position: 'relative' }}>
                    {months.map(month => {
                        const monthData = data.filter(d => d.month === month);
                        return (
                            <div
                                key={month}
                                style={{ flex: 1, minWidth: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
                            >
                                <Flex gap={2} align="flex-end" style={{ width: '100%', height: 'calc(100% - 18px)' }}>
                                    {monthData.map(d => (
                                        <div
                                            key={d.type}
                                            title={`${d.type}: ${d.value.toFixed(2)} €`}
                                            style={{
                                                flex: 1,
                                                height: `${Math.max((d.value / maxValue) * 100, 2)}%`,
                                                backgroundColor: colorFor(d.type),
                                                borderRadius: '2px 2px 0 0',
                                                opacity: 0.85,
                                                minHeight: 2,
                                            }}
                                        />
                                    ))}
                                </Flex>
                                <Text style={{ fontSize: 9, marginTop: 3, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                    {month}
                                </Text>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};


interface ComparisonBarsProps {
    currentIncome: number;
    previousIncome: number;
    currentExpense: number;
    previousExpense: number;
}

export const ComparisonBars = ({
    currentIncome, previousIncome, currentExpense, previousExpense,
}: ComparisonBarsProps) => {
    const { t } = useTranslation();
    const max = Math.max(currentIncome, previousIncome, currentExpense, previousExpense, 1);

    const Row = ({ label, current, previous, color }: { label: string; current: number; previous: number; color: string }) => (
        <div>
            <Flex justify="space-between" style={{ marginBottom: 2 }}>
                <Text style={{ fontSize: 12 }}>{label}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                    {formatCurrency(current)} <Text type="secondary" style={{ fontSize: 10 }}>({formatCurrency(previous)})</Text>
                </Text>
            </Flex>
            <div style={{ position: 'relative', height: 14 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: 6, width: `${(previous / max) * 100}%`, backgroundColor: '#bfbfbf', borderRadius: 2 }} />
                <div style={{ position: 'absolute', left: 0, top: 8, height: 6, width: `${(current / max) * 100}%`, backgroundColor: color, borderRadius: 2 }} />
            </div>
        </div>
    );

    return (
        <Flex vertical gap={12}>
            <Flex gap={12} style={{ fontSize: 11 }}>
                <Flex gap={4} align="center">
                    <div style={{ width: 8, height: 8, backgroundColor: '#bfbfbf', borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }}>{t('reports.previousMonth')}</Text>
                </Flex>
                <Flex gap={4} align="center">
                    <div style={{ width: 8, height: 8, backgroundColor: COLOR_ACCENT, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11 }}>{t('reports.currentMonth')}</Text>
                </Flex>
            </Flex>
            <Row label={t('reports.typeIn')} current={currentIncome} previous={previousIncome} color={COLOR_POSITIVE} />
            <Row label={t('reports.typeOut')} current={currentExpense} previous={previousExpense} color={COLOR_NEGATIVE} />
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
        <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            <polygon points={areaPoints} fill={color} fillOpacity={0.18} />
            <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
    );
};
