// src/components/CustomLineChart.tsx
import { Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState, useRef, useLayoutEffect } from 'react';

const { Text } = Typography;

export interface LineData {
    label: string;
    value: number;
    monthlyNet?: number;
}

interface CustomLineChartProps {
    data: LineData[];
    dataKey: string;
    valueKey: string;
}

const useResizeObserver = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                setWidth(entries[0].contentRect.width);
            }
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { ref, width };
};


export const CustomLineChart = ({ data, dataKey, valueKey }: CustomLineChartProps) => {
    const { ref, width: chartWidth } = useResizeObserver();
    if (!data || data.length === 0) return null;

    const chartHeight = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };

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
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    const getTooltipContent = (item: LineData) => {
        const label = dayjs(item.label).format('MMM YYYY');
        const totalBalance = item.value.toFixed(2);

        return (
            <div>
                <Text strong style={{ color: 'white' }}>{label}</Text>
                <div><Text style={{ color: 'white' }}>Bilancio Totale: {totalBalance}€</Text></div>
                {item.monthlyNet !== undefined && (
                    <div>
                        <Text style={{ color: 'white' }}>
                            Saldo del mese: <span style={{ color: item.monthlyNet >= 0 ? '#87d068' : '#f50' }}>{item.monthlyNet.toFixed(2)}€</span>
                        </Text>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%', height: chartHeight }}>
            {chartWidth > 0 && (
                <svg width={chartWidth} height={chartHeight}>
                    {/* Asse Y e griglia */}
                    <line x1={margin.left} y1={margin.top} x2={margin.left} y2={chartHeight - margin.bottom} stroke="#ccc" />
                    {[minVal, minVal + range / 2, maxVal].map((tick, i) => (
                        <g key={i}>
                            <text x={margin.left - 8} y={getY(tick) + 4} textAnchor="end" fontSize="12" fill="#666">
                                {tick.toFixed(0)}€
                            </text>
                            <line x1={margin.left} y1={getY(tick)} x2={chartWidth - margin.right} y2={getY(tick)} stroke="#eee" />
                        </g>
                    ))}
                    {/* Linea dello zero */}
                    <line x1={margin.left} y1={zeroLineY} x2={chartWidth - margin.right} y2={zeroLineY} stroke="#999" strokeDasharray="2,2" />

                    {/* Asse X */}
                    <line x1={margin.left} y1={chartHeight - margin.bottom} x2={chartWidth - margin.right} y2={chartHeight - margin.bottom} stroke="#ccc" />
                    {data.map((d, i) => {
                        const showLabel = chartWidth < 400 ? i % 2 === 0 : true;
                        if (!showLabel) return null;
                        return (
                            <text key={i} x={getX(i)} y={chartHeight - margin.bottom + 20} textAnchor="middle" fontSize="12" fill="#666">
                                {dayjs(d[dataKey as keyof LineData] as string).format('MMM YY')}
                            </text>
                        );
                    })}

                    {/* Linea del grafico */}
                    <path d={path} fill="none" stroke="#1890ff" strokeWidth="2.5" />

                    {/* Punti con Tooltip */}
                    {data.map((d, i) => (
                        <Tooltip key={i} title={getTooltipContent(d)}>
                            <circle
                                cx={getX(i)}
                                cy={getY(d[valueKey as keyof LineData] as number)}
                                r="5"
                                fill="#1890ff"
                                stroke="white"
                                strokeWidth="2.5"
                                style={{ cursor: 'pointer' }}
                            />
                        </Tooltip>
                    ))}
                </svg>
            )}
        </div>
    );
};
