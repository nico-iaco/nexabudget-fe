// src/components/CustomBarChart.tsx
import { Typography, Tooltip, Flex } from 'antd';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useState, useRef, useLayoutEffect } from 'react';

dayjs.extend(customParseFormat);

const { Text } = Typography;

export interface BarData {
    month: string;
    type: 'Entrate' | 'Uscite';
    value: number;
}

interface CustomBarChartProps {
    data: BarData[];
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

export const CustomBarChart = ({ data }: CustomBarChartProps) => {
    const { ref, width: chartWidth } = useResizeObserver();
    const months = [...new Set(data.map(d => d.month))]
        .sort((a, b) => dayjs(a, 'MMM YY').valueOf() - dayjs(b, 'MMM YY').valueOf());
    const maxValue = Math.max(...data.map(d => d.value), 1);

    const chartHeight = 300;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };

    const bandWidth = (chartWidth - margin.left - margin.right) / months.length;
    const barPadding = 0.2;
    const barWidth = bandWidth * (1 - barPadding) / 2;

    const getTooltipContent = (month: string) => {
        const monthData = data.filter(d => d.month === month);
        const income = monthData.find(d => d.type === 'Entrate')?.value || 0;
        const expense = monthData.find(d => d.type === 'Uscite')?.value || 0;

        return (
            <div>
                <Text strong style={{ color: 'white' }}>{month}</Text>
                <Flex vertical>
                    <Text style={{ color: 'white' }}>Entrate: {income.toFixed(2)} €</Text>
                    <Text style={{ color: 'white' }}>Uscite: {expense.toFixed(2)} €</Text>
                </Flex>
            </div>
        );
    };

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%', height: chartHeight }}>
            {chartWidth > 0 && (
                <svg width={chartWidth} height={chartHeight}>
                    {/* Asse Y e griglia */}
                    <line x1={margin.left} y1={margin.top} x2={margin.left} y2={chartHeight - margin.bottom} stroke="#ccc" />
                    {[0, 0.25, 0.5, 0.75, 1].map(tick => (
                        <g key={tick}>
                            <text x={margin.left - 8} y={chartHeight - margin.bottom - (tick * (chartHeight - margin.top - margin.bottom))} textAnchor="end" fontSize="12" fill="#666">
                                {(tick * maxValue).toFixed(0)}€
                            </text>
                            <line x1={margin.left} y1={chartHeight - margin.bottom - (tick * (chartHeight - margin.top - margin.bottom))} x2={chartWidth - margin.right} y2={chartHeight - margin.bottom - (tick * (chartHeight - margin.top - margin.bottom))} stroke="#eee" />
                        </g>
                    ))}

                    {/* Asse X */}
                    <line x1={margin.left} y1={chartHeight - margin.bottom} x2={chartWidth - margin.right} y2={chartHeight - margin.bottom} stroke="#ccc" />

                    {/* Barre e Etichette X */}
                    {months.map((month, index) => {
                        const monthData = data.filter(d => d.month === month);
                        const incomeData = monthData.find(d => d.type === 'Entrate');
                        const expenseData = monthData.find(d => d.type === 'Uscite');

                        const bandStart = margin.left + index * bandWidth;
                        const x1 = bandStart + (bandWidth * barPadding / 2);
                        const x2 = x1 + barWidth;

                        const incomeHeight = incomeData ? (incomeData.value / maxValue) * (chartHeight - margin.top - margin.bottom) : 0;
                        const expenseHeight = expenseData ? (expenseData.value / maxValue) * (chartHeight - margin.top - margin.bottom) : 0;

                        const showLabel = chartWidth < 500 ? index % 2 === 0 : true;

                        return (
                            <g key={month}>
                                <Tooltip title={getTooltipContent(month)}>
                                    <g style={{ cursor: 'pointer' }}>
                                        <rect x={x1} y={chartHeight - margin.bottom - incomeHeight} width={barWidth} height={incomeHeight} fill="#3f8600" />
                                        <rect x={x2} y={chartHeight - margin.bottom - expenseHeight} width={barWidth} height={expenseHeight} fill="#cf1322" />
                                    </g>
                                </Tooltip>
                                {showLabel && (
                                    <text x={bandStart + bandWidth / 2} y={chartHeight - margin.bottom + 20} textAnchor="middle" fontSize="12" fill="#666">
                                        {month}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            )}
        </div>
    );
};
