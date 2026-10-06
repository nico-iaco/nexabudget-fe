import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Flex, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { FONT_SIZE, RADIUS, SHADOW, getSemanticColors } from '../../theme/tokens';
import { usePreferences } from '../../contexts/PreferencesContext';
import { EmptyState } from '../common/EmptyState';
import { formatMoney, formatNumber } from '../../utils/format';

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
    height?: number;
}

const formatTickShort = (v: number): string => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${formatNumber(v / 1_000_000, abs >= 10_000_000 ? 0 : 1)}M`;
    if (abs >= 1_000) return `${formatNumber(v / 1_000, abs >= 10_000 ? 0 : 1)}k`;
    return formatNumber(v, 0);
};

/** Testo leggibile solo dagli screen reader (live region del mese selezionato). */
const VISUALLY_HIDDEN: CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: 0,
};

/** Scorre il contenitore quanto basta per rendere visibile il punto in `x`. */
const revealX = (el: HTMLElement, x: number, pad: number) => {
    if (x - pad < el.scrollLeft) el.scrollLeft = x - pad;
    else if (x + pad > el.scrollLeft + el.clientWidth) el.scrollLeft = x + pad - el.clientWidth;
};

export const BalanceTrendChart = ({ points, currency, height = 300 }: Props) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');

    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [containerW, setContainerW] = useState(0);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    // true quando il grafico ha il focus: solo allora la live region annuncia il mese.
    const [focused, setFocused] = useState(false);
    // Rect memorizzata e invalidata a ingresso/uscita/scroll: `getBoundingClientRect()` a
    // ogni pointermove è una lettura di layout forzata (vedi TrendDualChart).
    const rectRef = useRef<DOMRect | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Qualsiasi scroll (pagina o contenitore orizzontale) sposta il riquadro dell'SVG.
    useEffect(() => {
        const invalidate = () => { rectRef.current = null; };
        window.addEventListener('scroll', invalidate, { capture: true, passive: true });
        return () => window.removeEventListener('scroll', invalidate, { capture: true });
    }, []);

    // Su mobile l'SVG è più largo dello schermo: si parte dal mese più recente (a destra).
    const count = points?.length ?? 0;
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollLeft = el.scrollWidth;
    }, [count, containerW]);

    // Al tocco non esiste un "mouse leave": il tooltip si chiude toccando fuori dal grafico.
    const tooltipOpen = hoverIdx != null;
    useEffect(() => {
        if (!tooltipOpen) return;
        const onDown = (e: PointerEvent) => {
            if (!scrollRef.current?.contains(e.target as Node)) setHoverIdx(null);
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [tooltipOpen]);

    // Formattazione condivisa (utils/format): separatori coerenti col resto dell'app.
    const formatAmount = (v: number) => formatMoney(v, currency);
    const formatSignedAmount = (v: number) => formatMoney(v, currency, { signed: true });

    if (!points || points.length === 0) return <EmptyState description={t('charts.noData')} />;

    const closingLabel = t('reports.balanceTrend.closingBalance');
    const monthlyNetLabel = t('reports.balanceTrend.monthlyNet');
    const describeMonth = (p: BalanceTrendChartPoint) =>
        `${p.label}: ${closingLabel} ${formatAmount(p.closingBalance)}, ${monthlyNetLabel} ${formatSignedAmount(p.monthlyNet)}`;

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

    const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (!rectRef.current) rectRef.current = e.currentTarget.getBoundingClientRect();
        const rect = rectRef.current;
        const x = ((e.clientX - rect.left) / rect.width) * totalW;
        const localX = x - MARGIN_LEFT;
        if (localX < -colW / 2 || localX > plotW + colW / 2) {
            // Aggiorna solo se cambia davvero (vedi nota in TrendDualChart).
            setHoverIdx(prev => (prev === null ? prev : null));
            return;
        }
        const idx = Math.min(N - 1, Math.max(0, Math.round(localX / colW)));
        setHoverIdx(prev => (prev === idx ? prev : idx));
    };

    // Tap su touch: pointerdown seleziona il mese toccato. Niente preventDefault, così il
    // pan orizzontale del contenitore resta nativo (touch-action di default = auto).
    const handleDown = (e: React.PointerEvent<SVGSVGElement>) => {
        rectRef.current = null;
        handleMove(e);
    };

    // Dopo un tap il browser emette pointerleave appena il dito si alza: lì il tooltip
    // deve restare visibile, e si chiude toccando fuori (vedi effect sopra).
    const handleLeave = (e: React.PointerEvent<SVGSVGElement>) => {
        rectRef.current = null;
        if (e.pointerType !== 'touch') setHoverIdx(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            setHoverIdx(null);
            return;
        }
        const cur = hoverIdx ?? N - 1;
        const next = e.key === 'ArrowLeft' ? Math.max(0, cur - 1)
            : e.key === 'ArrowRight' ? Math.min(N - 1, cur + 1)
                : e.key === 'Home' ? 0
                    : e.key === 'End' ? N - 1
                        : null;
        if (next == null) return;
        e.preventDefault();
        setHoverIdx(next);
        revealX(e.currentTarget, xCenter(next), Math.max(colW, MARGIN_LEFT));
    };

    const polyline = points.map((p, i) => `${xCenter(i)},${yToPx(p.closingBalance)}`).join(' ');
    const areaPath = `M ${xCenter(0)},${zeroY} L ${points
        .map((p, i) => `${xCenter(i)},${yToPx(p.closingBalance)}`)
        .join(' L ')} L ${xCenter(N - 1)},${zeroY} Z`;

    const tooltipW = 220;
    // Tooltip a destra del punto; a sinistra se non c'è spazio.
    const tooltipLeft = hoverIdx != null
        ? (xCenter(hoverIdx) + 12 + tooltipW <= totalW - 4
            ? xCenter(hoverIdx) + 12
            : Math.max(4, xCenter(hoverIdx) - 12 - tooltipW))
        : 0;
    const hoverPoint = hoverIdx != null ? points[hoverIdx] : null;

    const ariaSummary = `${closingLabel} — ${t('charts.lastMonths', { months: N, defaultValue: 'Ultimi {{months}} mesi' })}. ${describeMonth(points[N - 1])}.`;

    return (
        <div ref={containerRef}>
            <Flex gap={16} style={{ marginBottom: 6 }} wrap>
                <Flex align="center" gap={6}>
                    <span aria-hidden style={{ display: 'inline-block', width: 14, height: 2, backgroundColor: token.colorPrimary }} />
                    <Text style={{ fontSize: FONT_SIZE.sm }}>{closingLabel}</Text>
                </Flex>
            </Flex>

            {/* Focusabile: le frecce scorrono i mesi e mostrano il tooltip */}
            <div
                ref={scrollRef}
                tabIndex={0}
                role="group"
                aria-label={t('charts.keyboardHint', { defaultValue: 'Usa le frecce sinistra e destra per scorrere i mesi' })}
                onFocus={e => {
                    if (e.target !== e.currentTarget) return;
                    setFocused(true);
                    setHoverIdx(prev => prev ?? N - 1);
                }}
                onBlur={() => {
                    setFocused(false);
                    setHoverIdx(null);
                }}
                onKeyDown={handleKeyDown}
                style={{ overflowX: fits ? 'visible' : 'auto', WebkitOverflowScrolling: 'touch', position: 'relative' }}
            >
                <svg
                    width={totalW}
                    height={height}
                    viewBox={`0 0 ${totalW} ${height}`}
                    style={{ display: 'block' }}
                    role="img"
                    aria-label={ariaSummary}
                    onPointerEnter={() => { rectRef.current = null; }}
                    onPointerDown={handleDown}
                    onPointerMove={handleMove}
                    onPointerLeave={handleLeave}
                    onPointerCancel={() => setHoverIdx(null)}
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
                        aria-hidden
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
                            <span>{closingLabel}</span>
                            <span style={{ fontWeight: 500 }}>{formatAmount(hoverPoint.closingBalance)}</span>
                        </Flex>
                        <Flex justify="space-between" gap={12}>
                            <span>{monthlyNetLabel}</span>
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
                                {formatSignedAmount(hoverPoint.monthlyNet)}
                            </span>
                        </Flex>
                    </div>
                )}
            </div>

            {/* Annuncia il mese selezionato da tastiera (il tooltip visivo è aria-hidden) */}
            <div aria-live="polite" style={VISUALLY_HIDDEN}>
                {focused && hoverPoint ? describeMonth(hoverPoint) : ''}
            </div>
        </div>
    );
};
