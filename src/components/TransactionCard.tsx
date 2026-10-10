// src/components/TransactionCard.tsx
import { memo } from 'react';
import {Button, Card, Flex, Tag, Typography} from 'antd';
import {ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, SwapOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import type {Transaction} from '../types/api';
import { formatMoney, formatNumber, formatDate } from '../utils/format';
import { FONT_SIZE, SPACING, getSemanticColors } from '../theme/tokens';
import { usePreferences } from '../contexts/PreferencesContext';
import { haptic } from '../utils/haptic';

const { Text, Paragraph } = Typography;

interface TransactionCardProps {
    transaction: Transaction;
    currency?: string;
    onEdit: (transaction: Transaction) => void;
    onDelete: (id: string) => void;
    onConvertToTransfer: (transaction: Transaction) => void;
}

const TransactionCardInner = ({ transaction, currency = 'EUR', onEdit, onDelete, onConvertToTransfer }: TransactionCardProps) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');
    const isIncome = transaction.type === 'IN';
    const amountColor = isIncome ? semantic.positive : semantic.negative;
    const typeLabel = isIncome ? t('transactions.typeIn') : t('transactions.typeOut');

    return (
        <Card
            style={{ marginBottom: SPACING.sm }}
            styles={{ body: { padding: `${SPACING.sm}px ${SPACING.md}px` } }}
        >
            <Flex justify="space-between" align="start" gap="middle">
                <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                    {/* Le descrizioni bancarie arrivano a 100+ caratteri: oltre due righe la card
                        diventava altissima. Testo completo nel tooltip e nel modale di modifica. */}
                    <Paragraph
                        strong
                        ellipsis={{ rows: 2, tooltip: transaction.description }}
                        style={{ fontSize: `${FONT_SIZE.lg}px`, marginBottom: 0 }}
                    >
                        {transaction.description}
                    </Paragraph>
                    <Text type="secondary" style={{ fontSize: `${FONT_SIZE.md}px` }}>{transaction.accountName}</Text>
                    {transaction.categoryName && (
                        <Text type="secondary" italic style={{ fontSize: `${FONT_SIZE.sm}px` }}>
                            {transaction.categoryName}
                        </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: `${FONT_SIZE.sm}px`, marginTop: 4 }}>
                        {formatDate(transaction.date)}
                    </Text>
                </Flex>
                <Flex vertical align="end" style={{ flexShrink: 0 }}>
                    <Text strong style={{ color: amountColor, fontSize: `${FONT_SIZE.xl}px`, whiteSpace: 'nowrap' }}>
                        {isIncome ? <ArrowUpOutlined aria-hidden="true" /> : <ArrowDownOutlined aria-hidden="true" />}
                        {' '}{formatMoney(transaction.amount, currency)}
                    </Text>
                    {transaction.originalCurrency && transaction.originalAmount != null && transaction.exchangeRate != null && (
                        <Text type="secondary" style={{ fontSize: `${FONT_SIZE.xs}px`, whiteSpace: 'nowrap' }}>
                            {t('transactions.exchangeRateHint', {
                                originalAmount: formatNumber(transaction.originalAmount, 2, 2),
                                originalCurrency: transaction.originalCurrency,
                                exchangeRate: formatNumber(transaction.exchangeRate, 6)
                            })}
                        </Text>
                    )}
                    <Tag color={isIncome ? 'success' : 'error'} style={{ marginTop: 4 }}>
                        {typeLabel}
                    </Tag>
                </Flex>
            </Flex>
            <Flex justify="end" gap="small" style={{ marginTop: SPACING.sm }}>
                <Button
                    icon={<EditOutlined />}
                    onClick={() => onEdit(transaction)}
                    size="small"
                    aria-label={t('common.edit')}
                />
                {!transaction.transferId && (
                    <Button
                        icon={<SwapOutlined />}
                        onClick={() => onConvertToTransfer(transaction)}
                        size="small"
                        aria-label={t('transactions.linkTransfer')}
                    />
                )}
                <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => { haptic([10, 50, 10]); onDelete(transaction.id); }}
                    size="small"
                    aria-label={t('common.delete')}
                />
            </Flex>
        </Card>
    );
};

// Confronto per riferimento: ogni fetch produce oggetti nuovi, quindi una card si
// ri-renderizza solo quando la sua transazione cambia davvero. Un confronto campo per
// campo dimenticava tipo, data, conto e transferId, lasciando la card con dati vecchi
// dopo una modifica. Gli handler sono ignorati di proposito: non sono stabili nel padre.
export const TransactionCard = memo(
    TransactionCardInner,
    (prev, next) =>
        prev.transaction === next.transaction &&
        prev.currency === next.currency,
);
TransactionCard.displayName = 'TransactionCard';
