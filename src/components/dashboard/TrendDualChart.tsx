import { useEffect, useRef, useState } from 'react';
import { Empty, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TrendPoint } from '../../hooks/useDashboardData';
import { usePreferences } from '../../contexts/PreferencesContext';
import { COLOR_POSITIVE, COLOR_NEGATIVE, COLOR_ACCENT } from '../../theme/tokens';

const { Text } = Typography;

interface Props {
    points: TrendPoint[];
    height?: number;
}

const formatTick = (v: number): string => {
    const abs = Math.abs(v);
    if (abs >= 1000) return `${(v / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
    return v.toFixed(0);
};

const formatEur = (v: number): string =>
    `${v.toFixed(2)} €`;

const TooltipRow = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <Flex justify="space-between" gap={16} style={{ lineHeight: '18px' }}>
        <Flex align="center" gap={6}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
            <span>{label}</span>
        </Flex>
        <span style={{ fontWeight: 500 }}>{formatEur(value)}</span>
    </Flex>
);

export const TrendDualChart = ({ points, height = 280 }: Props) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerW, setContainerW] = useState(0);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    if (!points || points.length === 0) return <Empty description={t('charts.noData')} />;

    const incomeLabel = t('reports.typeIn');
    const expenseLabel = t('reports.typeOut');
    const netLabel = t('reports.net');

    const N = points.length;
    const MARGIN_LEFT = 48;
    const MARGIN_RIGHT = 16;
    const MARGIN_TOP = 12;
    const MARGIN_BOTTOM = 28;
    const minColW = 52;

    const naturalW = N * minColW + MARGIN_LEFT + MARGIN_RIGHT;
    const measuredW = containerW || naturalW;
    const fits = naturalW <= measuredW;
    const totalW = fits ? measuredW : naturalW;
    const plotW = Math.max(totalW - MARGIN_LEFT - MARGIN_RIGHT, 1);
    const plotH = Math.max(height - MARGIN_TOP - MARGIN_BOTTOM, 1);
    const colW = plotW / N;

    const yMax = Math.max(...points.map(p => Math.max(p.income, p.expense, p.net)), 1);
    const yMin = Math.min(...points.map(p => p.net), 0);
    const span = (yMax - yMin) || 1;

    const yToPx = (v: number) => MARGIN_TOP + ((yMax - v) / span) * plotH;
    const zeroY = yToPx(0);
    const xCenter = (i: number) => MARGIN_LEFT + (i + 0.5) * colW;

    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => yMin + (span * i) / tickCount);

    const BAR_W = Math.min(14, Math.max(4, colW * 0.32));
    const BAR_GAP = 2;
    const axisColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const zeroColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

    // Show every Nth label on narrow screens to avoid overlap.
    const labelStep = colW < 40 ? Math.ceil(40 / colW) : 1;

    const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * totalW;
        const localX = x - MARGIN_LEFT;
        if (localX < 0 || localX > plotW) { setHoverIdx(null); return; }
        const idx = Math.min(N - 1, Math.max(0, Math.floor(localX / colW)));
        setHoverIdx(idx);
    };

    const hoverPoint = hoverIdx != null ? points[hoverIdx] : null;

    // Tooltip horizontal placement: prefer right of cursor, flip if near right edge.
    const tooltipW = 180;
    const tooltipLeft = hoverIdx != null
        ? Math.min(xCenter(hoverIdx) + 12, totalW - tooltipW - 4)
        : 0;

    return (
        <div ref={containerRef}>
            {/* Legend */}
            <Flex gap={16} style={{ marginBottom: 6 }} wrap>
                <Flex align="center" gap={6}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, backgroundColor: COLOR_POSITIVE }} />
                    <Text style={{ fontSize: 12 }}>{incomeLabel}</Text>
                </Flex>
                <Flex align="center" gap={6}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, backgroundColor: COLOR_NEGATIVE }} />
                    <Text style={{ fontSize: 12 }}>{expenseLabel}</Text>
                </Flex>
                <Flex align="center" gap={6}>
                    <span style={{ display: 'inline-block', width: 14, height: 2, backgroundColor: COLOR_ACCENT }} />
                    <Text style={{ fontSize: 12 }}>{netLabel}</Text>
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
                    {/* Y grid + ticks */}
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
                                    x={MARGIN_LEFT - 6}
                                    y={y + 3}
                                    textAnchor="end"
                                    fontSize={10}
                                    fill={axisColor}
                                >
                                    {formatTick(tv)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Bars */}
                    {points.map((p, i) => {
                        const cx = xCenter(i);
                        const incomeY = yToPx(p.income);
                        const expenseY = yToPx(p.expense);
                        const dim = hoverIdx != null && hoverIdx !== i;
                        return (
                            <g key={p.month} opacity={dim ? 0.45 : 1}>
                                <rect
                                    x={cx - BAR_W - BAR_GAP / 2}
                                    y={incomeY}
                                    width={BAR_W}
                                    height={Math.max(zeroY - incomeY, 1)}
                                    fill={COLOR_POSITIVE}
                                    rx={2}
                                />
                                <rect
                                    x={cx + BAR_GAP / 2}
                                    y={expenseY}
                                    width={BAR_W}
                                    height={Math.max(zeroY - expenseY, 1)}
                                    fill={COLOR_NEGATIVE}
                                    rx={2}
                                />
                            </g>
                        );
                    })}

                    {/* Net line */}
                    <polyline
                        points={points.map((p, i) => `${xCenter(i)},${yToPx(p.net)}`).join(' ')}
                        fill="none"
                        stroke={COLOR_ACCENT}
                        strokeWidth={2}
                    />
                    {points.map((p, i) => (
                        <circle
                            key={p.month}
                            cx={xCenter(i)}
                            cy={yToPx(p.net)}
                            r={hoverIdx === i ? 4 : 2.5}
                            fill={COLOR_ACCENT}
                        />
                    ))}

                    {/* Hover guideline */}
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

                    {/* X labels */}
                    {points.map((p, i) => (
                        i % labelStep === 0 ? (
                            <text
                                key={p.month}
                                x={xCenter(i)}
                                y={height - 8}
                                textAnchor="middle"
                                fontSize={10}
                                fill={axisColor}
                            >
                                {p.month}
                            </text>
                        ) : null
                    ))}
                </svg>

                {/* Tooltip overlay */}
                {hoverPoint && hoverIdx != null && (
                    <div
                        style={{
                            position: 'absolute',
                            left: tooltipLeft,
                            top: MARGIN_TOP,
                            width: tooltipW,
                            background: isDark ? '#1f1f1f' : '#ffffff',
                            color: isDark ? '#ffffff' : '#000000',
                            border: `1px solid ${gridColor}`,
                            padding: '8px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            pointerEvents: 'none',
                            boxShadow: '0 3px 6px -4px rgba(0,0,0,0.32), 0 6px 16px 0 rgba(0,0,0,0.16)',
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{hoverPoint.month}</div>
                        <TooltipRow label={incomeLabel} value={hoverPoint.income} color={COLOR_POSITIVE} />
                        <TooltipRow label={expenseLabel} value={hoverPoint.expense} color={COLOR_NEGATIVE} />
                        <TooltipRow label={netLabel} value={hoverPoint.net} color={COLOR_ACCENT} />
                    </div>
                )}
            </div>
        </div>
    );
};
