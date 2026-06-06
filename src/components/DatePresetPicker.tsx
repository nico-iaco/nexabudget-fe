// src/components/DatePresetPicker.tsx
// Selettore di range date mobile-first: chip a pillola in scroll orizzontale
// + due DatePicker per range personalizzato.
// Evita dropdown popup (che su iOS PWA standalone hanno problemi di coordinate touch).
import { useEffect, useState } from 'react';
import { DatePicker, Flex, theme } from 'antd';
import type { Dayjs } from 'dayjs';

export interface DatePreset {
    label: string;
    value: [Dayjs, Dayjs];
}

interface DatePresetPickerProps {
    presets: DatePreset[];
    value: [Dayjs | null, Dayjs | null];
    onChange: (range: [Dayjs | null, Dayjs | null]) => void;
    /** Label del chip "Personalizzato" */
    customLabel?: string;
    /** Placeholder input data inizio */
    startPlaceholder?: string;
    /** Placeholder input data fine */
    endPlaceholder?: string;
    disabled?: boolean;
    disabledDate?: (d: Dayjs) => boolean;
}

export const DatePresetPicker = ({
    presets,
    value,
    onChange,
    customLabel = 'Personalizzato',
    startPlaceholder = 'Inizio',
    endPlaceholder = 'Fine',
    disabled = false,
    disabledDate,
}: DatePresetPickerProps) => {
    const { token } = theme.useToken();

    // Stato interno: l'utente ha esplicitamente cliccato "Personalizzato"
    const [customMode, setCustomMode] = useState(false);

    const activePresetIdx = presets.findIndex(
        p =>
            value[0]?.isSame(p.value[0], 'day') &&
            value[1]?.isSame(p.value[1], 'day')
    );

    // Quando viene selezionato un preset dall'esterno, esci dalla modalità custom
    useEffect(() => {
        if (activePresetIdx !== -1) setCustomMode(false);
    }, [activePresetIdx]);

    // I DatePicker appaiono quando:
    // 1. L'utente ha cliccato "Personalizzato" (customMode), oppure
    // 2. Il valore esterno contiene date che non corrispondono ad alcun preset
    const showCustomPickers = customMode || (activePresetIdx === -1 && (!!value[0] || !!value[1]));
    const isCustomActive = showCustomPickers;

    const chipBase: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        height: 30,
        padding: '0 14px',
        borderRadius: 100,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        outline: 'none',
        transition: 'background 0.18s, color 0.18s',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
    };

    const getChipStyle = (active: boolean): React.CSSProperties => {
        if (disabled) return { ...chipBase, background: token.colorFillTertiary, color: token.colorTextDisabled, cursor: 'not-allowed' };
        if (active) return { ...chipBase, background: token.colorPrimary, color: '#fff' };
        return { ...chipBase, background: token.colorFillSecondary, color: token.colorText };
    };

    return (
        <Flex vertical gap={10}>
            {/* Strip scorrevole — overflowX: auto è sul wrapper, width: max-content sul contenuto interno */}
            <div
                style={{
                    overflowX: 'auto',
                    overflowY: 'visible',
                    // Nasconde la scrollbar visivamente su tutti i browser
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
                            style={getChipStyle(activePresetIdx === i && !customMode)}
                            onClick={() => {
                                setCustomMode(false);
                                onChange(p.value);
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        disabled={disabled}
                        style={getChipStyle(isCustomActive)}
                        onClick={() => {
                            setCustomMode(true);
                            // Se c'era un preset attivo, azzera le date così
                            // l'utente può inserirne di nuove
                            if (activePresetIdx !== -1) onChange([null, null]);
                        }}
                    >
                        {customLabel}
                    </button>
                </Flex>
            </div>

            {/* DatePicker — compaiono solo in modalità custom */}
            {showCustomPickers && (
                <Flex gap={8}>
                    <DatePicker
                        value={value[0] ?? null}
                        onChange={d => onChange([d, value[1] ?? null])}
                        placeholder={startPlaceholder}
                        disabledDate={disabledDate}
                        disabled={disabled}
                        style={{ flex: 1 }}
                        getPopupContainer={trigger => trigger.parentElement ?? document.body}
                    />
                    <DatePicker
                        value={value[1] ?? null}
                        onChange={d => onChange([value[0] ?? null, d])}
                        placeholder={endPlaceholder}
                        disabledDate={disabledDate}
                        disabled={disabled}
                        style={{ flex: 1 }}
                        getPopupContainer={trigger => trigger.parentElement ?? document.body}
                    />
                </Flex>
            )}
        </Flex>
    );
};
