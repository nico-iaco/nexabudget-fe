import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { Flex, theme, Typography } from 'antd';
import dayjs from 'dayjs';
import { FONT_SIZE, RADIUS, SHADOW } from '../../theme/tokens';
import { formatDate, formatMoneyOrNA, formatNumber } from '../../utils/format';

const { Text } = Typography;

export interface LineSeries {
    key: string;
    label: string;
    color: string;
    /** Spessore del tratto (default 2). */
    width?: number;
}

export interface LineChartPoint {
    /** yyyy-MM-dd */
    date: string;
    /** Valore per serie; `null` = non disponibile (non è zero: la linea si interrompe). */
    values: Record<string, number | null>;
}

interface Props {
    points: LineChartPoint[];
    series: LineSeries[];
    currency: string;
    height?: number;
    ariaLabel: string;
}

const MARGIN = { left: 64, right: 16, top: 12, bottom: 28 };
const TOOLTIP_W = 220;

const VISUALLY_HIDDEN: CSSProperties = {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
    overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

// Intero con separatori fino a 10 M: l'abbreviazione "10k" faceva coincidere tick vicini.
const formatTickShort = (v: number): string => {
    const abs = Math.abs(v);
    if (abs >= 10_000_000) return `${formatNumber(v / 1_000_000, 0)}M`;
    return formatNumber(v, 0);
};

/**
 * Linee multi-serie su asse temporale, scritte a mano in SVG come gli altri grafici
 * (niente libreria). Un valore `null` interrompe la linea invece di precipitare a zero:
 * serve agli storici che partono dal giorno di attivazione, senza backfill.
 */
export const SeriesLineChart = ({ points, series, currency, height = 280, ariaLabel }: Props) => {
    const { token } = theme.useToken();
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const N = points.length;
    const W = Math.max(width, 280);
    const plotW = W - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;

    const times = points.map(p => dayjs(p.date).valueOf());
    const tMin = times[0] ?? 0;
    const tMax = times[N - 1] ?? 0;
    const xOf = (i: number) =>
        MARGIN.left + (tMax === tMin ? plotW / 2 : ((times[i] - tMin) / (tMax - tMin)) * plotW);

    const all = points.flatMap(p => series.map(s => p.values[s.key])).filter(
        (v): v is number => v !== null && v !== undefined && Number.isFinite(v),
    );
    const vMaxRaw = all.length ? Math.max(...all) : 1;
    const vMinRaw = all.length ? Math.min(...all) : 0;
    const pad = (vMaxRaw - vMinRaw) * 0.1 || Math.max(Math.abs(vMaxRaw), 1) * 0.1;
    const yMax = vMaxRaw + pad;
    // Con soli valori non negativi l'asse non scende sotto zero (niente tick "-2.207").
    const yMin = vMinRaw >= 0 ? Math.max(0, vMinRaw - pad) : vMinRaw - pad;
    const span = yMax - yMin || 1;
    const yOf = (v: number) => MARGIN.top + ((yMax - v) / span) * plotH;

    const ticks = Array.from({ length: 5 }, (_, i) => yMin + (span * i) / 4);
    const xTickIdx = N <= 1
        ? [0]
        : Array.from(new Set(Array.from({ length: Math.min(5, N) }, (_, i) => Math.round((i * (N - 1)) / (Math.min(5, N) - 1)))));
    const longRange = tMax - tMin > 120 * 86_400_000;
    const tickLabel = (i: number) => dayjs(points[i].date).format(longRange ? 'MMM YY' : 'DD/MM');

    // Segmenti continui di una serie: un null chiude il segmento.
    const segmentsOf = (key: string): number[][] => {
        const segs: number[][] = [];
        let cur: number[] = [];
        points.forEach((p, i) => {
            const v = p.values[key];
            if (v === null || v === undefined || !Number.isFinite(v)) {
                if (cur.length) segs.push(cur);
                cur = [];
            } else cur.push(i);
        });
        if (cur.length) segs.push(cur);
        return segs;
    };

    const nearestIndex = (clientX: number, rect: DOMRect): number => {
        const x = ((clientX - rect.left) / rect.width) * W;
        let best = 0;
        for (let i = 1; i < N; i++) if (Math.abs(xOf(i) - x) < Math.abs(xOf(best) - x)) best = i;
        return best;
    };

    const handlePointer = (e: PointerEvent<SVGSVGElement>) => {
        if (N === 0) return;
        const idx = nearestIndex(e.clientX, e.currentTarget.getBoundingClientRect());
        setHoverIdx(prev => (prev === idx ? prev : idx));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') return setHoverIdx(null);
        const cur = hoverIdx ?? N - 1;
        const next = e.key === 'ArrowLeft' ? Math.max(0, cur - 1)
            : e.key === 'ArrowRight' ? Math.min(N - 1, cur + 1)
                : e.key === 'Home' ? 0 : e.key === 'End' ? N - 1 : null;
        if (next === null) return;
        e.preventDefault();
        setHoverIdx(next);
    };

    // Al tocco non c'è "mouse leave": il tooltip si chiude toccando fuori dal grafico.
    const tooltipOpen = hoverIdx !== null;
    useEffect(() => {
        if (!tooltipOpen) return;
        const onDown = (e: globalThis.PointerEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) setHoverIdx(null);
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [tooltipOpen]);

    const hover = hoverIdx !== null ? points[hoverIdx] : null;
    const describe = (p: LineChartPoint) =>
        `${formatDate(p.date)}: ${series.map(s => `${s.label} ${formatMoneyOrNA(p.values[s.key], currency)}`).join(', ')}`;
    const tooltipLeft = hoverIdx !== null
        ? (xOf(hoverIdx) + 12 + TOOLTIP_W <= W - 4 ? xOf(hoverIdx) + 12 : Math.max(4, xOf(hoverIdx) - 12 - TOOLTIP_W))
        : 0;

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <Flex gap={16} wrap style={{ marginBottom: 6 }}>
                {series.map(s => (
                    <Flex key={s.key} align="center" gap={6}>
                        <span aria-hidden style={{ display: 'inline-block', width: 14, height: 3, borderRadius: 2, backgroundColor: s.color }} />
                        <Text style={{ fontSize: FONT_SIZE.sm }}>{s.label}</Text>
                    </Flex>
                ))}
            </Flex>

            <div
                tabIndex={0}
                role="group"
                aria-label={ariaLabel}
                onFocus={e => {
                    if (e.target !== e.currentTarget) return;
                    setFocused(true);
                    setHoverIdx(prev => prev ?? N - 1);
                }}
                onBlur={() => { setFocused(false); setHoverIdx(null); }}
                onKeyDown={handleKeyDown}
                style={{ position: 'relative' }}
            >
                <svg
                    width={W}
                    height={height}
                    viewBox={`0 0 ${W} ${height}`}
                    style={{ display: 'block', maxWidth: '100%' }}
                    role="img"
                    aria-label={ariaLabel}
                    onPointerDown={handlePointer}
                    onPointerMove={handlePointer}
                    onPointerLeave={e => { if (e.pointerType !== 'touch') setHoverIdx(null); }}
                    onPointerCancel={() => setHoverIdx(null)}
                >
                    {ticks.map((tv, i) => (
                        <g key={i}>
                            <line x1={MARGIN.left} x2={W - MARGIN.right} y1={yOf(tv)} y2={yOf(tv)} stroke={token.colorSplit} />
                            <text x={MARGIN.left - 8} y={yOf(tv) + 3} textAnchor="end" fontSize={FONT_SIZE.xxs} fill={token.colorTextSecondary}>
                                {formatTickShort(tv)}
                            </text>
                        </g>
                    ))}
                    {yMin < 0 && yMax > 0 && (
                        <line x1={MARGIN.left} x2={W - MARGIN.right} y1={yOf(0)} y2={yOf(0)}
                              stroke={token.colorTextTertiary} strokeDasharray="4 3" />
                    )}

                    {series.map(s => segmentsOf(s.key).map((seg, si) => (
                        seg.length === 1
                            ? <circle key={`${s.key}-${si}`} cx={xOf(seg[0])} cy={yOf(points[seg[0]].values[s.key] as number)} r={3.5} fill={s.color} />
                            : <polyline
                                key={`${s.key}-${si}`}
                                fill="none"
                                stroke={s.color}
                                strokeWidth={s.width ?? 2}
                                strokeLinejoin="round"
                                points={seg.map(i => `${xOf(i)},${yOf(points[i].values[s.key] as number)}`).join(' ')}
                            />
                    )))}

                    {hoverIdx !== null && (
                        <>
                            <line x1={xOf(hoverIdx)} x2={xOf(hoverIdx)} y1={MARGIN.top} y2={MARGIN.top + plotH}
                                  stroke={token.colorTextSecondary} strokeDasharray="3 3" opacity={0.6} />
                            {series.map(s => {
                                const v = points[hoverIdx].values[s.key];
                                return v === null || v === undefined
                                    ? null
                                    : <circle key={s.key} cx={xOf(hoverIdx)} cy={yOf(v)} r={4} fill={s.color} stroke={token.colorBgContainer} strokeWidth={1.5} />;
                            })}
                        </>
                    )}

                    {xTickIdx.map(i => (
                        <text key={i} x={xOf(i)} y={height - 8}
                              textAnchor={i === 0 && N > 1 ? 'start' : i === N - 1 && N > 1 ? 'end' : 'middle'}
                              fontSize={FONT_SIZE.xxs} fill={token.colorTextSecondary}>
                            {tickLabel(i)}
                        </text>
                    ))}
                </svg>

                {hover && (
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute', left: tooltipLeft, top: MARGIN.top, width: TOOLTIP_W,
                            background: token.colorBgElevated, color: token.colorText,
                            border: `1px solid ${token.colorSplit}`, padding: '8px 10px',
                            borderRadius: RADIUS.md, fontSize: FONT_SIZE.sm, pointerEvents: 'none',
                            boxShadow: SHADOW.tooltip,
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{formatDate(hover.date)}</div>
                        {series.map(s => (
                            <Flex key={s.key} justify="space-between" gap={12}>
                                <span style={{ color: s.color }}>{s.label}</span>
                                <span style={{ fontWeight: 500 }}>
                                    {/* null → "n/d": prima del primo snapshot il dato non esiste, non vale 0 */}
                                    {formatMoneyOrNA(hover.values[s.key], currency)}
                                </span>
                            </Flex>
                        ))}
                    </div>
                )}
            </div>

            <div aria-live="polite" style={VISUALLY_HIDDEN}>
                {focused && hover ? describe(hover) : ''}
            </div>
        </div>
    );
};
