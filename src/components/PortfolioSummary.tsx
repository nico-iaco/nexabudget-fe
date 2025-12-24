import React, { useMemo } from 'react';
import { Button, Card, Col, Popconfirm, Row, Statistic, Table, Tag } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { CryptoAsset, PortfolioValueResponse } from '../types/api.ts';

interface PortfolioSummaryProps {
    data: PortfolioValueResponse | null;
    loading: boolean;
    onEditAsset?: (asset: CryptoAsset) => void;
    onDeleteAsset?: (asset: CryptoAsset) => void;
}

interface GroupedAsset {
    symbol: string;
    amount: number;
    price: number;
    value: number;
    assets: CryptoAsset[];
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ data, loading, onEditAsset, onDeleteAsset }) => {
    const groupedAssets = useMemo(() => {
        if (!data?.assets) return [];
        const groups: Record<string, GroupedAsset> = {};

        data.assets.forEach(asset => {
            if (!groups[asset.symbol]) {
                groups[asset.symbol] = {
                    symbol: asset.symbol,
                    amount: 0,
                    price: asset.price, // Assuming price is same for same symbol or taking one
                    value: 0,
                    assets: []
                };
            }
            groups[asset.symbol].amount += asset.amount;
            groups[asset.symbol].value += asset.value;
            groups[asset.symbol].assets.push(asset);
        });

        return Object.values(groups);
    }, [data?.assets]);

    const colors = ['magenta', 'red', 'volcano', 'orange', 'gold', 'lime', 'green', 'cyan', 'blue', 'geekblue', 'purple'];

    const columns = [
        {
            title: 'Asset',
            dataIndex: 'symbol',
            key: 'symbol',
            render: (text: string, _: GroupedAsset, index: number) => (
                <Tag color={colors[index % colors.length]}>{text}</Tag>
            ),
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

    const expandedRowRender = (record: GroupedAsset) => {
        const innerColumns = [
            { title: 'Source', dataIndex: 'source', key: 'source' },
            {
                title: 'Amount',
                dataIndex: 'amount',
                key: 'amount',
                render: (amount: number) => amount.toLocaleString(undefined, { maximumFractionDigits: 8 }),
            },
            {
                title: 'Value',
                dataIndex: 'value',
                key: 'value',
                render: (value: number) =>
                    new Intl.NumberFormat('en-US', { style: 'currency', currency: data?.currency || 'USD' }).format(value),
            },
            {
                title: 'Actions',
                key: 'actions',
                render: (_: any, asset: CryptoAsset) => {
                    if (asset.source === 'MANUAL') {
                        return (
                            <span>
                                <Button
                                    icon={<EditOutlined />}
                                    size="small"
                                    style={{ marginRight: 8 }}
                                    onClick={() => onEditAsset?.(asset)}
                                />
                                <Popconfirm
                                    title="Delete holding"
                                    description="Are you sure you want to delete this holding?"
                                    onConfirm={() => onDeleteAsset?.(asset)}
                                    okText="Yes"
                                    cancelText="No"
                                >
                                    <Button icon={<DeleteOutlined />} size="small" danger />
                                </Popconfirm>
                            </span>
                        );
                    }
                    return null;
                },
            },
        ];

        return <Table columns={innerColumns} dataSource={record.assets} pagination={false} rowKey="id" />;
    };

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
                            prefix={data?.currency === 'EUR' ? '€' : '$'}
                            loading={loading}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title="Your Assets" bordered={false}>
                <Table
                    dataSource={groupedAssets}
                    columns={columns}
                    rowKey="symbol"
                    loading={loading}
                    pagination={false}
                    scroll={{ x: true }}
                    expandable={{
                        expandedRowRender,
                        defaultExpandedRowKeys: [], // Optionally expand all by default if needed
                    }}
                />
            </Card>
        </div>
    );
};
