// SafeDatePicker: AntD DatePicker su desktop, <input type="date|month|datetime-local">
// nativo sui dispositivi touch (iOS e Android).
// Su mobile il popup AntD non è utilizzabile: dentro modali e drawer viene montato in
// `.ant-modal-body`/`.ant-drawer-body` (vedi getPopupContainer in App.tsx), che sotto i
// 768px ha max-height + overflow-y:auto e quindi taglia il calendario; in PWA standalone
// su iOS i popup position:fixed hanno inoltre coordinate sfasate. Il picker nativo (wheel
// iOS, dialog Android) non ha nessuno dei due problemi.
// Compatibile con Form.Item: accetta value/onChange in Dayjs e l'id per il label.
import { useRef, useState, type CSSProperties } from 'react';
import { DatePicker, Form, theme } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import { FONT_SIZE } from '../../theme/tokens';
import { detectNativeDatePicker } from '../../utils/device';

// ─── NativeDateInput ─────────────────────────────────────────────────────────
// Layer visivo stile AntD con un <input> nativo invisibile sopra: il tap apre il
// picker di sistema senza alcun popup.

export type NativeInputType = 'date' | 'month' | 'datetime-local';

export interface NativeDateInputProps {
    type?: NativeInputType;
    value: string;           // nel formato dell'input nativo (vedi NATIVE_FORMAT)
    onChange: (v: string) => void;
    display: string | null;  // testo già formattato, null → placeholder
    placeholder?: string;
    disabled?: boolean;
    min?: string;
    max?: string;
    id?: string;
    height?: number;
    status?: 'error' | 'warning';
    style?: CSSProperties;
}

export const NativeDateInput = ({
    type = 'date', value, onChange, display, placeholder, disabled = false,
    min, max, id, height = 32, status, style,
}: NativeDateInputProps) => {
    const { token } = theme.useToken();
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const borderColor = status === 'error' ? token.colorError
        : status === 'warning' ? token.colorWarning
        : focused ? token.colorPrimary : token.colorBorder;

    return (
        <div
            style={{ position: 'relative', flex: 1, minWidth: 0, ...style }}
            onClick={() => {
                if (disabled) return;
                // showPicker lancia se l'input non è "mostrabile" (es. già aperto):
                // il tap sull'input lo apre comunque.
                try { inputRef.current?.showPicker?.(); } catch { /* fallback nativo */ }
            }}
        >
            {/* Layer visivo — pointerEvents:none lascia passare i tap all'input */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height,
                padding: '0 11px',
                borderRadius: token.borderRadius,
                border: `1px solid ${borderColor}`,
                boxShadow: focused ? `0 0 0 2px ${token.colorPrimaryBorder}` : 'none',
                background: disabled ? token.colorBgContainerDisabled : token.colorBgContainer,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                pointerEvents: 'none',
                userSelect: 'none',
                overflow: 'hidden',
            }}>
                <span style={{
                    flex: 1, fontSize: FONT_SIZE.base,
                    color: display ? token.colorText : token.colorTextPlaceholder,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    opacity: disabled ? 0.5 : 1,
                }}>
                    {display ?? placeholder}
                </span>
                <CalendarOutlined style={{
                    fontSize: FONT_SIZE.md, flexShrink: 0,
                    color: focused ? token.colorPrimary : token.colorTextTertiary,
                    transition: 'color 0.2s',
                }} />
            </div>

            {/* Input nativo invisibile — copre tutta l'area e apre il picker di sistema */}
            <input
                ref={inputRef}
                id={id}
                type={type}
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
                    // 16px evita lo zoom automatico di iOS Safari al focus
                    fontSize: 16,
                }}
            />
        </div>
    );
};

// ─── SafeDatePicker ──────────────────────────────────────────────────────────

type PickerMode = 'date' | 'month';

// Formato del valore scambiato con l'input nativo, per tipo di input.
const NATIVE_FORMAT: Record<NativeInputType, string> = {
    'date': 'YYYY-MM-DD',
    'month': 'YYYY-MM',
    'datetime-local': 'YYYY-MM-DDTHH:mm',
};

// Formato mostrato nel layer visivo: allineato ai fieldFormat della locale (App.tsx).
const DISPLAY_FORMAT: Record<NativeInputType, string> = {
    'date': 'DD/MM/YYYY',
    'month': 'MM/YYYY',
    'datetime-local': 'DD/MM/YYYY HH:mm',
};

export interface SafeDatePickerProps {
    value?: Dayjs | null;
    onChange?: (date: Dayjs | null) => void;
    picker?: PickerMode;
    showTime?: boolean;
    /** Formato di visualizzazione (sia desktop sia nativo) */
    format?: string;
    placeholder?: string;
    disabled?: boolean;
    allowClear?: boolean;
    size?: 'small' | 'middle' | 'large';
    minDate?: Dayjs;
    maxDate?: Dayjs;
    style?: CSSProperties;
    id?: string;
    /** Solo desktop: il picker nativo non ha popup */
    getPopupContainer?: (trigger: HTMLElement) => HTMLElement;
}

export const SafeDatePicker = ({
    value, onChange, picker = 'date', showTime = false, format, placeholder,
    disabled, allowClear = true, size = 'middle', minDate, maxDate, style, id,
    getPopupContainer,
}: SafeDatePickerProps) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const { status } = Form.Item.useStatus();
    // Rilevato una sola volta: il tipo di device non cambia a runtime.
    const [nativePicker] = useState(detectNativeDatePicker);

    if (!nativePicker) {
        return (
            <DatePicker
                id={id}
                value={value}
                onChange={d => onChange?.(d)}
                picker={picker}
                showTime={showTime}
                format={format}
                placeholder={placeholder}
                disabled={disabled}
                allowClear={allowClear}
                size={size}
                minDate={minDate}
                maxDate={maxDate}
                style={style}
                getPopupContainer={getPopupContainer}
            />
        );
    }

    const type: NativeInputType = showTime ? 'datetime-local' : picker;
    const nativeFormat = NATIVE_FORMAT[type];
    const defaultPlaceholder = showTime
        ? t('common.selectDateTime')
        : picker === 'month' ? t('common.selectMonth') : t('common.selectDate');

    return (
        <NativeDateInput
            type={type}
            id={id}
            value={value ? value.format(nativeFormat) : ''}
            onChange={s => onChange?.(s ? dayjs(s, nativeFormat) : null)}
            display={value ? value.format(format ?? DISPLAY_FORMAT[type]) : null}
            placeholder={placeholder ?? defaultPlaceholder}
            disabled={disabled}
            min={minDate?.format(nativeFormat)}
            max={maxDate?.format(nativeFormat)}
            // 44px = touch target minimo (stessa altezza che mobile.css dà a .ant-picker)
            height={size === 'small' ? token.controlHeightSM : 44}
            status={status === 'error' || status === 'warning' ? status : undefined}
            style={style}
        />
    );
};
