// SafeSelect: AntD Select on desktop/Android, native <select> on iOS PWA.
// Avoids AntD's position:fixed popup coordinate mismatch on iOS standalone mode.
import React, { useState } from 'react';
import { Select, theme } from 'antd';
import type { SelectProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { FONT_SIZE } from '../../theme/tokens';
import { detectIOS } from '../../utils/device';

interface OptionItem {
    value: string | number;
    label: string;
    disabled?: boolean;
}

function extractOptionsFromChildren(children: React.ReactNode): OptionItem[] {
    const opts: OptionItem[] = [];
    React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
            const { value, children: content, label, disabled } = child.props as {
                value?: string | number;
                children?: React.ReactNode;
                label?: React.ReactNode;
                disabled?: boolean;
            };
            if (value !== undefined) {
                // Figli non testuali (es. logo + nome della banca): si usa la prop `label`,
                // altrimenti la select nativa mostrava l'id grezzo.
                const text = typeof content === 'string'
                    ? content
                    : typeof label === 'string' ? label : String(value);
                opts.push({ value, label: text, disabled });
            }
        }
    });
    return opts;
}

export type SafeSelectValue = string | number | null | undefined;

export interface SafeSelectProps extends Omit<SelectProps, 'onChange' | 'options'> {
    value?: SafeSelectValue;
    onChange?: (value: SafeSelectValue) => void;
    options?: OptionItem[];
}

function NativeSelect({
    value,
    onChange,
    placeholder,
    options,
    children,
    allowClear,
    style,
    disabled,
    size,
}: SafeSelectProps) {
    const { token } = theme.useToken();
    const allOptions: OptionItem[] = options ?? extractOptionsFromChildren(children);

    const heights: Record<string, number> = { small: 24, middle: 32, large: 40 };
    const height = heights[(size as string) ?? 'middle'] ?? 32;
    const fontSize = size === 'small' ? FONT_SIZE.sm : FONT_SIZE.base;

    const strValue = value !== null && value !== undefined ? String(value) : '';
    const displayLabel = strValue
        ? allOptions.find((o) => String(o.value) === strValue)?.label ?? strValue
        : null;

    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', ...(style as React.CSSProperties) }}>
            {/* Visual layer — AntD-style appearance */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    height,
                    padding: '0 11px',
                    border: `1px solid ${token.colorBorder}`,
                    borderRadius: token.borderRadius,
                    background: disabled ? token.colorFillTertiary : token.colorBgContainer,
                    color: displayLabel ? token.colorText : token.colorTextPlaceholder,
                    fontSize,
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                    gap: 4,
                    userSelect: 'none',
                }}
            >
                <span
                    style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {displayLabel ?? placeholder ?? ''}
                </span>
                <DownOutlined style={{ fontSize: FONT_SIZE.xxs, color: token.colorTextQuaternary, flexShrink: 0 }} />
            </div>
            {/* Invisible native <select> covering the entire area */}
            <select
                value={strValue}
                onChange={(e) => {
                    const v = e.target.value;
                    // Il DOM restituisce sempre stringhe: si torna al valore originale
                    // dell'opzione, così un valore numerico resta numerico come su AntD.
                    const option = allOptions.find(o => String(o.value) === v);
                    onChange?.(v === '' ? undefined : option?.value ?? v);
                }}
                disabled={disabled}
                style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: 16, // prevents iOS auto-zoom on focus
                }}
            >
                {(allowClear || !strValue) && (
                    <option value="">{placeholder ?? ''}</option>
                )}
                {allOptions.map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)} disabled={opt.disabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

export function SafeSelect(props: SafeSelectProps) {
    // Rilevato una sola volta: il tipo di device non cambia a runtime.
    // useState con initializer lazy invece di useRef: i ref non si possono leggere
    // durante il render (react-hooks/refs).
    const [isIOS] = useState(detectIOS);

    if (isIOS) return <NativeSelect {...props} />;

    // Desktop/Android: pass through to AntD Select
    const { onChange, options, ...rest } = props;
    return (
        <Select
            {...rest}
            options={options}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={onChange as any}
        />
    );
}

SafeSelect.Option = Select.Option;
