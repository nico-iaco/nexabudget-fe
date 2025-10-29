// src/components/CustomLineChart.tsx
import { Tooltip } from 'antd';


export interface LineData {
    label: string;
    value: number;
}

interface CustomLineChartProps {
    data: LineData[];
    dataKey: string;
    valueKey: string;
}

export const CustomLineChart = ({ data, dataKey, valueKey }: CustomLineChartProps) => {
    if (!data || data.length === 0) return null;

    const chartHeight = 250;
    const chartWidth = 500;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };

    const values = data.map(d => d[valueKey as keyof LineData] as number);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 0);
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const getX = (index: number) => margin.left + index * ((chartWidth - margin.left - margin.right) / (data.length - 1 || 1));
    const getY = (value: number) => chartHeight - margin.bottom - ((value - minVal) / range) * (chartHeight - margin.top - margin.bottom);

    const zeroLineY = getY(0);

    const path = data.map((d, i) => {
        const x = getX(i);
        const y = getY(d[valueKey as keyof LineData] as number);
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');

    return (
        <div style={{ position: 'relative', width: '100%', height: chartHeight + 50 }}>
            <svg width="100%" height={chartHeight + 50} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                {/* Asse Y e griglia */}
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={chartHeight - margin.bottom} stroke="#ccc" />
                {[minVal, minVal + range / 2, maxVal].map((tick, i) => (
                    <g key={i}>
                        <text x={margin.left - 5} y={getY(tick) + 3} textAnchor="end" fontSize="10" fill="#666">
                            {tick.toFixed(0)}€
                        </text>
                        <line x1={margin.left} y1={getY(tick)} x2={chartWidth - margin.right} y2={getY(tick)} stroke="#eee" />
                    </g>
                ))}
                {/* Linea dello zero */}
                <line x1={margin.left} y1={zeroLineY} x2={chartWidth - margin.right} y2={zeroLineY} stroke="#999" strokeDasharray="2,2" />

                {/* Asse X */}
                <line x1={margin.left} y1={chartHeight - margin.bottom} x2={chartWidth - margin.right} y2={chartHeight - margin.bottom} stroke="#ccc" />
                {data.map((d, i) => (
                    <text key={i} x={getX(i)} y={chartHeight - margin.bottom + 15} textAnchor="middle" fontSize="10" fill="#666">
                        {d[dataKey as keyof LineData]}
                    </text>
                ))}

                {/* Linea del grafico */}
                <path d={path} fill="none" stroke="#1890ff" strokeWidth="2" />

                {/* Punti con Tooltip */}
                {data.map((d, i) => (
                    <Tooltip
                        key={i}
                        title={`${d[dataKey as keyof LineData]}: ${(d[valueKey as keyof LineData] as number).toFixed(2)}€`}
                    >
                        <circle
                            cx={getX(i)}
                            cy={getY(d[valueKey as keyof LineData] as number)}
                            r="4"
                            fill="#1890ff"
                            stroke="white"
                            strokeWidth="2"
                            style={{ cursor: 'pointer' }}
                        />
                    </Tooltip>
                ))}
            </svg>
        </div>
    );
};
