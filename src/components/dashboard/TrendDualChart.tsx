import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Flex, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TrendPoint } from '../../hooks/useDashboardData';
import { FONT_SIZE, RADIUS, SHADOW, getSemanticColors } from '../../theme/tokens';
import { usePreferences } from '../../contexts/PreferencesContext';
import { EmptyState } from '../common/EmptyState';
import { formatMoney, formatNumber } from '../../utils/format';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

const { Text } = Typography;

interface Props {
    points: TrendPoint[];
    height?: number;
}

const formatTick = (v: number): string => {
    const abs = Math.abs(v);
    if (abs >= 1000) return `${formatNumber(v / 1000, abs >= 10000 ? 0 : 1)}k`;
    return formatNumber(v, 0);
};

/** Testo leggibile solo dagli screen reader (live region e suggerimenti da tastiera). */
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

/** Passo "tondo" (1, 2, 2.5, 5 × 10ⁿ) più vicino per eccesso al passo grezzo. */
const niceStep = (rawStep: number): number => {
    const mag = 10 ** Math.floor(Math.log10(rawStep));
    const norm = rawStep / mag;
    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    // Mai sotto l'unità: con importi tutti a zero le tacche sarebbero "0, 0, 0, 1".
    return Math.max(nice * mag, 1);
};

/**
 * Scala Y con tacche tonde. Il dominio include sempre lo zero (`min <= 0 <= max`) e le
 * tacche sono multipli interi del passo, quindi lo zero è sempre una tacca: le barre
 * partono da una linea di base visibile anche quando il netto di un mese è negativo.
 */
const niceScale = (min: number, max: number, target = 4) => {
    const step = niceStep((max - min || 1) / target);
    const lo = Math.floor(min / step);
    const hi = Math.max(Math.ceil(max / step), lo + 1);
    const ticks: number[] = [];
    // `|| 0` normalizza il -0 (altrimenti la tacca verrebbe formattata "-0").
    for (let k = lo; k <= hi; k++) ticks.push(k * step || 0);
    return { min: lo * step, max: hi * step, ticks };
};

/** Scorre il contenitore quanto basta per rendere visibile la colonna centrata in `x`. */
const revealX = (el: HTMLElement, x: number, pad: number) => {
    if (x - pad < el.scrollLeft) el.scrollLeft = x - pad;
    else if (x + pad > el.scrollLeft + el.clientWidth) el.scrollLeft = x + pad - el.clientWidth;
};

const TooltipRow = ({ label, value, color, currency }: { label: string; value: number; color: string; currency: string }) => (
    <Flex justify="space-between" gap={16} style={{ lineHeight: '18px' }}>
        <Flex align="center" gap={6}>
            <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: RADIUS.xs, backgroundColor: color }} />
            <span>{label}</span>
        </Flex>
        <span style={{ fontWeight: 500 }}>{formatMoney(value, currency)}</span>
    </Flex>
);

export const TrendDualChart = ({ points, height = 280 }: Props) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');
    const currency = useDefaultCurrency();

    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [containerW, setContainerW] = useState(0);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    // true quando il grafico ha il focus: solo allora la live region annuncia il mese.
    const [focused, setFocused] = useState(false);
    // Rect memorizzata e invalidata a ingresso/uscita/scroll: `getBoundingClientRect()` a
    // ogni pointermove è una lettura di layout forzata, e il riquadro non cambia finché
    // nessuno scorre.
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

    // Su mobile l'SVG è più largo dello schermo: si parte dal mese più recente (a destra),
    // non da quello più vecchio. Rieseguito quando cambia il numero di mesi o la larghezza.
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

    if (!points || points.length === 0) return <EmptyState description={t('charts.noData')} />;

    const incomeLabel = t('reports.typeIn');
    const expenseLabel = t('reports.typeOut');
    const netLabel = t('reports.net');
    const describeMonth = (p: TrendPoint) =>
        `${p.month}: ${incomeLabel} ${formatMoney(p.income, currency)}, ${expenseLabel} ${formatMoney(p.expense, currency)}, ${netLabel} ${formatMoney(p.net, currency)}`;

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

    const dataMax = Math.max(...points.map(p => Math.max(p.income, p.expense, p.net)), 0);
    const dataMin = Math.min(...points.map(p => Math.min(p.income, p.expense, p.net)), 0);
    const { min: yMin, max: yMax, ticks } = niceScale(dataMin, dataMax);
    const span = (yMax - yMin) || 1;

    const yToPx = (v: number) => MARGIN_TOP + ((yMax - v) / span) * plotH;
    const zeroY = yToPx(0);
    const xCenter = (i: number) => MARGIN_LEFT + (i + 0.5) * colW;
    /** Barra che cresce dalla linea dello zero, verso l'alto o verso il basso. */
    const bar = (v: number) => {
        const y = yToPx(v);
        return { y: Math.min(y, zeroY), h: Math.max(Math.abs(zeroY - y), 1) };
    };

    const BAR_W = Math.min(14, Math.max(4, colW * 0.32));
    const BAR_GAP = 2;
    const axisColor = token.colorTextSecondary;
    const gridColor = token.colorSplit;
    const zeroColor = token.colorTextTertiary;

    // Show every Nth label on narrow screens to avoid overlap.
    const labelStep = colW < 40 ? Math.ceil(40 / colW) : 1;

    const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (!rectRef.current) rectRef.current = e.currentTarget.getBoundingClientRect();
        const rect = rectRef.current;
        const x = ((e.clientX - rect.left) / rect.width) * totalW;
        const localX = x - MARGIN_LEFT;
        if (localX < 0 || localX > plotW) {
            // Aggiorna solo se cambia davvero: altrimenti ogni pixel di movimento
            // ri-renderizzava un centinaio di nodi SVG.
            setHoverIdx(prev => (prev === null ? prev : null));
            return;
        }
        const idx = Math.min(N - 1, Math.max(0, Math.floor(localX / colW)));
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
        revealX(e.currentTarget, xCenter(next), colW);
    };

    const hoverPoint = hoverIdx != null ? points[hoverIdx] : null;

    // Tooltip a destra della colonna; a sinistra se non c'è spazio.
    const tooltipW = 180;
    const tooltipLeft = hoverIdx != null
        ? (xCenter(hoverIdx) + 12 + tooltipW <= totalW - 4
            ? xCenter(hoverIdx) + 12
            : Math.max(4, xCenter(hoverIdx) - 12 - tooltipW))
        : 0;

    const ariaSummary = `${incomeLabel}, ${expenseLabel}, ${netLabel} — ${t('charts.lastMonths', { months: N, defaultValue: 'Ultimi {{months}} mesi' })}. ${describeMonth(points[N - 1])}.`;

    return (
        <div ref={containerRef}>
            {/* Legenda testuale: entrate/uscite non sono distinguibili solo dal colore */}
            <Flex gap={16} style={{ marginBottom: 6 }} wrap>
                <Flex align="center" gap={6}>
                    <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: RADIUS.xs, backgroundColor: semantic.positive }} />
                    <Text style={{ fontSize: FONT_SIZE.sm }}>{incomeLabel}</Text>
                </Flex>
                <Flex align="center" gap={6}>
                    <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: RADIUS.xs, backgroundColor: semantic.negative }} />
                    <Text style={{ fontSize: FONT_SIZE.sm }}>{expenseLabel}</Text>
                </Flex>
                <Flex align="center" gap={6}>
                    <span aria-hidden style={{ display: 'inline-block', width: 14, height: 2, backgroundColor: token.colorPrimary }} />
                    <Text style={{ fontSize: FONT_SIZE.sm }}>{netLabel}</Text>
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
                    {/* Y grid + ticks */}
                    {ticks.map(tv => {
                        const y = yToPx(tv);
                        return (
                            <g key={tv}>
                                <line
                                    x1={MARGIN_LEFT}
                                    x2={totalW - MARGIN_RIGHT}
                                    y1={y}
                                    y2={y}
                                    stroke={gridColor}
                                />
                                <text
                                    x={MARGIN_LEFT - 6}
                                    y={y + 3}
                                    textAnchor="end"
                                    fontSize={FONT_SIZE.xxs}
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
                        const income = bar(p.income);
                        const expense = bar(p.expense);
                        const dim = hoverIdx != null && hoverIdx !== i;
                        return (
                            <g key={p.month} opacity={dim ? 0.45 : 1}>
                                <rect
                                    x={cx - BAR_W - BAR_GAP / 2}
                                    y={income.y}
                                    width={BAR_W}
                                    height={income.h}
                                    fill={semantic.positive}
                                    rx={RADIUS.xs}
                                />
                                <rect
                                    x={cx + BAR_GAP / 2}
                                    y={expense.y}
                                    width={BAR_W}
                                    height={expense.h}
                                    fill={semantic.negative}
                                    rx={RADIUS.xs}
                                />
                            </g>
                        );
                    })}

                    {/* Linea dello zero esplicita (come in BalanceTrendChart), sopra le barre */}
                    <line
                        x1={MARGIN_LEFT}
                        x2={totalW - MARGIN_RIGHT}
                        y1={zeroY}
                        y2={zeroY}
                        stroke={zeroColor}
                        strokeWidth={1.2}
                    />

                    {/* Net line */}
                    <polyline
                        points={points.map((p, i) => `${xCenter(i)},${yToPx(p.net)}`).join(' ')}
                        fill="none"
                        stroke={token.colorPrimary}
                        strokeWidth={2}
                    />
                    {points.map((p, i) => (
                        <circle
                            key={p.month}
                            cx={xCenter(i)}
                            cy={yToPx(p.net)}
                            r={hoverIdx === i ? 4 : 2.5}
                            fill={token.colorPrimary}
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
                                fontSize={FONT_SIZE.xxs}
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
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{hoverPoint.month}</div>
                        <TooltipRow label={incomeLabel} value={hoverPoint.income} color={semantic.positive} currency={currency} />
                        <TooltipRow label={expenseLabel} value={hoverPoint.expense} color={semantic.negative} currency={currency} />
                        <TooltipRow label={netLabel} value={hoverPoint.net} color={token.colorPrimary} currency={currency} />
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
