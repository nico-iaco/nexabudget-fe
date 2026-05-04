import { Empty, Flex, Progress, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { BarData } from '../../hooks/useDashboardData';
import { usePreferences } from '../../contexts/PreferencesContext';
import { COLOR_POSITIVE, COLOR_NEGATIVE } from '../../theme/tokens';

const { Text } = Typography;

interface PieChartProps {
    data: { type: string; value: number }[];
}

export const GenericPieChart = ({ data }: PieChartProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

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
                        <Progress
                            aria-label={`${item.type} ${pct}%`}
                            percent={pct}
                            showInfo={false}
                            size="small"
                            strokeColor={isDark ? '#177ddc' : '#1890ff'}
                        />
                    </div>
                );
            })}
        </Flex>
    );
};

interface BarChartProps {
    data: BarData[];
}

export const TrendBarChart = ({ data }: BarChartProps) => {
    const { t } = useTranslation();
    if (!data || data.length === 0) return <Empty description={t('charts.noData')} />;

    const months = [...new Set(data.map(d => d.month))];
    const maxValue = Math.max(...data.map(d => d.value), 1);

    const colorFor = (type: string) =>
        type === 'Entrate' ? COLOR_POSITIVE : COLOR_NEGATIVE;

    const types = [...new Set(data.map(d => d.type))];

    return (
        <div>
            {/* Legend */}
            <Flex gap={12} style={{ marginBottom: 8 }}>
                {types.map(type => (
                    <Flex key={type} align="center" gap={4}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colorFor(type) }} />
                        <Text style={{ fontSize: 11 }}>{type}</Text>
                    </Flex>
                ))}
            </Flex>

            {/* Bars */}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'flex', gap: 6, minWidth: months.length * 52, alignItems: 'flex-end', height: 140, paddingBottom: 20, position: 'relative' }}>
                    {months.map(month => {
                        const monthData = data.filter(d => d.month === month);
                        return (
                            <div
                                key={month}
                                style={{ flex: 1, minWidth: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
                            >
                                <Flex gap={2} align="flex-end" style={{ width: '100%', height: 'calc(100% - 18px)' }}>
                                    {monthData.map(d => (
                                        <div
                                            key={d.type}
                                            title={`${d.type}: ${d.value.toFixed(2)} €`}
                                            style={{
                                                flex: 1,
                                                height: `${Math.max((d.value / maxValue) * 100, 2)}%`,
                                                backgroundColor: colorFor(d.type),
                                                borderRadius: '2px 2px 0 0',
                                                opacity: 0.85,
                                                minHeight: 2,
                                            }}
                                        />
                                    ))}
                                </Flex>
                                <Text style={{ fontSize: 9, marginTop: 3, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                    {month}
                                </Text>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
