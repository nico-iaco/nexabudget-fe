import type { ReactNode } from 'react';
import { Card, Statistic } from 'antd';
import { FONT_HEADING } from '../../theme/tokens';
import { formatMoney } from '../../utils/format';

interface StatCardProps {
    title: ReactNode;
    value?: string | number;
    precision?: number;
    color?: string;
    prefix?: ReactNode;
    suffix?: ReactNode;
    formatter?: (value: string | number) => ReactNode;
    /** Formatta il valore come importo in questa valuta (ignorato se c'è `formatter`). */
    currency?: string;
    loading?: boolean;
    size?: 'default' | 'small';
    variant?: 'outlined' | 'borderless';
    /** Contenuto aggiuntivo sotto la Statistic (es. sparkline, variazione %). */
    footer?: ReactNode;
    style?: React.CSSProperties;
    /** Sfondo gradiente + testo bianco, per la metrica principale di una pagina. */
    gradient?: string;
}

/**
 * Card con singola metrica (Statistic + footer opzionale).
 * Unifica le implementazioni duplicate in DashboardPage, BalanceTrendSection e PortfolioSummary.
 */
export const StatCard = ({
    title, value, precision, color, prefix, suffix, formatter, currency, loading, size, variant = 'outlined', footer, style, gradient,
}: StatCardProps) => (
    <Card
        size={size}
        variant={variant}
        style={gradient ? { background: gradient, border: 'none', ...style } : style}
    >
        <Statistic
            title={gradient ? <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{title}</span> : title}
            value={value}
            precision={precision}
            styles={{
                content: {
                    color: gradient ? '#fff' : color,
                    ...(gradient ? { fontFamily: FONT_HEADING, fontWeight: 800 } : {}),
                },
            }}
            prefix={prefix}
            suffix={suffix}
            formatter={(formatter ?? (currency ? (v: string | number) => formatMoney(Number(v), currency) : undefined)) as never}
            loading={loading}
        />
        {footer}
    </Card>
);
