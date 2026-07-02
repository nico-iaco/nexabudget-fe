import type { ReactNode } from 'react';
import { Card, Statistic } from 'antd';

interface StatCardProps {
    title: ReactNode;
    value?: string | number;
    precision?: number;
    color?: string;
    prefix?: ReactNode;
    suffix?: ReactNode;
    formatter?: (value: string | number) => ReactNode;
    loading?: boolean;
    size?: 'default' | 'small';
    bordered?: boolean;
    /** Contenuto aggiuntivo sotto la Statistic (es. sparkline, variazione %). */
    footer?: ReactNode;
    style?: React.CSSProperties;
}

/**
 * Card con singola metrica (Statistic + footer opzionale).
 * Unifica le implementazioni duplicate in DashboardPage, BalanceTrendSection e PortfolioSummary.
 */
export const StatCard = ({
    title, value, precision, color, prefix, suffix, formatter, loading, size, bordered = true, footer, style,
}: StatCardProps) => (
    <Card size={size} bordered={bordered} style={style}>
        <Statistic
            title={title}
            value={value}
            precision={precision}
            valueStyle={color ? { color } : undefined}
            prefix={prefix}
            suffix={suffix}
            formatter={formatter as never}
            loading={loading}
        />
        {footer}
    </Card>
);
