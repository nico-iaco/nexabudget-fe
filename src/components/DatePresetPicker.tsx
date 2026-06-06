// src/components/DatePresetPicker.tsx
// Chip preset a pillola + selettore range date con AntD DatePicker.
// L'unico problema iOS PWA risolto qui è il Select dropdown (sostituito con
// bottoni); il DatePicker AntD funziona correttamente su iOS.
import { useEffect, useState } from 'react';
import { DatePicker, Flex, theme } from 'antd';
import { CalendarOutlined, CloseCircleFilled, SwapRightOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';

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
    maxDate?: Dayjs;
}

// ─── Selettore range date ────────────────────────────────────────────────────
// Due DatePicker AntD borderless dentro un contenitore con bordo condiviso.
// getPopupContainer → document.body così il popup non viene clippato da
// eventuali antenati con overflow:hidden.

interface RangePickerProps {
    start: Dayjs | null;
    end: Dayjs | null;
    onChangeStart: (d: Dayjs | null) => void;
    onChangeEnd: (d: Dayjs | null) => void;
    onClear: () => void;
    startPlaceholder?: string;
    endPlaceholder?: string;
    disabled?: boolean;
    maxDate?: Dayjs;
}

const RangeDatePicker = ({
    start, end, onChangeStart, onChangeEnd, onClear,
    startPlaceholder = 'Inizio', endPlaceholder = 'Fine',
    disabled = false, maxDate,
}: RangePickerProps) => {
    const { token } = theme.useToken();
    const [anyFocused, setAnyFocused] = useState(false);

    const pickerStyle: React.CSSProperties = {
        flex: 1,
        border: 'none',
        boxShadow: 'none',
        background: 'transparent',
        paddingLeft: 8,
        paddingRight: 0,
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                height: 40,
                borderRadius: token.borderRadiusLG,
                border: `1.5px solid ${anyFocused ? token.colorPrimary : token.colorBorder}`,
                boxShadow: anyFocused
                    ? `0 0 0 2px ${token.colorPrimaryBorder}`
                    : '0 1px 3px rgba(0,0,0,0.06)',
                background: disabled ? token.colorBgContainerDisabled : token.colorBgContainer,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                overflow: 'visible',
                animation: 'datePickerSlideIn 0.18s ease',
            }}
        >
            <DatePicker
                value={start}
                onChange={onChangeStart}
                format="D MMM YYYY"
                placeholder={startPlaceholder}
                disabled={disabled}
                disabledDate={d =>
                    !!(maxDate && d.isAfter(maxDate, 'day')) ||
                    !!(end && d.isAfter(end, 'day'))
                }
                style={pickerStyle}
                variant="borderless"
                suffixIcon={<CalendarOutlined style={{ color: token.colorTextTertiary }} />}
                onFocus={() => setAnyFocused(true)}
                onBlur={() => setAnyFocused(false)}
            />

            <SwapRightOutlined
                style={{
                    fontSize: 14,
                    flexShrink: 0,
                    color: anyFocused ? token.colorPrimary : token.colorTextQuaternary,
                    transition: 'color 0.2s',
                    pointerEvents: 'none',
                }}
            />

            <DatePicker
                value={end}
                onChange={onChangeEnd}
                format="D MMM YYYY"
                placeholder={endPlaceholder}
                disabled={disabled}
                disabledDate={d =>
                    !!(maxDate && d.isAfter(maxDate, 'day')) ||
                    !!(start && d.isBefore(start, 'day'))
                }
                style={{ ...pickerStyle, paddingLeft: 4 }}
                variant="borderless"
                suffixIcon={
                    (start || end) && !disabled ? (
                        <CloseCircleFilled
                            style={{ color: token.colorTextQuaternary, cursor: 'pointer', fontSize: 13 }}
                            onClick={e => { e.stopPropagation(); onClear(); }}
                        />
                    ) : null
                }
                onFocus={() => setAnyFocused(true)}
                onBlur={() => setAnyFocused(false)}
            />
        </div>
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
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            border: '1.5px solid transparent',
            outline: 'none',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
        };
        if (disabled)
            return { ...base, background: token.colorFillTertiary, color: token.colorTextDisabled, cursor: 'not-allowed' };
        if (active)
            return { ...base, background: token.colorPrimary, color: '#fff', boxShadow: `0 2px 8px ${token.colorPrimaryBorder}` };
        if (hovered)
            return { ...base, background: token.colorFillSecondary, color: token.colorText, borderColor: token.colorBorderSecondary };
        return { ...base, background: 'transparent', color: token.colorTextSecondary, borderColor: token.colorBorderSecondary };
    };

    return (
        <Flex vertical gap={10}>
            {/* Strip chip — scorrevole orizzontalmente, scrollbar nascosta */}
            <div
                style={{
                    overflowX: 'auto',
                    overflowY: 'visible',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                } as React.CSSProperties}
            >
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

            {/* Range date — AntD su tutti i device */}
            {showRange && (
                <RangeDatePicker
                    start={value[0]}
                    end={value[1]}
                    onChangeStart={d => onChange([d, value[1]])}
                    onChangeEnd={d => onChange([value[0], d])}
                    onClear={() => { setCustomMode(false); onChange([null, null]); }}
                    startPlaceholder={startPlaceholder}
                    endPlaceholder={endPlaceholder}
                    disabled={disabled}
                    maxDate={maxDate}
                />
            )}
        </Flex>
    );
};
