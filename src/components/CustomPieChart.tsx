// src/components/CustomPieChart.tsx
import {Flex, Tooltip, Typography} from 'antd';
import {useMediaQuery} from '../hooks/useMediaQuery';

const { Text } = Typography;

interface PieData {
    type: string;
    value: number;
}

interface CustomPieChartProps {
    data: PieData[];
}

const COLORS = ['#1890ff', '#13c2c2', '#2fc25b', '#facc14', '#f04864', '#8543e0', '#3436c7', '#223273'];

const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
};

export const CustomPieChart = ({ data }: CustomPieChartProps) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) return null;

    let cumulativePercent = 0;

    const slices = data.map((item, index) => {
        const percent = item.value / total;
        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        cumulativePercent += percent;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = percent > 0.5 ? 1 : 0;

        const pathData = [
            `M ${startX} ${startY}`, // Move
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
            `L 0 0`, // Line to center
        ].join(' ');

        const tooltipContent = (
            <div>
                <Text strong style={{ color: 'white' }}>{item.type}</Text><br />
                <Text style={{ color: 'white' }}>Valore: {item.value.toFixed(2)} €</Text><br />
                <Text style={{ color: 'white' }}>Percentuale: {(percent * 100).toFixed(2)}%</Text>
            </div>
        );

        return (
            <Tooltip title={tooltipContent} key={index}>
                <path d={pathData} fill={COLORS[index % COLORS.length]} style={{ cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'} onMouseOut={(e) => e.currentTarget.style.opacity = '1'}/>
            </Tooltip>
        );
    });

    const chartSize = isMobile ? 160 : 200;

    return (
        <Flex align="center" justify="space-around" wrap="wrap" gap="middle">
            <div style={{ width: chartSize, height: chartSize, minWidth: chartSize }}>
                <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }}>
                    {slices}
                </svg>
            </div>
            <Flex vertical gap="small" style={{ maxWidth: isMobile ? '100%' : '50%', width: isMobile ? '100%' : 'auto' }}>
                {data.map((item, index) => (
                    <Flex key={index} align="center" gap="small">
                        <div style={{ width: 10, height: 10, backgroundColor: COLORS[index % COLORS.length], borderRadius: '50%', flexShrink: 0 }} />
                        <Text style={{ fontSize: isMobile ? '12px' : '14px' }}>{item.type} ({(item.value / total * 100).toFixed(1)}%)</Text>
                    </Flex>
                ))}
            </Flex>
        </Flex>
    );
};
