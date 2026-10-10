import React, {useMemo} from 'react';
import {Button, Card, Col, Collapse, Popconfirm, Row, Table, Tag, Typography, Flex, theme} from 'antd';
import {DeleteOutlined, EditOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import type {CryptoAsset, PortfolioValueResponse} from '../types/api.ts';
import {CHART_CATEGORICAL, FONT_SIZE, SPACING, GRADIENT_BALANCE, GRADIENT_BALANCE_DARK} from '../theme/tokens';
import { useBreakpoints } from '../hooks/useBreakpoints';
import {usePreferences} from '../contexts/PreferencesContext';
import {StatCard} from './common/StatCard';
import { formatMoney, formatNumber, formatUnitPrice } from '../utils/format';
import { ItemList } from './common/ItemList';
import { useConfirm } from '../hooks/useConfirm';
import { EmptyState } from './common/EmptyState';

const { Text } = Typography;

// Colore del tag dal simbolo, non dalla posizione in pagina: prima lo stesso asset
// cambiava colore cambiando pagina o ordinamento. Palette condivisa con i grafici.
const symbolColor = (symbol: string): string => {
    let hash = 0;
    for (const ch of symbol) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return CHART_CATEGORICAL[hash % CHART_CATEGORICAL.length];
};

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
    const { t } = useTranslation();
    const confirm = useConfirm();
    const { isSmallMobile: isMobile } = useBreakpoints();
    const { preferences } = usePreferences();
    const { token } = theme.useToken();
    const isDark = preferences.theme === 'dark';
    const heroGradient = isDark ? GRADIENT_BALANCE_DARK : GRADIENT_BALANCE;
    const groupedAssets = useMemo(() => {
        if (!data?.assets) return [];
        const groups: Record<string, GroupedAsset> = {};

        data.assets.forEach(asset => {
            // Il backend tratta i simboli senza distinzione di maiuscole ("btc" = "BTC").
            const symbol = asset.symbol.toUpperCase();
            if (!groups[symbol]) {
                groups[symbol] = {
                    symbol,
                    amount: 0,
                    price: asset.price, // Assuming price is same for same symbol or taking one
                    value: 0,
                    assets: []
                };
            }
            groups[symbol].amount += asset.amount;
            groups[symbol].value += asset.value;
            groups[symbol].assets.push(asset);
        });

        return Object.values(groups);
    }, [data?.assets]);


    // utils/format tiene in cache i formatter Intl (costosi da costruire), quindi
    // chiamarlo per cella non ricostruisce nulla.
    const currency = data?.currency || 'USD';
    const formatAmount = (v: number) => formatMoney(v, currency);

    const columns = [
        {
            title: t('portfolio.asset'),
            dataIndex: 'symbol',
            key: 'symbol',
            render: (text: string) => (
                <Tag color={symbolColor(text)}>{text}</Tag>
            ),
        },
        {
            title: t('portfolio.amount'),
            dataIndex: 'amount',
            key: 'amount',
            render: (amount: number) => formatNumber(amount, 8),
        },
        {
            title: t('portfolio.price'),
            dataIndex: 'price',
            key: 'price',
            // Prezzo unitario con decimali dinamici: i token sotto il centesimo non sono 0,00.
            render: (price: number) => formatUnitPrice(price, currency),
        },
        {
            title: t('portfolio.value'),
            dataIndex: 'value',
            key: 'value',
            render: (value: number) =>
                formatAmount(value),
        },
    ];

    const expandedRowRender = (record: GroupedAsset) => {
        const innerColumns = [
            { title: t('portfolio.source'), dataIndex: 'source', key: 'source' },
            {
                title: t('portfolio.amount'),
                dataIndex: 'amount',
                key: 'amount',
                render: (amount: number) => formatNumber(amount, 8),
            },
            {
                title: t('portfolio.value'),
                dataIndex: 'value',
                key: 'value',
                render: (value: number) =>
                    formatAmount(value),
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
                                    style={{ marginRight: SPACING.xs }}
                                    onClick={() => onEditAsset?.(asset)}
                                    aria-label={t('common.edit')}
                                />
                                <Popconfirm
                                    title={t('portfolio.deleteHolding')}
                                    description={t('portfolio.deleteHoldingConfirm')}
                                    onConfirm={() => onDeleteAsset?.(asset)}
                                    okText={t('common.delete')}
                                    cancelText={t('common.cancel')}
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button icon={<DeleteOutlined />} size="small" danger aria-label={t('common.delete')} />
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
            <Row gutter={[16, 16]} style={{ marginBottom: SPACING.lg }}>
                <Col xs={24} sm={12} md={8}>
                    <StatCard
                        variant="borderless"
                        gradient={heroGradient}
                        title={t('portfolio.totalValue')}
                        value={data?.totalValue}
                        currency={data?.currency || 'USD'}
                        loading={loading}
                    />
                </Col>
            </Row>

            <Card title={t('portfolio.yourAssets')} variant="borderless">
                {isMobile ? (
                    <ItemList
                        items={groupedAssets}
                        rowKey={record => record.symbol}
                        loading={loading}
                        empty={<EmptyState description={t('portfolio.empty')} />}
                        aria-label={t('portfolio.yourAssets')}
                        renderItem={record => (
                            <Card size="small" style={{ marginBottom: SPACING.sm }}>
                                <Collapse
                                    ghost
                                    items={[
                                        {
                                            key: record.symbol,
                                            label: (
                                                <Flex justify="space-between" align="center" style={{ width: '100%' }}>
                                                    <Tag color={symbolColor(record.symbol)}>{record.symbol}</Tag>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div><Text strong>{formatAmount(record.value)}</Text></div>
                                                        <div><Text type="secondary" style={{ fontSize: `${FONT_SIZE.sm}px` }}>{formatNumber(record.amount, 8)}</Text></div>
                                                    </div>
                                                </Flex>
                                            ),
                                            children: (
                                                <ItemList
                                                    items={record.assets}
                                                    rowKey={asset => asset.id}
                                                    renderItem={(asset) => (
                                                        <Flex
                                                            justify="space-between"
                                                            align="center"
                                                            gap={SPACING.sm}
                                                            style={{ padding: `${SPACING.xs}px 0`, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
                                                        >
                                                            <Flex vertical style={{ minWidth: 0 }}>
                                                                <Text strong>{asset.source}</Text>
                                                                <Text type="secondary">{t('portfolio.amount')}: {formatNumber(asset.amount, 8)}</Text>
                                                                <Text type="secondary">{t('portfolio.value')}: {formatAmount(asset.value)}</Text>
                                                            </Flex>
                                                            {asset.source === 'MANUAL' && (
                                                                <Flex gap={SPACING.xs} style={{ flexShrink: 0 }}>
                                                                    <Button
                                                                        type="text"
                                                                        icon={<EditOutlined />}
                                                                        size="small"
                                                                        onClick={() => onEditAsset?.(asset)}
                                                                        aria-label={t('common.edit')}
                                                                    />
                                                                    <Button
                                                                        type="text"
                                                                        danger
                                                                        icon={<DeleteOutlined />}
                                                                        size="small"
                                                                        aria-label={t('common.delete')}
                                                                        onClick={() => confirm({
                                                                            title: t('portfolio.deleteHolding'),
                                                                            content: t('portfolio.deleteHoldingConfirm'),
                                                                            okText: t('common.delete'),
                                                                            danger: true,
                                                                            onOk: () => onDeleteAsset?.(asset),
                                                                        })}
                                                                    />
                                                                </Flex>
                                                            )}
                                                        </Flex>
                                                    )}
                                                />
                                            )
                                        }
                                    ]}
                                />
                            </Card>
                        )}
                    />
                ) : (
                    <Table
                        dataSource={groupedAssets}
                        columns={columns}
                        rowKey="symbol"
                        loading={loading}
                        locale={{ emptyText: <EmptyState description={t('portfolio.empty')} /> }}
                        pagination={{ defaultPageSize: 20, hideOnSinglePage: true }}
                        scroll={{ x: true }}
                        expandable={{
                            expandedRowRender,
                            defaultExpandedRowKeys: [],
                        }}
                    />
                )}
            </Card>
        </div>
    );
};
