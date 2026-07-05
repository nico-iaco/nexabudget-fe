// src/components/DatePresetPicker.tsx
// Chip preset a pillola + selettore range date adattivo:
//   iOS (qualsiasi) → <input type="date"> nativo con layer visivo AntD-style
//                     Il wheel picker iOS non usa popup → nessun problema di coordinate PWA
//   Desktop/Android → AntD DatePicker (popup funziona correttamente)
import { useEffect, useRef, useState } from 'react';
import { DatePicker, Flex, theme } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { FONT_SIZE, RADIUS } from '../../theme/tokens';

export interface DatePreset {
    label: string;
    value: [Dayjs, Dayjs];
}

interface DatePresetPickerProps {
    presets: DatePreset[];
    value: [Dayjs | null, Dayjs | null];
    onChange: (range: [Dayjs | null, Dayjs | null]) => void;
    customLabel?: string;
    startPlaceholder?: string;
    endPlaceholder?: string;
    disabled?: boolean;
    /** Data massima selezionabile — stringa YYYY-MM-DD */
    maxDate?: string;
}

// ─── Rilevamento iOS ─────────────────────────────────────────────────────────
// Rileva qualsiasi dispositivo iOS (Safari, Chrome iOS, PWA).
// Su iOS i popup AntD con position:fixed hanno coordinate sfasate in PWA
// standalone → usiamo sempre input nativi su iOS, AntD su desktop/Android.
const detectIOS = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
    // iPadOS 13+ si identifica come MacIntel ma ha touch points multipli
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return false;
};

// ─── NativeDateInput — solo iOS ──────────────────────────────────────────────
// Layer visivo stile AntD con <input type="date"> invisibile sopra.
// Il tap apre il wheel picker nativo iOS senza alcun popup.

interface NativeDateInputProps {
    value: string;           // YYYY-MM-DD
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    min?: string;
    max?: string;
}

const toStr = (d: Dayjs | null): string => (d ? d.format('YYYY-MM-DD') : '');
const fromStr = (s: string): Dayjs | null => (s ? dayjs(s, 'YYYY-MM-DD') : null);
const fmtDisplay = (d: Dayjs | null): string | null => (d ? d.format('D MMM YYYY') : null);

const NativeDateInput = ({
    value, onChange, placeholder, disabled = false, min, max,
}: NativeDateInputProps) => {
    const { token } = theme.useToken();
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const formatted = fmtDisplay(fromStr(value));

    return (
        <div
            style={{ position: 'relative', flex: 1, minWidth: 0 }}
            onClick={() => inputRef.current?.showPicker?.()}
        >
            {/* Layer visivo — pointerEvents:none lascia passare i tap all'input */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 11px',
                borderRadius: token.borderRadius,
                border: `1px solid ${focused ? token.colorPrimary : token.colorBorder}`,
                boxShadow: focused ? `0 0 0 2px ${token.colorPrimaryBorder}` : 'none',
                background: disabled ? token.colorBgContainerDisabled : token.colorBgContainer,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                pointerEvents: 'none',
                userSelect: 'none',
                overflow: 'hidden',
            }}>
                <CalendarOutlined style={{
                    fontSize: FONT_SIZE.md, flexShrink: 0,
                    color: focused ? token.colorPrimary : token.colorTextTertiary,
                    transition: 'color 0.2s',
                }} />
                <span style={{
                    flex: 1, fontSize: FONT_SIZE.base,
                    color: formatted ? token.colorText : token.colorTextPlaceholder,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    opacity: disabled ? 0.5 : 1,
                }}>
                    {formatted ?? placeholder}
                </span>
            </div>

            {/* Input nativo invisibile — copre tutta l'area, apre wheel picker iOS */}
            <input
                ref={inputRef}
                type="date"
                value={value}
                min={min}
                max={max}
                disabled={disabled}
                onChange={e => onChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    zIndex: 1,
                    border: 'none',
                    padding: 0,
                    margin: 0,
                }}
            />
        </div>
    );
};

// ─── RangeDatePicker — branch iOS/Desktop ────────────────────────────────────

interface RangePickerProps {
    start: Dayjs | null;
    end: Dayjs | null;
    onChangeStart: (d: Dayjs | null) => void;
    onChangeEnd: (d: Dayjs | null) => void;
    startPlaceholder?: string;
    endPlaceholder?: string;
    disabled?: boolean;
    maxDate?: string;
    isIOS: boolean;
}

const RangeDatePicker = ({
    start, end, onChangeStart, onChangeEnd,
    startPlaceholder = 'Inizio', endPlaceholder = 'Fine',
    disabled = false, maxDate, isIOS,
}: RangePickerProps) => {
    const maxDayjs = maxDate ? dayjs(maxDate, 'YYYY-MM-DD') : undefined;

    if (isIOS) {
        return (
            <Flex gap={8} style={{ animation: 'datePickerSlideIn 0.18s ease' }}>
                <NativeDateInput
                    value={toStr(start)}
                    onChange={s => onChangeStart(fromStr(s))}
                    placeholder={startPlaceholder}
                    disabled={disabled}
                    max={toStr(end) || maxDate}
                />
                <NativeDateInput
                    value={toStr(end)}
                    onChange={s => onChangeEnd(fromStr(s))}
                    placeholder={endPlaceholder}
                    disabled={disabled}
                    min={toStr(start) || undefined}
                    max={maxDate}
                />
            </Flex>
        );
    }

    return (
        <Flex gap={8} style={{ animation: 'datePickerSlideIn 0.18s ease' }}>
            <DatePicker
                value={start}
                onChange={onChangeStart}
                format="D MMM YYYY"
                placeholder={startPlaceholder}
                disabled={disabled}
                disabledDate={d =>
                    !!(maxDayjs && d.isAfter(maxDayjs, 'day')) ||
                    !!(end && d.isAfter(end, 'day'))
                }
                style={{ flex: 1 }}
                allowClear
            />
            <DatePicker
                value={end}
                onChange={onChangeEnd}
                format="D MMM YYYY"
                placeholder={endPlaceholder}
                disabled={disabled}
                disabledDate={d =>
                    !!(maxDayjs && d.isAfter(maxDayjs, 'day')) ||
                    !!(start && d.isBefore(start, 'day'))
                }
                style={{ flex: 1 }}
                allowClear
            />
        </Flex>
    );
};

// ─── Componente principale ────────────────────────────────────────────────────

export const DatePresetPicker = ({
    presets,
    value,
    onChange,
    customLabel = 'Personalizzato',
    startPlaceholder = 'Inizio',
    endPlaceholder = 'Fine',
    disabled = false,
    maxDate,
}: DatePresetPickerProps) => {
    const { token } = theme.useToken();
    const [customMode, setCustomMode] = useState(false);
    const [hoveredIdx, setHoveredIdx] = useState<number | 'custom' | null>(null);
    // Rilevato una sola volta: il tipo di device non cambia a runtime
    const isIOS = useRef(detectIOS()).current;

    const activePresetIdx = presets.findIndex(
        p =>
            value[0]?.isSame(p.value[0], 'day') &&
            value[1]?.isSame(p.value[1], 'day')
    );

    useEffect(() => {
        if (activePresetIdx !== -1) setCustomMode(false);
    }, [activePresetIdx]);

    const showRange = customMode || (activePresetIdx === -1 && (!!value[0] || !!value[1]));

    const chipStyle = (active: boolean, hovered: boolean): React.CSSProperties => {
        const base: React.CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            height: 30,
            padding: '0 13px',
            borderRadius: RADIUS.pill,
            fontSize: FONT_SIZE.md,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            border: '1.5px solid transparent',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
        };
        if (disabled)
            return { ...base, background: token.colorFillTertiary, color: token.colorTextDisabled, cursor: 'not-allowed' };
        if (active)
            return { ...base, background: token.colorPrimary, color: token.colorTextLightSolid, boxShadow: `0 2px 8px ${token.colorPrimaryBorder}` };
        if (hovered)
            return { ...base, background: token.colorFillSecondary, color: token.colorText, borderColor: token.colorBorderSecondary };
        return { ...base, background: 'transparent', color: token.colorTextSecondary, borderColor: token.colorBorderSecondary };
    };

    return (
        <Flex vertical gap={10}>
            {/* Strip chip — scorrevole orizzontalmente, scrollbar nascosta */}
            <div style={{
                overflowX: 'auto',
                overflowY: 'visible',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}>
                <Flex gap={6} style={{ width: 'max-content', paddingBottom: 2 }}>
                    {presets.map((p, i) => (
                        <button
                            key={i}
                            type="button"
                            disabled={disabled}
                            style={chipStyle(activePresetIdx === i && !customMode, hoveredIdx === i)}
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            onClick={() => { setCustomMode(false); onChange(p.value); }}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        disabled={disabled}
                        style={chipStyle(showRange, hoveredIdx === 'custom')}
                        onMouseEnter={() => setHoveredIdx('custom')}
                        onMouseLeave={() => setHoveredIdx(null)}
                        onClick={() => {
                            setCustomMode(true);
                            if (activePresetIdx !== -1) onChange([null, null]);
                        }}
                    >
                        {customLabel}
                    </button>
                </Flex>
            </div>

            {showRange && (
                <RangeDatePicker
                    start={value[0]}
                    end={value[1]}
                    onChangeStart={d => onChange([d, value[1]])}
                    onChangeEnd={d => onChange([value[0], d])}
                    startPlaceholder={startPlaceholder}
                    endPlaceholder={endPlaceholder}
                    disabled={disabled}
                    maxDate={maxDate}
                    isIOS={isIOS}
                />
            )}
        </Flex>
    );
};
