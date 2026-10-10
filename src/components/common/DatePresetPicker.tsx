// src/components/DatePresetPicker.tsx
// Chip preset a pillola + selettore range date adattivo:
//   Touch (iOS/Android) → <input type="date"> nativo con layer visivo AntD-style
//                         (NativeDateInput, vedi SafeDatePicker per il perché)
//   Desktop             → AntD DatePicker
import { useEffect, useState } from 'react';
import { DatePicker, Flex, theme } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { FONT_SIZE, RADIUS } from '../../theme/tokens';
import { NativeDateInput } from './SafeDatePicker';
import { detectNativeDatePicker } from '../../utils/device';

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

const toStr = (d: Dayjs | null): string => (d ? d.format('YYYY-MM-DD') : '');
const fromStr = (s: string): Dayjs | null => (s ? dayjs(s, 'YYYY-MM-DD') : null);
const fmtDisplay = (d: Dayjs | null): string | null => (d ? d.format('D MMM YYYY') : null);

// ─── RangeDatePicker — branch touch/Desktop ────────────────────────────────────

interface RangePickerProps {
    start: Dayjs | null;
    end: Dayjs | null;
    onChangeStart: (d: Dayjs | null) => void;
    onChangeEnd: (d: Dayjs | null) => void;
    startPlaceholder?: string;
    endPlaceholder?: string;
    disabled?: boolean;
    maxDate?: string;
    nativePicker: boolean;
}

const RangeDatePicker = ({
    start, end, onChangeStart, onChangeEnd,
    startPlaceholder, endPlaceholder,
    disabled = false, maxDate, nativePicker,
}: RangePickerProps) => {
    const maxDayjs = maxDate ? dayjs(maxDate, 'YYYY-MM-DD') : undefined;

    if (nativePicker) {
        return (
            <Flex gap={8} style={{ animation: 'datePickerSlideIn 0.18s ease' }}>
                <NativeDateInput
                    value={toStr(start)}
                    onChange={s => onChangeStart(fromStr(s))}
                    display={fmtDisplay(start)}
                    placeholder={startPlaceholder}
                    disabled={disabled}
                    max={toStr(end) || maxDate}
                />
                <NativeDateInput
                    value={toStr(end)}
                    onChange={s => onChangeEnd(fromStr(s))}
                    display={fmtDisplay(end)}
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
    customLabel,
    startPlaceholder,
    endPlaceholder,
    disabled = false,
    maxDate,
}: DatePresetPickerProps) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const [customMode, setCustomMode] = useState(false);
    const [hoveredIdx, setHoveredIdx] = useState<number | 'custom' | null>(null);
    // Rilevato una sola volta: il tipo di device non cambia a runtime.
    // useState con initializer lazy invece di useRef: i ref non si possono leggere
    // durante il render (react-hooks/refs).
    const [nativePicker] = useState(detectNativeDatePicker);

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
                        {customLabel ?? t('presets.custom')}
                    </button>
                </Flex>
            </div>

            {showRange && (
                <RangeDatePicker
                    start={value[0]}
                    end={value[1]}
                    // min/max dei date input nativi non bastano: la rotella di iOS Safari non
                    // li rispetta. Un estremo che scavalca l'altro lo trascina con sé.
                    onChangeStart={d => onChange([d, d && value[1]?.isBefore(d, 'day') ? d : value[1]])}
                    onChangeEnd={d => onChange([d && value[0]?.isAfter(d, 'day') ? d : value[0], d])}
                    startPlaceholder={startPlaceholder ?? t('presets.startDate')}
                    endPlaceholder={endPlaceholder ?? t('presets.endDate')}
                    disabled={disabled}
                    maxDate={maxDate}
                    nativePicker={nativePicker}
                />
            )}
        </Flex>
    );
};
