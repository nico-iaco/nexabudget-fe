import {Column, Line, Pie} from '@ant-design/charts';
import {Empty} from 'antd';
import {useTranslation} from 'react-i18next';
import type {BarData, LineData} from '../../hooks/useDashboardData';
import {useMediaQuery} from '../../hooks/useMediaQuery';

interface PieChartProps {
    data: { type: string; value: number }[];
}

export const GenericPieChart = ({ data }: PieChartProps) => {
    const { t } = useTranslation();
    const isMobile = useMediaQuery('(max-width: 768px)');
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

    const total = data.reduce((acc, item) => acc + item.value, 0);

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

    return <Pie {...config} />;
};

interface BarChartProps {
    data: BarData[];
}

export const TrendBarChart = ({ data }: BarChartProps) => {
    const { t } = useTranslation();
    const isMobile = useMediaQuery('(max-width: 768px)');
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

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

    return <Column {...config} />;
};

interface LineChartProps {
    data: LineData[];
}

export const NetBalanceLineChart = ({ data }: LineChartProps) => {
    const { t } = useTranslation();
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

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
    
    return <Line {...config} />;
};
