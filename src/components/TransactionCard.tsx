// src/components/TransactionCard.tsx
import { memo } from 'react';
import {Button, Card, Flex, Tag, Typography} from 'antd';
import {ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, SwapOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {useTranslation} from 'react-i18next';
import type {Transaction} from '../types/api';
import { getCurrencySymbol } from '../utils/currency';
import { COLOR_POSITIVE, COLOR_NEGATIVE, FONT_SIZE, SPACING } from '../theme/tokens';
import { haptic } from '../utils/haptic';

const { Text } = Typography;

interface TransactionCardProps {
    transaction: Transaction;
    currency?: string;
    onEdit: (transaction: Transaction) => void;
    onDelete: (id: string) => void;
    onConvertToTransfer: (transaction: Transaction) => void;
}

const TransactionCardInner = ({ transaction, currency = 'EUR', onEdit, onDelete, onConvertToTransfer }: TransactionCardProps) => {
    const { t } = useTranslation();
    const isIncome = transaction.type === 'IN';
    const amountColor = isIncome ? COLOR_POSITIVE : COLOR_NEGATIVE;
    const typeLabel = isIncome ? t('transactions.typeIn') : t('transactions.typeOut');
    const currencySymbol = getCurrencySymbol(currency);

    return (
        <Card
            style={{ marginBottom: SPACING.sm }}
            styles={{ body: { padding: `${SPACING.sm}px ${SPACING.md}px` } }}
        >
            <Flex justify="space-between" align="start" gap="middle">
                <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: `${FONT_SIZE.lg}px` }}>{transaction.description}</Text>
                    <Text type="secondary" style={{ fontSize: `${FONT_SIZE.md}px` }}>{transaction.accountName}</Text>
                    {transaction.categoryName && (
                        <Text type="secondary" italic style={{ fontSize: `${FONT_SIZE.sm}px` }}>
                            {transaction.categoryName}
                        </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: `${FONT_SIZE.sm}px`, marginTop: 4 }}>
                        {dayjs(transaction.date).format('DD/MM/YYYY')}
                    </Text>
                </Flex>
                <Flex vertical align="end" style={{ flexShrink: 0 }}>
                    <Text strong style={{ color: amountColor, fontSize: `${FONT_SIZE.xl}px`, whiteSpace: 'nowrap' }}>
                        {isIncome ? <ArrowUpOutlined aria-hidden="true" /> : <ArrowDownOutlined aria-hidden="true" />}
                        {' '}{transaction.amount.toFixed(2)} {currencySymbol}
                    </Text>
                    {transaction.originalCurrency && transaction.originalAmount != null && transaction.exchangeRate != null && (
                        <Text type="secondary" style={{ fontSize: `${FONT_SIZE.xs}px`, whiteSpace: 'nowrap' }}>
                            {t('transactions.exchangeRateHint', {
                                originalAmount: transaction.originalAmount.toFixed(2),
                                originalCurrency: transaction.originalCurrency,
                                exchangeRate: transaction.exchangeRate
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

export const TransactionCard = memo(
    TransactionCardInner,
    (prev, next) =>
        prev.transaction.id === next.transaction.id &&
        prev.transaction.amount === next.transaction.amount &&
        prev.transaction.description === next.transaction.description &&
        prev.transaction.categoryName === next.transaction.categoryName &&
        prev.currency === next.currency,
);
TransactionCard.displayName = 'TransactionCard';
