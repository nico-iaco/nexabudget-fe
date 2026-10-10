// src/components/dashboard/Sparkline.tsx
// Mini-trend decorativo sotto le StatCard. Unica implementazione: prima era copiata in
// DashboardCharts e DashboardChartsMobile, con spaziature diverse fra le due copie.
// Entrambi i moduli la riesportano, così il lazy loader di DashboardPage non cambia.
import { theme } from 'antd';
import { SPACING } from '../../theme/tokens';

interface SparklineProps {
    values: number[];
    color?: string;
    height?: number;
}

export const Sparkline = ({ values, color, height = 32 }: SparklineProps) => {
    const { token } = theme.useToken();
    const resolvedColor = color ?? token.colorPrimary;
    if (!values || values.length < 2) return null;
    const w = 100;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = w / (values.length - 1);
    const points = values
        .map((v, i) => `${(i * stepX).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
        .join(' ');
    const areaPoints = `0,${height} ${points} ${w},${height}`;
    return (
        // Decorativa: accompagna un valore già leggibile nella card, niente da annunciare.
        <svg aria-hidden="true" focusable="false" width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block', marginTop: SPACING.xs }}>
            <polygon points={areaPoints} fill={resolvedColor} fillOpacity={0.18} />
            <polyline points={points} fill="none" stroke={resolvedColor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
    );
};
