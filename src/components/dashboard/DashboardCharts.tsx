// Grafici della dashboard desktop. Tutti SVG/DOM fatti a mano: la torta era l'ultimo
// grafico su G2 (`@ant-design/plots`), e da sola trascinava un chunk da 1,26 MB
// (375 kB gzip: G2, g-lite, lodash, d3-geo…) scaricato all'apertura della dashboard.
import { memo, useState } from 'react';
import { Flex, theme, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../contexts/PreferencesContext';
import { CHART_CATEGORICAL, FONT_SIZE, RADIUS, getSemanticColors } from '../../theme/tokens';
import { EmptyState } from '../common/EmptyState';
import { formatMoney, formatPercent } from '../../utils/format';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

export { TrendDualChart } from './TrendDualChart';

interface PieChartProps {
    data: { type: string; value: number }[];
    centerLabel?: string;
}

const DONUT_SIZE = 220;
const DONUT_STROKE = 30;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2 - 4; // margine per lo spessore in hover
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
// Stacco fra due fette, in px lungo la circonferenza
const SEGMENT_GAP = 2;

/**
 * Ciambella con legenda a destra e totale al centro. Ogni fetta è un cerchio con
 * `stroke-dasharray`: niente calcolo di archi, e il caso "una sola categoria al 100%"
 * (che con i path ad arco degenera) è un cerchio pieno senza casi speciali.
 */
const GenericPieChartInner = ({ data, centerLabel }: PieChartProps) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const currency = useDefaultCurrency();
    const [active, setActive] = useState<number | null>(null);

    const slices = (data ?? []).filter(d => d.value > 0);
    if (slices.length === 0) return <EmptyState description={t('charts.noData')} />;

    const total = slices.reduce((sum, d) => sum + d.value, 0);
    const gap = slices.length > 1 ? SEGMENT_GAP : 0;
    // Ciclo nel corpo del render (non dentro una callback di map): il React Compiler
    // vieta di riassegnare una variabile da una closure.
    const arcs: (PieChartProps['data'][number] & { color: string; pct: number; dash: number; offset: number })[] = [];
    let offset = 0;
    for (const [i, d] of slices.entries()) {
        const length = (d.value / total) * DONUT_CIRCUMFERENCE;
        arcs.push({
            ...d,
            color: CHART_CATEGORICAL[i % CHART_CATEGORICAL.length],
            pct: (d.value / total) * 100,
            dash: Math.max(length - gap, 0.5),
            offset,
        });
        offset += length;
    }
    const activeArc = active != null ? arcs[active] : null;
    const label = centerLabel ?? t('reports.total');
    const center = DONUT_SIZE / 2;

    return (
        <Flex wrap gap={24} align="center" justify="center" style={{ minHeight: DONUT_SIZE }}>
            <div style={{ position: 'relative', width: DONUT_SIZE, height: DONUT_SIZE, flexShrink: 0 }}>
                <svg
                    width={DONUT_SIZE}
                    height={DONUT_SIZE}
                    viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
                    role="img"
                    aria-label={`${label}: ${formatMoney(total, currency)}. ${arcs.map(a => `${a.type} ${formatPercent(a.pct)}`).join(', ')}`}
                    onMouseLeave={() => setActive(null)}
                >
                    {/* rotate(-90): la prima fetta parte da ore 12, in senso orario */}
                    <g transform={`rotate(-90 ${center} ${center})`}>
                        {arcs.map((a, i) => (
                            <circle
                                key={a.type}
                                cx={center}
                                cy={center}
                                r={DONUT_RADIUS}
                                fill="none"
                                stroke={a.color}
                                strokeWidth={active === i ? DONUT_STROKE + 8 : DONUT_STROKE}
                                strokeDasharray={`${a.dash} ${DONUT_CIRCUMFERENCE}`}
                                strokeDashoffset={-a.offset}
                                opacity={active == null || active === i ? 1 : 0.45}
                                style={{ transition: 'stroke-width 0.15s, opacity 0.15s', cursor: 'pointer' }}
                                onMouseEnter={() => setActive(i)}
                            />
                        ))}
                    </g>
                </svg>
                {/* Centro: categoria in hover, altrimenti il totale */}
                <Flex
                    vertical
                    align="center"
                    justify="center"
                    style={{ position: 'absolute', inset: DONUT_STROKE + 10, pointerEvents: 'none', textAlign: 'center' }}
                >
                    <Typography.Text type="secondary" ellipsis style={{ fontSize: FONT_SIZE.sm, maxWidth: '100%' }}>
                        {activeArc ? activeArc.type : label}
                    </Typography.Text>
                    <Typography.Text strong style={{ fontSize: FONT_SIZE.xxl, lineHeight: 1.3 }}>
                        {formatMoney(activeArc ? activeArc.value : total, currency)}
                    </Typography.Text>
                    {activeArc && (
                        <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                            {formatPercent(activeArc.pct)}
                        </Typography.Text>
                    )}
                </Flex>
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, maxWidth: '100%' }}>
                {arcs.map((a, i) => (
                    <li
                        key={a.type}
                        onMouseEnter={() => setActive(i)}
                        onMouseLeave={() => setActive(null)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: FONT_SIZE.sm,
                            color: token.colorText,
                            opacity: active == null || active === i ? 1 : 0.55,
                            cursor: 'default',
                            minWidth: 0,
                        }}
                    >
                        <span aria-hidden style={{ width: 10, height: 10, borderRadius: RADIUS.xs, backgroundColor: a.color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.type}</span>
                        <span style={{ color: token.colorTextSecondary, flexShrink: 0 }}>{formatPercent(a.pct)}</span>
                    </li>
                ))}
            </ul>
        </Flex>
    );
};

interface ComparisonBarsProps {
    currentIncome: number;
    previousIncome: number;
    currentExpense: number;
    previousExpense: number;
    /**
     * Etichetta del periodo corrente (es. "Ottobre 2026"). L'utente può scegliere un mese
     * qualsiasi, quindi "Mese corrente" è solo il fallback. Stessa firma in
     * DashboardChartsMobile: DashboardPage carica in lazy l'uno o l'altro modulo.
     */
    currentLabel?: string;
    /** Etichetta del periodo di confronto (fallback: "Mese precedente"). */
    previousLabel?: string;
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
    currentIncome, previousIncome, currentExpense, previousExpense, currentLabel, previousLabel,
}: ComparisonBarsProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');
    const prevLabel = previousLabel ?? t('reports.previousMonth');
    const currLabel = currentLabel ?? t('reports.currentMonth');

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

export { Sparkline } from './Sparkline';

// memo: DashboardPage ri-renderizza a ogni settle di query e cambio di trendMonths.
export const GenericPieChart = memo(GenericPieChartInner);
