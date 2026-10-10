import { useState } from 'react';
import { App, Button, Card, Descriptions, Flex, Popconfirm, Skeleton, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { InlineError } from '../../components/common/InlineError';
import { ItemList } from '../../components/common/ItemList';
import { PlText, PriceCell } from '../../components/investments/PositionParts';
import { InvestmentAssetModal } from '../../components/modals/InvestmentAssetModal';
import { InvestmentManualPriceModal } from '../../components/modals/InvestmentManualPriceModal';
import { InvestmentOperationModal } from '../../components/modals/InvestmentOperationModal';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { useConfirm } from '../../hooks/useConfirm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useInvestmentPortfolio } from '../../hooks/useInvestments';
import * as api from '../../services/api';
import { invalidateInvestmentData, queryKeys } from '../../queryKeys';
import { apiErrorText, getApiErrorStatus } from '../../utils/apiError';
import { FONT_SIZE, SPACING } from '../../theme/tokens';
import { formatDate, formatMoneyOrNA, formatNumber, formatPercent } from '../../utils/format';
import { formatAssetPrice, formatAssetQuantity, isBond, isTradeOperation } from '../../utils/investments';
import type { InvestmentOperation } from '../../types/api';

const { Text } = Typography;

export const AssetDetailPage = () => {
    const { t } = useTranslation();
    const { assetId = '' } = useParams<{ assetId: string }>();
    const navigate = useNavigate();
    const { message } = App.useApp();
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const { isSmallMobile } = useBreakpoints();

    const [editOpen, setEditOpen] = useState(false);
    const [priceOpen, setPriceOpen] = useState(false);
    const [operationOpen, setOperationOpen] = useState(false);
    const [editingOperation, setEditingOperation] = useState<InvestmentOperation | null>(null);

    const assetQuery = useQuery({
        queryKey: queryKeys.investmentAsset(assetId),
        queryFn: () => api.getInvestmentAsset(assetId).then(r => r.data),
        enabled: !!assetId,
        // Un 404 non migliora riprovando.
        retry: (count, err) => getApiErrorStatus(err) !== 404 && count < 1,
    });
    const operationsQuery = useQuery({
        queryKey: queryKeys.investmentOperations(assetId),
        queryFn: () => api.getInvestmentOperations(assetId).then(r => r.data),
        enabled: !!assetId,
    });
    // Posizione dal portafoglio (stessa query della pagina elenco): valori già calcolati dal
    // backend, qui si mostrano soltanto.
    const portfolio = useInvestmentPortfolio();
    const position = portfolio.data?.positions.find(p => p.assetId === assetId);
    const portfolioCurrency = portfolio.data?.currency ?? 'EUR';

    const asset = assetQuery.data;
    usePageTitle(asset?.name ?? t('investments.title'));
    const bond = isBond(asset?.assetType);

    const deleteAsset = async () => {
        if (!asset) return;
        try {
            await api.deleteInvestmentAsset(asset.id);
            queryClient.removeQueries({ queryKey: queryKeys.investmentAsset(asset.id) });
            queryClient.removeQueries({ queryKey: queryKeys.investmentOperations(asset.id) });
            invalidateInvestmentData(queryClient);
            message.success(t('investments.asset.deleted'));
            void navigate('/investments', { replace: true });
        } catch (e) {
            console.error('Failed to delete asset:', e);
            message.error(apiErrorText(e, t('investments.asset.deleteError')));
        }
    };

    const deleteOperation = async (op: InvestmentOperation) => {
        try {
            await api.deleteInvestmentOperation(op.id);
            invalidateInvestmentData(queryClient);
            message.success(t('investments.operations.deleted'));
        } catch (e) {
            console.error('Failed to delete operation:', e);
            // 409: eliminare un acquisto farebbe superare la quantità di una vendita successiva.
            message.error(apiErrorText(e, t('investments.operations.deleteError')));
        }
    };

    const openOperation = (op: InvestmentOperation | null) => {
        setEditingOperation(op);
        setOperationOpen(true);
    };

    const opAmounts = (op: InvestmentOperation) => {
        const currency = asset?.currency ?? 'EUR';
        const type = asset?.assetType ?? 'OTHER';
        return isTradeOperation(op.type)
            ? {
                quantity: op.quantity == null ? '' : formatAssetQuantity(op.quantity, type, currency),
                price: op.price == null ? '' : formatAssetPrice(op.price, type, currency),
                fees: op.fees == null ? '' : formatMoneyOrNA(op.fees, currency),
                amount: '',
            }
            : { quantity: '', price: '', fees: '', amount: op.amount == null ? '' : formatMoneyOrNA(op.amount, currency) };
    };

    const columns: ColumnsType<InvestmentOperation> = [
        { title: t('investments.operations.columns.date'), dataIndex: 'operationDate', render: (d: string) => formatDate(d) },
        { title: t('investments.operations.columns.type'), dataIndex: 'type', render: (v: InvestmentOperation['type']) => <Tag style={{ margin: 0 }}>{t(`investments.opTypes.${v}`)}</Tag> },
        { title: bond ? t('investments.columns.nominal') : t('investments.operations.columns.quantity'), key: 'quantity', align: 'right', render: (_, op) => opAmounts(op).quantity },
        { title: bond ? t('investments.columns.priceBond') : t('investments.operations.columns.price'), key: 'price', align: 'right', render: (_, op) => opAmounts(op).price },
        { title: t('investments.operations.columns.fees'), key: 'fees', align: 'right', render: (_, op) => opAmounts(op).fees },
        { title: t('investments.operations.columns.amount'), key: 'amount', align: 'right', render: (_, op) => opAmounts(op).amount },
        { title: t('investments.operations.columns.notes'), dataIndex: 'notes', ellipsis: true },
        {
            title: t('common.actions'), key: 'actions', align: 'right',
            render: (_, op) => (
                <Space size="small">
                    <Button size="small" icon={<EditOutlined />} aria-label={t('common.edit')} onClick={() => openOperation(op)} />
                    <Popconfirm
                        title={t('investments.operations.deleteTitle')}
                        description={t('investments.operations.deleteConfirmShort')}
                        onConfirm={() => deleteOperation(op)}
                        okText={t('common.delete')}
                        cancelText={t('common.cancel')}
                        okButtonProps={{ danger: true }}
                    >
                        <Button size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const backLink = (
        <Link to="/investments">
            <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>{t('investments.asset.back')}</Button>
        </Link>
    );

    if (assetQuery.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;

    if (!asset) {
        const notFound = getApiErrorStatus(assetQuery.error) === 404;
        return (
            <>
                {backLink}
                {notFound
                    ? <EmptyState description={apiErrorText(assetQuery.error, t('investments.asset.loadError'))} />
                    : <InlineError message={t('investments.asset.loadError')} onRetry={() => { void assetQuery.refetch(); }} />}
            </>
        );
    }

    return (
        <>
            {backLink}
            <PageHeader
                title={asset.name}
                actions={
                    <Flex gap="small" wrap justify="flex-end">
                        <Button onClick={() => setPriceOpen(true)}>
                            {asset.priceSource === 'MANUAL' ? t('investments.manualPrice.action') : t('investments.manualPrice.fallbackAction')}
                        </Button>
                        <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>{t('common.edit')}</Button>
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => confirm({
                                title: t('investments.asset.deleteTitle'),
                                // Elimina anche le operazioni: conferma esplicita.
                                content: t('investments.asset.deleteConfirm', { name: asset.name }),
                                okText: t('common.delete'),
                                danger: true,
                                onOk: deleteAsset,
                            })}
                        >
                            {t('common.delete')}
                        </Button>
                    </Flex>
                }
            />

            <Flex vertical gap={SPACING.md}>
                <Card title={t('investments.asset.details')}>
                    <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                        <Descriptions.Item label={t('investments.asset.fields.assetType')}>{t(`investments.types.${asset.assetType}`)}</Descriptions.Item>
                        <Descriptions.Item label={t('investments.asset.fields.currency')}>{asset.currency}</Descriptions.Item>
                        <Descriptions.Item label={t('investments.asset.fields.priceSource')}>{t(`investments.sources.${asset.priceSource}`)}</Descriptions.Item>
                        {asset.symbol && <Descriptions.Item label={t('investments.asset.fields.symbol')}>{asset.symbol}</Descriptions.Item>}
                        {asset.isin && <Descriptions.Item label={t('investments.asset.fields.isin')}>{asset.isin}</Descriptions.Item>}
                        {asset.manualPrice != null && (
                            <Descriptions.Item label={asset.priceSource === 'MANUAL' ? t('investments.asset.fields.manualPrice') : t('investments.manualPrice.fallbackLabel')}>
                                {formatAssetPrice(asset.manualPrice, asset.assetType, asset.currency)}
                            </Descriptions.Item>
                        )}
                        {bond && asset.couponRate != null && (
                            <Descriptions.Item label={t('investments.asset.fields.couponRate')}>{`${formatNumber(asset.couponRate, 2)}%`}</Descriptions.Item>
                        )}
                        {bond && asset.couponFrequency && (
                            <Descriptions.Item label={t('investments.asset.fields.couponFrequency')}>{t(`investments.frequencies.${asset.couponFrequency}`)}</Descriptions.Item>
                        )}
                        {bond && asset.maturityDate && (
                            <Descriptions.Item label={t('investments.asset.fields.maturityDate')}>{formatDate(asset.maturityDate)}</Descriptions.Item>
                        )}
                    </Descriptions>
                </Card>

                <Card title={t('investments.asset.position')}>
                    {portfolio.isPending && <Skeleton active paragraph={{ rows: 2 }} />}
                    {!portfolio.isPending && !portfolio.data && portfolio.isError && (
                        <InlineError message={t('investments.loadError')} onRetry={() => { void portfolio.refetch(); }} />
                    )}
                    {portfolio.data && !position && <Text type="secondary">{t('investments.asset.noPosition')}</Text>}
                    {position && (
                        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                            <Descriptions.Item label={bond ? t('investments.columns.nominal') : t('investments.columns.quantity')}>
                                {formatAssetQuantity(position.quantity, position.assetType, position.currency)}
                            </Descriptions.Item>
                            <Descriptions.Item label={t('investments.columns.avgPrice')}>
                                {formatAssetPrice(position.avgPrice, position.assetType, position.currency)}
                            </Descriptions.Item>
                            <Descriptions.Item label={bond ? t('investments.columns.priceBond') : t('investments.columns.price')}>
                                <PriceCell position={position} align="left" />
                            </Descriptions.Item>
                            <Descriptions.Item label={t('investments.summary.costBasis')}>{formatMoneyOrNA(position.costBasis, portfolioCurrency)}</Descriptions.Item>
                            <Descriptions.Item label={t('investments.columns.value')}>{formatMoneyOrNA(position.marketValue, portfolioCurrency)}</Descriptions.Item>
                            <Descriptions.Item label={t('investments.summary.unrealizedPl')}>
                                <PlText value={position.unrealizedPl} percent={position.unrealizedPlPercent} currency={portfolioCurrency} align="left" />
                            </Descriptions.Item>
                            <Descriptions.Item label={t('investments.summary.realizedPl')}>
                                <PlText value={position.realizedPl} currency={portfolioCurrency} align="left" />
                            </Descriptions.Item>
                            <Descriptions.Item label={t('investments.summary.income')}>{formatMoneyOrNA(position.income, portfolioCurrency)}</Descriptions.Item>
                            {bond && position.couponRate != null && (
                                <Descriptions.Item label={t('investments.asset.fields.couponRate')}>{formatPercent(position.couponRate, 2)}</Descriptions.Item>
                            )}
                        </Descriptions>
                    )}
                </Card>

                <Card
                    title={t('investments.operations.title')}
                    extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openOperation(null)}>{t('investments.operations.add')}</Button>}
                >
                    {operationsQuery.isPending && <Skeleton active paragraph={{ rows: 4 }} />}
                    {!operationsQuery.isPending && !operationsQuery.data && operationsQuery.isError && (
                        <InlineError message={t('investments.operations.loadError')} onRetry={() => { void operationsQuery.refetch(); }} />
                    )}
                    {operationsQuery.data && (isSmallMobile ? (
                        <ItemList
                            items={operationsQuery.data}
                            rowKey={op => op.id}
                            gap={SPACING.sm}
                            empty={<EmptyState description={t('investments.operations.empty')} />}
                            renderItem={op => {
                                const a = opAmounts(op);
                                return (
                                    <Card size="small">
                                        <Flex justify="space-between" align="flex-start" gap={SPACING.sm}>
                                            <Flex vertical gap={2}>
                                                <Space size={6}>
                                                    <Tag style={{ margin: 0 }}>{t(`investments.opTypes.${op.type}`)}</Tag>
                                                    <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>{formatDate(op.operationDate)}</Text>
                                                </Space>
                                                {isTradeOperation(op.type) ? (
                                                    <Text style={{ fontSize: FONT_SIZE.sm }}>
                                                        {[a.quantity, a.price && `@ ${a.price}`, op.fees > 0 && a.fees && `(${t('investments.operations.columns.fees')} ${a.fees})`].filter(Boolean).join(' ')}
                                                    </Text>
                                                ) : <Text>{a.amount}</Text>}
                                                {op.notes && <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>{op.notes}</Text>}
                                            </Flex>
                                            <Space size="small">
                                                <Button size="small" icon={<EditOutlined />} aria-label={t('common.edit')} onClick={() => openOperation(op)} />
                                                <Button
                                                    size="small" danger icon={<DeleteOutlined />} aria-label={t('common.delete')}
                                                    onClick={() => confirm({
                                                        title: t('investments.operations.deleteTitle'),
                                                        content: t('investments.operations.deleteConfirmShort'),
                                                        okText: t('common.delete'),
                                                        danger: true,
                                                        onOk: () => deleteOperation(op),
                                                    })}
                                                />
                                            </Space>
                                        </Flex>
                                    </Card>
                                );
                            }}
                        />
                    ) : (
                        <Table<InvestmentOperation>
                            size="small"
                            rowKey="id"
                            columns={columns}
                            dataSource={operationsQuery.data}
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                            locale={{ emptyText: <EmptyState description={t('investments.operations.empty')} /> }}
                        />
                    ))}
                </Card>
            </Flex>

            <InvestmentAssetModal open={editOpen} asset={asset} onClose={() => setEditOpen(false)} />
            <InvestmentManualPriceModal open={priceOpen} asset={asset} onClose={() => setPriceOpen(false)} />
            <InvestmentOperationModal
                open={operationOpen}
                asset={asset}
                operation={editingOperation}
                onClose={() => { setOperationOpen(false); setEditingOperation(null); }}
            />
        </>
    );
};
