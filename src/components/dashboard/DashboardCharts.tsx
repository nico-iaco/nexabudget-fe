import { Column, Line, Pie } from '@ant-design/charts';
import { Empty, Flex, Progress, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { BarData, LineData } from '../../hooks/useDashboardData';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePreferences } from '../../contexts/PreferencesContext';

const { Text } = Typography;

const TooltipGlobalStyles = ({ isDark }: { isDark: boolean }) => (
    <style>{`
        .g2-tooltip {
            background-color: ${isDark ? '#1f1f1f' : '#ffffff'} !important;
            color: ${isDark ? '#ffffff' : '#000000'} !important;
            box-shadow: 0 3px 6px -4px rgba(0,0,0,0.48), 0 6px 16px 0 rgba(0,0,0,0.32), 0 9px 28px 8px rgba(0,0,0,0.2) !important;
        }
        /* Force all text inside tooltip to follow the theme color */
        .g2-tooltip * {
            color: ${isDark ? '#ffffff' : '#000000'} !important;
        }
        .g2-tooltip-title {
            color: ${isDark ? '#ffffff' : '#000000'} !important;
        }
        .g2-tooltip-list-item-label {
             color: ${isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.65)'} !important;
        }
    `}</style>
);

interface PieChartProps {
    data: { type: string; value: number }[];
}

export const GenericPieChart = ({ data }: PieChartProps) => {
    const { t } = useTranslation();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

    if (isMobile) {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        const sorted = [...data].sort((a, b) => b.value - a.value);
        return (
            <Flex vertical gap={10}>
                {sorted.map((item) => {
                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    return (
                        <div key={item.type}>
                            <Flex justify="space-between" style={{ marginBottom: 2 }}>
                                <Text style={{ fontSize: 13 }}>{item.type}</Text>
                                <Text style={{ fontSize: 13 }} type="secondary">
                                    {item.value.toFixed(2)} ({pct}%)
                                </Text>
                            </Flex>
                            <Progress percent={pct} showInfo={false} size="small" strokeColor={isDark ? '#177ddc' : '#1890ff'} />
                        </div>
                    );
                })}
            </Flex>
        );
    }

    const config = {
        data,
        angleField: 'value',
        colorField: 'type',
        radius: 0.8,
        label: false,
        theme: isDark ? 'dark' : undefined,
        legend: { position: 'right' as const },
        interactions: [{ type: 'element-active' }],
    };

    return (
        <>
            <TooltipGlobalStyles isDark={isDark} />
            <Pie {...config} />
        </>
    );
};

interface BarChartProps {
    data: BarData[];
}

export const TrendBarChart = ({ data }: BarChartProps) => {
    const { t } = useTranslation();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

    const months = [...new Set(data.map(d => d.month))];
    const minWidth = Math.max(months.length * 56, 300);

    const config = {
        data,
        xField: 'month',
        yField: 'value',
        colorField: 'type',
        isGroup: true,
        seriesField: 'type',
        theme: isDark ? 'dark' : undefined,
        columnStyle: { radius: [2, 2, 0, 0] },
        legend: { position: (isMobile ? 'bottom' : 'top-left') as 'bottom' | 'top-left' },
        xAxis: { label: { style: { fill: isDark ? '#ffffff' : '#000000' } } },
        yAxis: { label: { style: { fill: isDark ? '#ffffff' : '#000000' } } },
    };

    return (
        <>
            <TooltipGlobalStyles isDark={isDark} />
            {isMobile ? (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ minWidth }}>
                        <Column {...config} />
                    </div>
                </div>
            ) : (
                <Column {...config} />
            )}
        </>
    );
};

interface LineChartProps {
    data: LineData[];
}

export const NetBalanceLineChart = ({ data }: LineChartProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

    const config = {
        data,
        xField: 'label',
        yField: 'value',
        point: {
            size: 4,
            shape: 'square',
        },

        lineStyle: {
            lineWidth: 2,
        },
        theme: isDark ? 'dark' : undefined,
        xAxis: {
            label: {
                style: {
                    fill: isDark ? '#ffffff' : '#000000',
                },
            },
        },
        yAxis: {
            label: {
                style: {
                    fill: isDark ? '#ffffff' : '#000000',
                },
            },
        },
    };

    return (
        <>
            <TooltipGlobalStyles isDark={isDark} />
            <Line {...config} />
        </>
    );
};
