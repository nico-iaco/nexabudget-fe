// SafeSelect: AntD Select on desktop/Android, native <select> on iOS PWA.
// Avoids AntD's position:fixed popup coordinate mismatch on iOS standalone mode.
import React, { useRef } from 'react';
import { Select, theme } from 'antd';
import type { SelectProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';

const detectIOS = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return false;
};

interface OptionItem {
    value: string | number;
    label: string;
    disabled?: boolean;
}

function extractOptionsFromChildren(children: React.ReactNode): OptionItem[] {
    const opts: OptionItem[] = [];
    React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
            const { value, children: label, disabled } = child.props as {
                value?: string | number;
                children?: React.ReactNode;
                disabled?: boolean;
            };
            if (value !== undefined) {
                const text = typeof label === 'string' ? label : String(value);
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
    const fontSize = size === 'small' ? 12 : 14;

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
                <DownOutlined style={{ fontSize: 10, color: token.colorTextQuaternary, flexShrink: 0 }} />
            </div>
            {/* Invisible native <select> covering the entire area */}
            <select
                value={strValue}
                onChange={(e) => {
                    const v = e.target.value;
                    onChange?.(v === '' ? undefined : v);
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
    const isIOS = useRef(detectIOS()).current;

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
