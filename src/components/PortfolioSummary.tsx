import React from 'react';
import {Card, Col, Row, Statistic, Table, Typography} from 'antd';
import type {PortfolioValueResponse} from '../types/api.ts';

interface PortfolioSummaryProps {
    data: PortfolioValueResponse | null;
    loading: boolean;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ data, loading }) => {
    const columns = [
        {
            title: 'Asset',
            dataIndex: 'symbol',
            key: 'symbol',
            render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount: number) => amount.toLocaleString(undefined, { maximumFractionDigits: 8 }),
        },
        {
            title: 'Price',
            dataIndex: 'price',
            key: 'price',
            render: (price: number) =>
                new Intl.NumberFormat('en-US', { style: 'currency', currency: data?.currency || 'USD' }).format(price),
        },
        {
            title: 'Value',
            dataIndex: 'value',
            key: 'value',
            render: (value: number) =>
                new Intl.NumberFormat('en-US', { style: 'currency', currency: data?.currency || 'USD' }).format(value),
        },
    ];

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                <Col xs={24} sm={12} md={8}>
                    <Card bordered={false}>
                        <Statistic
                            title="Total Portfolio Value"
                            value={data?.totalValue}
                            precision={2}
                            valueStyle={{ color: '#3f8600' }}
                            prefix={data?.currency === 'EUR' ? '€' : '$'} // Simple check, can be improved
                            loading={loading}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title="Your Assets" bordered={false}>
                <Table
                    dataSource={data?.assets}
                    columns={columns}
                    rowKey="symbol"
                    loading={loading}
                    pagination={false}
                />
            </Card>
        </div>
    );
};
