import { Flex, Typography, theme } from 'antd';
import { CHART_CATEGORICAL, FONT_SIZE, RADIUS, SPACING, getSemanticColors } from '../../theme/tokens';
import { usePreferences } from '../../contexts/PreferencesContext';
import { formatMoneyOrNA, formatPercentOrNA } from '../../utils/format';
import { buildBarSegments } from '../../utils/investments';

const { Text } = Typography;

export interface AllocationRow {
    key: string;
    label: string;
    /** null = non disponibile (mostrato "n/d", non disegnato). */
    value: number | null;
    /** Percentuale già in centesimi, può essere negativa o null. */
    percent: number | null;
}

interface Props {
    rows: AllocationRow[];
    currency: string;
    'aria-label'?: string;
}

/**
 * Barra impilata + legenda. I segmenti usano solo i valori positivi; la legenda mostra i
 * valori reali (anche negativi, in rosso, o "n/d").
 */
export const AllocationBar = ({ rows, currency, 'aria-label': ariaLabel }: Props) => {
    const { token } = theme.useToken();
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');
    const colorOf = (key: string) => CHART_CATEGORICAL[rows.findIndex(r => r.key === key) % CHART_CATEGORICAL.length];
    const segments = buildBarSegments(rows);

    return (
        <div>
            <Flex
                role="img"
                aria-label={ariaLabel}
                style={{
                    height: 12, borderRadius: RADIUS.pill, overflow: 'hidden',
                    background: token.colorFillSecondary, marginBottom: SPACING.sm,
                }}
            >
                {segments.map(seg => (
                    <div key={seg.key} style={{ width: `${seg.share * 100}%`, background: colorOf(seg.key) }} />
                ))}
            </Flex>
            <Flex vertical gap={6}>
                {rows.map(row => (
                    <Flex key={row.key} align="center" justify="space-between" gap={SPACING.sm} wrap>
                        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: colorOf(row.key) }} />
                            <Text style={{ fontSize: FONT_SIZE.base }}>{row.label}</Text>
                        </Flex>
                        <Flex gap={SPACING.sm} align="baseline">
                            <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                                {formatMoneyOrNA(row.value, currency)}
                            </Text>
                            <Text strong style={{
                                minWidth: 56, textAlign: 'right',
                                color: row.percent !== null && row.percent < 0 ? semantic.negative : undefined,
                            }}>
                                {formatPercentOrNA(row.percent)}
                            </Text>
                        </Flex>
                    </Flex>
                ))}
            </Flex>
        </div>
    );
};
