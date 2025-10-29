// src/components/charts/CustomBarChart.tsx
import { Typography, Tooltip, Flex } from 'antd';

const { Text } = Typography;

interface BarData {
    month: string;
    type: 'Entrate' | 'Uscite';
    value: number;
}

interface CustomBarChartProps {
    data: BarData[];
}

export const CustomBarChart = ({ data }: CustomBarChartProps) => {
    const months = [...new Set(data.map(d => d.month))].sort();
    const maxValue = Math.max(...data.map(d => d.value), 1); // Evita divisione per zero

    const chartHeight = 250;
    const chartWidth = 500;
    const barWidth = (chartWidth / months.length) * 0.35;
    const barMargin = (chartWidth / months.length) * 0.15;

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
        <div style={{ position: 'relative', width: '100%', height: chartHeight + 50 }}>
            <svg width="100%" height={chartHeight + 50} viewBox={`0 0 ${chartWidth + 50} ${chartHeight + 30}`}>
                {/* Asse Y */}
                <line x1="40" y1="0" x2="40" y2={chartHeight} stroke="#ccc" />
                {[0, 0.25, 0.5, 0.75, 1].map(tick => (
                    <g key={tick}>
                        <text x="35" y={chartHeight - tick * chartHeight + 5} textAnchor="end" fontSize="10" fill="#666">
                            {(tick * maxValue).toFixed(0)}
                        </text>
                        <line x1="40" y1={chartHeight - tick * chartHeight} x2={chartWidth + 40} y2={chartHeight - tick * chartHeight} stroke="#eee" />
                    </g>
                ))}

                {/* Barre e Asse X */}
                {months.map((month, index) => {
                    const monthData = data.filter(d => d.month === month);
                    const incomeData = monthData.find(d => d.type === 'Entrate');
                    const expenseData = monthData.find(d => d.type === 'Uscite');

                    const x = 40 + index * (barWidth * 2 + barMargin * 2) + barMargin;
                    const incomeHeight = incomeData ? (incomeData.value / maxValue) * chartHeight : 0;
                    const expenseHeight = expenseData ? (expenseData.value / maxValue) * chartHeight : 0;

                    return (
                        <g key={month}>
                            <Tooltip title={getTooltipContent(month)}>
                                <g style={{ cursor: 'pointer' }}>
                                    {/* Barra Entrate */}
                                    <rect
                                        x={x}
                                        y={chartHeight - incomeHeight}
                                        width={barWidth}
                                        height={incomeHeight}
                                        fill="#3f8600"
                                    />
                                    {/* Barra Uscite */}
                                    <rect
                                        x={x + barWidth + barMargin}
                                        y={chartHeight - expenseHeight}
                                        width={barWidth}
                                        height={expenseHeight}
                                        fill="#cf1322"
                                    />
                                </g>
                            </Tooltip>
                            {/* Etichetta Mese */}
                            <text x={x + barWidth + barMargin / 2} y={chartHeight + 15} textAnchor="middle" fontSize="10" fill="#666">
                                {month}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
