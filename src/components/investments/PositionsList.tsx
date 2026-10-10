import { Card, Flex, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ItemList } from '../common/ItemList';
import { PlText, PriceCell } from './PositionParts';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { FONT_SIZE, SPACING } from '../../theme/tokens';
import { formatMoneyOrNA } from '../../utils/format';
import { formatAssetPrice, formatAssetQuantity, isBond } from '../../utils/investments';
import type { InvestmentPosition } from '../../types/api';

const { Text } = Typography;

interface Props {
    positions: InvestmentPosition[];
    /** Valuta del portafoglio: in cui sono espressi valore, costo, P/L e cedole. */
    currency: string;
    /** `closed`: posizioni a quantità 0, solo P/L realizzato e cedole. */
    variant?: 'open' | 'closed';
}

const NameCell = ({ position }: { position: InvestmentPosition }) => (
    <Flex vertical>
        <Link to={`/investments/${position.assetId}`}><Text strong>{position.name}</Text></Link>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
            {[position.symbol, position.isin].filter(Boolean).join(' · ')}
        </Text>
    </Flex>
);

/** Posizioni del portafoglio: tabella su desktop, card su mobile. */
export const PositionsList = ({ positions, currency, variant = 'open' }: Props) => {
    const { t } = useTranslation();
    const { isSmallMobile } = useBreakpoints();
    const navigate = useNavigate();
    const closed = variant === 'closed';

    const typeTag = (p: InvestmentPosition) => <Tag style={{ margin: 0 }}>{t(`investments.types.${p.assetType}`)}</Tag>;

    if (isSmallMobile) {
        return (
            <ItemList
                items={positions}
                rowKey={p => p.assetId}
                gap={SPACING.sm}
                aria-label={t('investments.positions')}
                renderItem={p => (
                    <Card size="small" hoverable onClick={() => { void navigate(`/investments/${p.assetId}`); }}>
                        <Flex justify="space-between" align="flex-start" gap={SPACING.sm}>
                            <Flex vertical gap={4} style={{ minWidth: 0 }}>
                                <NameCell position={p} />
                                {typeTag(p)}
                            </Flex>
                            {closed ? (
                                <Flex vertical align="flex-end">
                                    <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>{t('investments.columns.realizedPl')}</Text>
                                    <PlText value={p.realizedPl} currency={currency} />
                                </Flex>
                            ) : (
                                <Flex vertical align="flex-end">
                                    <Text strong>{formatMoneyOrNA(p.marketValue, currency)}</Text>
                                    <PlText value={p.unrealizedPl} percent={p.unrealizedPlPercent} currency={currency} />
                                </Flex>
                            )}
                        </Flex>
                        {!closed && (
                            <Flex justify="space-between" align="flex-start" gap={SPACING.sm} style={{ marginTop: SPACING.xs }}>
                                <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                                    {isBond(p.assetType) ? t('investments.columns.nominal') : t('investments.columns.quantity')}:{' '}
                                    {formatAssetQuantity(p.quantity, p.assetType, p.currency)}
                                </Text>
                                <PriceCell position={p} />
                            </Flex>
                        )}
                    </Card>
                )}
            />
        );
    }

    const nameCol: ColumnsType<InvestmentPosition>[number] = {
        title: t('investments.columns.name'), key: 'name', render: (_, p) => <NameCell position={p} />,
    };
    const typeCol: ColumnsType<InvestmentPosition>[number] = {
        title: t('investments.columns.type'), key: 'type', render: (_, p) => typeTag(p),
    };

    const columns: ColumnsType<InvestmentPosition> = closed
        ? [
            nameCol,
            typeCol,
            {
                title: t('investments.columns.realizedPl'), key: 'realizedPl', align: 'right',
                render: (_, p) => <PlText value={p.realizedPl} currency={currency} />,
            },
            {
                title: t('investments.columns.income'), key: 'income', align: 'right',
                render: (_, p) => formatMoneyOrNA(p.income, currency),
            },
        ]
        : [
            nameCol,
            typeCol,
            {
                title: t('investments.columns.quantity'), key: 'quantity', align: 'right',
                render: (_, p) => (
                    <Flex vertical align="flex-end">
                        <Text>{formatAssetQuantity(p.quantity, p.assetType, p.currency)}</Text>
                        {isBond(p.assetType) && (
                            <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>{t('investments.columns.nominal')}</Text>
                        )}
                    </Flex>
                ),
            },
            {
                title: t('investments.columns.avgPrice'), key: 'avgPrice', align: 'right',
                render: (_, p) => formatAssetPrice(p.avgPrice, p.assetType, p.currency),
            },
            {
                title: t('investments.columns.price'), key: 'price', align: 'right',
                render: (_, p) => <PriceCell position={p} />,
            },
            {
                title: t('investments.columns.value'), key: 'value', align: 'right',
                render: (_, p) => formatMoneyOrNA(p.marketValue, currency),
            },
            {
                title: t('investments.columns.pl'), key: 'pl', align: 'right',
                render: (_, p) => <PlText value={p.unrealizedPl} percent={p.unrealizedPlPercent} currency={currency} />,
            },
        ];

    return (
        <Table<InvestmentPosition>
            size="small"
            rowKey="assetId"
            columns={columns}
            dataSource={positions}
            pagination={false}
            scroll={{ x: 'max-content' }}
            onRow={p => ({ onClick: (e) => {
                // I link interni gestiscono già il proprio click.
                if (!(e.target as HTMLElement).closest('a')) void navigate(`/investments/${p.assetId}`);
            }, style: { cursor: 'pointer' } })}
        />
    );
};
