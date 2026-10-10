import { Flex, Progress, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { FONT_SIZE, RADIUS, getSemanticColors } from '../../theme/tokens';
import { usePreferences } from '../../contexts/PreferencesContext';
import { EmptyState } from '../common/EmptyState';
import { formatMoney, formatPercent } from '../../utils/format';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

export { TrendDualChart } from './TrendDualChart';

const { Text } = Typography;

interface PieChartProps {
    data: { type: string; value: number }[];
    centerLabel?: string;
}

export const GenericPieChart = ({ data, centerLabel }: PieChartProps) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const currency = useDefaultCurrency();
    if (!data || data.length === 0) return <EmptyState description={t('charts.noData')} />;

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const sorted = [...data].sort((a, b) => b.value - a.value);
    return (
        <Flex vertical gap={10}>
            <Flex vertical align="center" style={{ marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                    {centerLabel ?? t('reports.total')}
                </Text>
                <Text strong style={{ fontSize: FONT_SIZE.xxl }}>{formatMoney(total, currency)}</Text>
            </Flex>
            {sorted.map((item) => {
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                    <div key={item.type}>
                        <Flex justify="space-between" style={{ marginBottom: 2 }}>
                            <Text style={{ fontSize: FONT_SIZE.md }}>{item.type}</Text>
                            <Text style={{ fontSize: FONT_SIZE.md }} type="secondary">
                                {formatMoney(item.value, currency)} ({formatPercent(pct, 0)})
                            </Text>
                        </Flex>
                        <Progress
                            aria-label={`${item.type} ${formatPercent(pct, 0)}`}
                            percent={pct}
                            showInfo={false}
                            size="small"
                            strokeColor={token.colorPrimary}
                        />
                    </div>
                );
            })}
        </Flex>
    );
};

interface ComparisonRowProps {
    label: string;
    current: number;
    previous: number;
    /** Valore di riferimento per la larghezza percentuale delle barre */
    max: number;
    /** Colore della barra "mese corrente" */
    color: string;
    /** Colore della barra "mese precedente" */
    trackColor: string;
}

/**
 * Riga di confronto mese corrente / mese precedente.
 * Definita a livello di modulo (non dentro ComparisonBars) così l'identità del
 * componente resta stabile fra i render e React non rimonta il sottoalbero.
 */
const ComparisonRow = ({ label, current, previous, max, color, trackColor }: ComparisonRowProps) => {
    const currency = useDefaultCurrency();
    return (
    <div>
        <Flex justify="space-between" style={{ marginBottom: 2 }}>
            <Text style={{ fontSize: FONT_SIZE.sm }}>{label}</Text>
            <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>
                {formatMoney(current, currency)} <Text type="secondary" style={{ fontSize: FONT_SIZE.xxs }}>({formatMoney(previous, currency)})</Text>
            </Text>
        </Flex>
        <div style={{ position: 'relative', height: 14 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: 6, width: `${(previous / max) * 100}%`, backgroundColor: trackColor, borderRadius: RADIUS.xs }} />
            <div style={{ position: 'absolute', left: 0, top: 8, height: 6, width: `${(current / max) * 100}%`, backgroundColor: color, borderRadius: RADIUS.xs }} />
        </div>
    </div>
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
     * DashboardCharts: DashboardPage carica in lazy l'uno o l'altro modulo.
     */
    currentLabel?: string;
    /** Etichetta del periodo di confronto (fallback: "Mese precedente"). */
    previousLabel?: string;
}

export const ComparisonBars = ({
    currentIncome, previousIncome, currentExpense, previousExpense, currentLabel, previousLabel,
}: ComparisonBarsProps) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');
    const max = Math.max(currentIncome, previousIncome, currentExpense, previousExpense, 1);

    return (
        <Flex vertical gap={12}>
            <Flex gap={12} style={{ fontSize: FONT_SIZE.xs }}>
                <Flex gap={4} align="center">
                    <div aria-hidden style={{ width: 8, height: 8, backgroundColor: token.colorTextQuaternary, borderRadius: RADIUS.xs, flexShrink: 0 }} />
                    <Text style={{ fontSize: FONT_SIZE.xs }}>{previousLabel ?? t('reports.previousMonth')}</Text>
                </Flex>
                <Flex gap={4} align="center">
                    {/* Le barre del periodo corrente sono verdi (entrate) e rosse (uscite):
                        il campione le riporta entrambe, non il colore primario. */}
                    <div
                        aria-hidden
                        style={{
                            width: 12,
                            height: 8,
                            background: `linear-gradient(90deg, ${semantic.positive} 50%, ${semantic.negative} 50%)`,
                            borderRadius: RADIUS.xs,
                            flexShrink: 0,
                        }}
                    />
                    <Text style={{ fontSize: FONT_SIZE.xs }}>{currentLabel ?? t('reports.currentMonth')}</Text>
                </Flex>
            </Flex>
            <ComparisonRow label={t('reports.typeIn')} current={currentIncome} previous={previousIncome} max={max} color={semantic.positive} trackColor={token.colorTextQuaternary} />
            <ComparisonRow label={t('reports.typeOut')} current={currentExpense} previous={previousExpense} max={max} color={semantic.negative} trackColor={token.colorTextQuaternary} />
        </Flex>
    );
};

export { Sparkline } from './Sparkline';
