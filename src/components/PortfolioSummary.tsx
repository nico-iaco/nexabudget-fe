import React, {useMemo} from 'react';
import {Button, Card, Col, Popconfirm, Row, Statistic, Table, Tag} from 'antd';
import {DeleteOutlined, EditOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import type {CryptoAsset, PortfolioValueResponse} from '../types/api.ts';

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
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'it' ? 'it-IT' : 'en-US';
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
            title: t('portfolio.asset'),
            dataIndex: 'symbol',
            key: 'symbol',
            render: (text: string, _: GroupedAsset, index: number) => (
                <Tag color={colors[index % colors.length]}>{text}</Tag>
            ),
        },
        {
            title: t('portfolio.amount'),
            dataIndex: 'amount',
            key: 'amount',
            render: (amount: number) => amount.toLocaleString(locale, { maximumFractionDigits: 8 }),
        },
        {
            title: t('portfolio.price'),
            dataIndex: 'price',
            key: 'price',
            render: (price: number) =>
                new Intl.NumberFormat(locale, { style: 'currency', currency: data?.currency || 'USD' }).format(price),
        },
        {
            title: t('portfolio.value'),
            dataIndex: 'value',
            key: 'value',
            render: (value: number) =>
                new Intl.NumberFormat(locale, { style: 'currency', currency: data?.currency || 'USD' }).format(value),
        },
    ];

    const expandedRowRender = (record: GroupedAsset) => {
        const innerColumns = [
            { title: t('portfolio.source'), dataIndex: 'source', key: 'source' },
            {
                title: t('portfolio.amount'),
                dataIndex: 'amount',
                key: 'amount',
                render: (amount: number) => amount.toLocaleString(locale, { maximumFractionDigits: 8 }),
            },
            {
                title: t('portfolio.value'),
                dataIndex: 'value',
                key: 'value',
                render: (value: number) =>
                    new Intl.NumberFormat(locale, { style: 'currency', currency: data?.currency || 'USD' }).format(value),
            },
            {
                title: t('portfolio.actions'),
                key: 'actions',
                render: (_value: unknown, asset: CryptoAsset) => {
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
                                    title={t('portfolio.deleteHolding')}
                                    description={t('portfolio.deleteHoldingConfirm')}
                                    onConfirm={() => onDeleteAsset?.(asset)}
                                    okText={t('common.yes')}
                                    cancelText={t('common.no')}
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
                            title={t('portfolio.totalValue')}
                            value={data?.totalValue}
                            precision={2}
                            valueStyle={{ color: '#3f8600' }}
                            prefix={data?.currency === 'EUR' ? '€' : '$'}
                            loading={loading}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title={t('portfolio.yourAssets')} bordered={false}>
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
