// Importati da `@ant-design/plots`, non da `@ant-design/charts`: quest'ultimo è un barrel
// (`export * from '@ant-design/graphs'; export * from '@ant-design/plots';`) e
// `@ant-design/graphs` fa `import * as G6 from '@antv/g6'` più un modulo di preset a effetti
// collaterali, senza campo `sideEffects` — quindi l'intero motore di grafi G6, con
// @antv/algorithm, dagre, graphlib e d3-force-3d, era non-eliminabile e finiva in un chunk
// da 1,26 MB per tre soli tipi di grafico. `@ant-design/plots` dichiara `sideEffects: false`.
import { Column, Line, Pie } from '@ant-design/plots';
import { memo } from 'react';
import { Flex, theme, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { BarData, LineData } from '../../hooks/useDashboardData';
import { usePreferences } from '../../contexts/PreferencesContext';
import { FONT_SIZE, RADIUS, getSemanticColors } from '../../theme/tokens';
import { EmptyState } from '../common/EmptyState';
import type { GlobalToken } from 'antd/es/theme/interface';
import { formatMoney, formatPercent } from '../../utils/format';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

export { TrendDualChart } from './TrendDualChart';

// memo: reso dentro ciascuno dei tre grafici, quindi a ogni loro render venivano
// ricreati fino a tre <style> duplicati, e ogni inserzione invalida la CSSOM forzando
// un ricalcolo di stile su tutto il documento.
const TooltipGlobalStyles = memo(({ token }: { token: GlobalToken }) => (
    <style>{`
        .g2-tooltip {
            background-color: ${token.colorBgElevated} !important;
            color: ${token.colorText} !important;
            box-shadow: ${token.boxShadowSecondary} !important;
        }
        .g2-tooltip * {
            color: ${token.colorText} !important;
        }
        .g2-tooltip-title {
            color: ${token.colorText} !important;
        }
        .g2-tooltip-list-item-label {
             color: ${token.colorTextSecondary} !important;
        }
    `}</style>
));
TooltipGlobalStyles.displayName = 'TooltipGlobalStyles';

interface PieChartProps {
    data: { type: string; value: number }[];
    centerLabel?: string;
}

const GenericPieChartInner = ({ data, centerLabel }: PieChartProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    const { token } = theme.useToken();
    const currency = useDefaultCurrency();
    if (!data || data.length === 0) return <EmptyState description={t('charts.noData')} />;

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const enriched = data.map(d => ({
        ...d,
        _amount: `${formatMoney(d.value, currency)} (${formatPercent(total > 0 ? (d.value / total) * 100 : 0)})`,
    }));

    const config = {
        data: enriched,
        angleField: 'value',
        colorField: 'type',
        // Altezza fissa: impilata sopra la tabella (sotto xxl) la torta prendeva tutta la
        // larghezza della card e arrivava a ~400px di altezza.
        height: 280,
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
                style: { fontSize: `${FONT_SIZE.sm}px`, color: token.colorTextSecondary },
                content: centerLabel ?? t('reports.total'),
            },
            content: {
                style: { fontSize: `${FONT_SIZE.xxl}px`, fontWeight: 600, color: token.colorText },
                content: formatMoney(total, currency),
            },
        },
    };

    return (
        <>
            <TooltipGlobalStyles token={token} />
            <Pie {...config} />
        </>
    );
};

interface BarChartProps {
    data: BarData[];
}

const TrendBarChartInner = ({ data }: BarChartProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    const { token } = theme.useToken();
    if (!data || data.length === 0) return <EmptyState description={t('charts.noData')} />;

    const config = {
        data,
        xField: 'month',
        yField: 'value',
        colorField: 'type',
        isGroup: true,
        seriesField: 'type',
        theme: isDark ? 'dark' : undefined,
        columnStyle: { radius: [RADIUS.xs, RADIUS.xs, 0, 0] },
        legend: { position: 'top-left' as const },
        xAxis: { label: { style: { fill: token.colorText } } },
        yAxis: { label: { style: { fill: token.colorText } } },
        // Traduce le chiavi stabili IN/OUT nelle label localizzate per legenda e tooltip
        meta: {
            type: {
                formatter: (v: string) => v === 'IN' ? t('charts.income') : t('charts.expense'),
            },
        },
    };

    return (
        <>
            <TooltipGlobalStyles token={token} />
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
    const { token } = theme.useToken();
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');
    const max = Math.max(current, previous, 1);
    const delta = current - previous;
    const pct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
    const deltaPositive = delta >= 0;
    const deltaColor = (deltaIsBad ? deltaPositive : !deltaPositive) ? semantic.negative : semantic.positive;
    const DeltaIcon = deltaPositive ? ArrowUpOutlined : ArrowDownOutlined;
    const currency = useDefaultCurrency();

    return (
        <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
                <Text strong>{label}</Text>
                <Text style={{ color: deltaColor, fontSize: FONT_SIZE.md }}>
                    <DeltaIcon style={{ fontSize: FONT_SIZE.xs, marginRight: 4 }} />
                    {formatMoney(delta, currency, { signed: true })}
                    <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, marginLeft: 6 }}>
                        ({formatPercent(pct, 1, true)})
                    </Text>
                </Text>
            </Flex>
            <Flex vertical gap={4}>
                <div>
                    <Flex justify="space-between" style={{ marginBottom: 2 }}>
                        <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>{prevLabel}</Text>
                        <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>{formatMoney(previous, currency)}</Text>
                    </Flex>
                    <div style={{ height: 8, backgroundColor: token.colorFillSecondary, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(previous / max) * 100}%`, backgroundColor: token.colorTextQuaternary, borderRadius: RADIUS.sm }} />
                    </div>
                </div>
                <div>
                    <Flex justify="space-between" style={{ marginBottom: 2 }}>
                        <Text style={{ fontSize: FONT_SIZE.xs }}>{currLabel}</Text>
                        <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: 600 }}>{formatMoney(current, currency)}</Text>
                    </Flex>
                    <div style={{ height: 8, backgroundColor: token.colorFillSecondary, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(current / max) * 100}%`, backgroundColor: color, borderRadius: RADIUS.sm }} />
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
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');
    const prevLabel = t('reports.previousMonth');
    const currLabel = t('reports.currentMonth');

    return (
        <Flex vertical gap={20}>
            <ComparisonRow
                label={t('reports.typeIn')}
                current={currentIncome}
                previous={previousIncome}
                color={semantic.positive}
                deltaIsBad={false}
                prevLabel={prevLabel}
                currLabel={currLabel}
            />
            <ComparisonRow
                label={t('reports.typeOut')}
                current={currentExpense}
                previous={previousExpense}
                color={semantic.negative}
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

export const Sparkline = ({ values, color, height = 32 }: SparklineProps) => {
    const { token } = theme.useToken();
    const resolvedColor = color ?? token.colorPrimary;
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
            <polygon points={areaPoints} fill={resolvedColor} fillOpacity={0.18} />
            <polyline points={points} fill="none" stroke={resolvedColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
    );
};

interface LineChartProps {
    data: LineData[];
}

const NetBalanceLineChartInner = ({ data }: LineChartProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    const { token } = theme.useToken();
    if (!data || data.length === 0) return <EmptyState description={t('charts.noData')} />;

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
                    fill: token.colorText,
                },
            },
        },
        yAxis: {
            label: {
                style: {
                    fill: token.colorText,
                },
            },
        },
    };

    return (
        <>
            <TooltipGlobalStyles token={token} />
            <Line {...config} />
        </>
    );
};

// memo sui tre grafici che passano da G2: senza, qualunque render di DashboardPage
// (cambio di trendMonths, settle di una query, cambio di breakpoint) faceva ricostruire
// gli oggetti config e ri-disegnare la canvas con animazione.
export const GenericPieChart = memo(GenericPieChartInner);
export const TrendBarChart = memo(TrendBarChartInner);
export const NetBalanceLineChart = memo(NetBalanceLineChartInner);
