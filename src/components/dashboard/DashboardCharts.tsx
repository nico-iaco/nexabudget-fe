import { Column, Line, Pie } from '@ant-design/charts';
import { Empty } from 'antd';
import type { BarData, LineData } from '../../hooks/useDashboardData';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface PieChartProps {
    data: { type: string; value: number }[];
}

export const IncomePieChart = ({ data }: PieChartProps) => {
    if (!data || data.length === 0) return <Empty description="Nessun dato disponibile" />;

    const total = data.reduce((acc, item) => acc + item.value, 0);

    const isMobile = useMediaQuery('(max-width: 768px)');

    const config = {
        data,
        angleField: 'value',
        colorField: 'type',
        radius: 0.8,
        label: false,
        tooltip: {
            title: 'type',
            items: [
                {
                    field: 'value',
                    valueFormatter: (v: number) => {
                        const percent = total > 0 ? (v / total) * 100 : 0;
                        return `${v.toFixed(2)}€ (${percent.toFixed(2)}%)`;
                    }
                }
            ]
        },
        legend: {
            color: {
                title: false,
                position: isMobile ? 'bottom' : 'right',
                rowPadding: 5,
            },
        },
        interactions: [
            {
                type: 'element-active',
            },
        ],
    };
    // @ts-ignore
    return <Pie {...config} />;
};

export const ExpensePieChart = ({ data }: PieChartProps) => {
    if (!data || data.length === 0) return <Empty description="Nessun dato disponibile" />;

    const total = data.reduce((acc, item) => acc + item.value, 0);

    const isMobile = useMediaQuery('(max-width: 768px)');

    const config = {
        data,
        angleField: 'value',
        colorField: 'type',
        radius: 0.8,
        label: false,
        tooltip: {
            title: 'type',
            items: [
                {
                    field: 'value',
                    valueFormatter: (v: number) => {
                        const percent = total > 0 ? (v / total) * 100 : 0;
                        return `${v.toFixed(2)}€ (${percent.toFixed(2)}%)`;
                    }
                }
            ]
        },
        legend: {
            color: {
                title: false,
                position: isMobile ? 'bottom' : 'right',
                rowPadding: 5,
            },
        },
        interactions: [
            {
                type: 'element-active',
            },
        ],
    };
    // @ts-ignore
    return <Pie {...config} />;
};

interface BarChartProps {
    data: BarData[];
}

export const TrendBarChart = ({ data }: BarChartProps) => {
    if (!data || data.length === 0) return <Empty description="Nessun dato disponibile" />;

    const isMobile = useMediaQuery('(max-width: 768px)');

    const config = {
        data,
        xField: 'month',
        yField: 'value',
        colorField: 'type',
        group: true,
        style: {
            inset: 5,
        },
        legend: {
            position: isMobile ? 'bottom' : 'top-left',
        },
    };
    // @ts-ignore
    return <Column {...config} />;
};

interface LineChartProps {
    data: LineData[];
}

export const NetBalanceLineChart = ({ data }: LineChartProps) => {
    if (!data || data.length === 0) return <Empty description="Nessun dato disponibile" />;

    const config = {
        data,
        xField: 'label',
        yField: 'value',
        point: {
            shapeField: 'square',
            sizeField: 4,
        },
        interaction: {
            tooltip: {
                marker: false,
            },
        },
        style: {
            lineWidth: 2,
        },
    };
    // @ts-ignore
    return <Line {...config} />;
};
