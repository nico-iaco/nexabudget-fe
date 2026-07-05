import { useEffect, useMemo, useRef, useState } from 'react';
import { Flex, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { FONT_SIZE, RADIUS, SHADOW, getSemanticColors } from '../../theme/tokens';
import { usePreferences } from '../../contexts/PreferencesContext';
import { EmptyState } from '../common/EmptyState';

const { Text } = Typography;

export interface BalanceTrendChartPoint {
    year: number;
    month: number;
    label: string;
    monthlyNet: number;
    closingBalance: number;
}

interface Props {
    points: BalanceTrendChartPoint[];
    currency: string;
    locale: string;
    height?: number;
}

const formatTickShort = (v: number): string => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
    if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
    return v.toFixed(0);
};

export const BalanceTrendChart = ({ points, currency, locale, height = 300 }: Props) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerW, setContainerW] = useState(0);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const currencyFmt = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'currency', currency }),
        [locale, currency],
    );
    const signedCurrencyFmt = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'currency', currency, signDisplay: 'exceptZero' }),
        [locale, currency],
    );

    if (!points || points.length === 0) return <EmptyState description={t('charts.noData')} />;

    const N = points.length;
    const MARGIN_LEFT = 64;
    const MARGIN_RIGHT = 16;
    const MARGIN_TOP = 16;
    const MARGIN_BOTTOM = 32;
    const minColW = 56;

    const naturalW = N * minColW + MARGIN_LEFT + MARGIN_RIGHT;
    const measuredW = containerW || naturalW;
    const fits = naturalW <= measuredW;
    const totalW = fits ? measuredW : naturalW;
    const plotW = Math.max(totalW - MARGIN_LEFT - MARGIN_RIGHT, 1);
    const plotH = Math.max(height - MARGIN_TOP - MARGIN_BOTTOM, 1);
    const colW = plotW / Math.max(N - 1, 1);

    const closings = points.map(p => p.closingBalance);
    const yMaxRaw = Math.max(...closings, 0);
    const yMinRaw = Math.min(...closings, 0);
    const pad = (yMaxRaw - yMinRaw) * 0.08 || Math.max(Math.abs(yMaxRaw), 1) * 0.1;
    const yMax = yMaxRaw + pad;
    const yMin = yMinRaw - pad;
    const span = (yMax - yMin) || 1;

    const yToPx = (v: number) => MARGIN_TOP + ((yMax - v) / span) * plotH;
    const zeroY = yToPx(0);
    const xCenter = (i: number) => MARGIN_LEFT + (N === 1 ? plotW / 2 : i * colW);

    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => yMin + (span * i) / tickCount);

    const axisColor = token.colorTextSecondary;
    const gridColor = token.colorSplit;
    const zeroColor = token.colorTextTertiary;

    const labelStep = colW < 56 ? Math.ceil(56 / Math.max(colW, 1)) : 1;

    const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * totalW;
        const localX = x - MARGIN_LEFT;
        if (localX < -colW / 2 || localX > plotW + colW / 2) {
            setHoverIdx(null);
            return;
        }
        const idx = Math.min(N - 1, Math.max(0, Math.round(localX / colW)));
        setHoverIdx(idx);
    };

    const polyline = points.map((p, i) => `${xCenter(i)},${yToPx(p.closingBalance)}`).join(' ');
    const areaPath = `M ${xCenter(0)},${zeroY} L ${points
        .map((p, i) => `${xCenter(i)},${yToPx(p.closingBalance)}`)
        .join(' L ')} L ${xCenter(N - 1)},${zeroY} Z`;

    const tooltipW = 220;
    const tooltipLeft = hoverIdx != null
        ? Math.max(4, Math.min(xCenter(hoverIdx) + 12, totalW - tooltipW - 4))
        : 0;
    const hoverPoint = hoverIdx != null ? points[hoverIdx] : null;

    return (
        <div ref={containerRef}>
            <Flex gap={16} style={{ marginBottom: 6 }} wrap>
                <Flex align="center" gap={6}>
                    <span style={{ display: 'inline-block', width: 14, height: 2, backgroundColor: token.colorPrimary }} />
                    <Text style={{ fontSize: FONT_SIZE.sm }}>{t('reports.balanceTrend.closingBalance')}</Text>
                </Flex>
            </Flex>

            <div style={{ overflowX: fits ? 'visible' : 'auto', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
                <svg
                    width={totalW}
                    height={height}
                    viewBox={`0 0 ${totalW} ${height}`}
                    style={{ display: 'block' }}
                    onMouseMove={handleMove}
                    onMouseLeave={() => setHoverIdx(null)}
                >
                    {ticks.map((tv, i) => {
                        const y = yToPx(tv);
                        const isZero = Math.abs(tv) < 1e-6;
                        return (
                            <g key={i}>
                                <line
                                    x1={MARGIN_LEFT}
                                    x2={totalW - MARGIN_RIGHT}
                                    y1={y}
                                    y2={y}
                                    stroke={isZero ? zeroColor : gridColor}
                                    strokeDasharray={isZero ? '4 3' : '0'}
                                />
                                <text
                                    x={MARGIN_LEFT - 8}
                                    y={y + 3}
                                    textAnchor="end"
                                    fontSize={FONT_SIZE.xxs}
                                    fill={axisColor}
                                >
                                    {formatTickShort(tv)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Zero baseline highlight */}
                    {yMin < 0 && yMax > 0 && (
                        <line
                            x1={MARGIN_LEFT}
                            x2={totalW - MARGIN_RIGHT}
                            y1={zeroY}
                            y2={zeroY}
                            stroke={zeroColor}
                            strokeWidth={1.2}
                            strokeDasharray="4 3"
                        />
                    )}

                    <path d={areaPath} fill={token.colorPrimary} opacity={0.12} />
                    <polyline points={polyline} fill="none" stroke={token.colorPrimary} strokeWidth={2} />

                    {points.map((p, i) => (
                        <circle
                            key={`${p.year}-${p.month}`}
                            cx={xCenter(i)}
                            cy={yToPx(p.closingBalance)}
                            r={hoverIdx === i ? 4.5 : 2.5}
                            fill={token.colorPrimary}
                        />
                    ))}

                    {hoverIdx != null && (
                        <line
                            x1={xCenter(hoverIdx)}
                            x2={xCenter(hoverIdx)}
                            y1={MARGIN_TOP}
                            y2={MARGIN_TOP + plotH}
                            stroke={axisColor}
                            strokeDasharray="3 3"
                            opacity={0.6}
                        />
                    )}

                    {points.map((p, i) => (
                        i % labelStep === 0 || i === N - 1 ? (
                            <text
                                key={`l-${p.year}-${p.month}`}
                                x={xCenter(i)}
                                y={height - 10}
                                textAnchor="middle"
                                fontSize={FONT_SIZE.xxs}
                                fill={axisColor}
                            >
                                {p.label}
                            </text>
                        ) : null
                    ))}
                </svg>

                {hoverPoint && hoverIdx != null && (
                    <div
                        style={{
                            position: 'absolute',
                            left: tooltipLeft,
                            top: MARGIN_TOP,
                            width: tooltipW,
                            background: token.colorBgElevated,
                            color: token.colorText,
                            border: `1px solid ${gridColor}`,
                            padding: '8px 10px',
                            borderRadius: RADIUS.md,
                            fontSize: FONT_SIZE.sm,
                            pointerEvents: 'none',
                            boxShadow: SHADOW.tooltip,
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{hoverPoint.label}</div>
                        <Flex justify="space-between" gap={12}>
                            <span>{t('reports.balanceTrend.closingBalance')}</span>
                            <span style={{ fontWeight: 500 }}>{currencyFmt.format(hoverPoint.closingBalance)}</span>
                        </Flex>
                        <Flex justify="space-between" gap={12}>
                            <span>{t('reports.balanceTrend.monthlyNet')}</span>
                            <span
                                style={{
                                    fontWeight: 500,
                                    color: hoverPoint.monthlyNet === 0
                                        ? undefined
                                        : hoverPoint.monthlyNet > 0
                                            ? semantic.positive
                                            : semantic.negative,
                                }}
                            >
                                {signedCurrencyFmt.format(hoverPoint.monthlyNet)}
                            </span>
                        </Flex>
                    </div>
                )}
            </div>
        </div>
    );
};
