// src/components/TransactionCard.tsx
import {Button, Card, Flex, Tag, Typography} from 'antd';
import {DeleteOutlined, EditOutlined, SwapOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {useTranslation} from 'react-i18next';
import type {Transaction} from '../types/api';

const { Text } = Typography;

interface TransactionCardProps {
    transaction: Transaction;
    onEdit: (transaction: Transaction) => void;
    onDelete: (id: string) => void;
    onConvertToTransfer: (transaction: Transaction) => void;
}

export const TransactionCard = ({ transaction, onEdit, onDelete, onConvertToTransfer }: TransactionCardProps) => {
    const { t } = useTranslation();
    const isIncome = transaction.type === 'IN';
    const amountColor = isIncome ? 'green' : 'red';
    const typeLabel = isIncome ? t('transactions.typeIn') : t('transactions.typeOut');

    return (
        <Card
            style={{ marginBottom: 12 }}
            styles={{ body: { padding: '12px 16px' } }}
        >
            <Flex justify="space-between" align="start" gap="middle">
                <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: '15px' }}>{transaction.description}</Text>
                    <Text type="secondary" style={{ fontSize: '13px' }}>{transaction.accountName}</Text>
                    {transaction.categoryName && (
                        <Text type="secondary" italic style={{ fontSize: '12px' }}>
                            {transaction.categoryName}
                        </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: '12px', marginTop: 4 }}>
                        {dayjs(transaction.date).format('DD/MM/YYYY')}
                    </Text>
                </Flex>
                <Flex vertical align="end" style={{ flexShrink: 0 }}>
                    <Text strong style={{ color: amountColor, fontSize: '16px', whiteSpace: 'nowrap' }}>
                        {isIncome ? '+' : '-'} {transaction.amount.toFixed(2)} €
                    </Text>
                    <Tag color={isIncome ? 'success' : 'error'} style={{ marginTop: 4 }}>
                        {typeLabel}
                    </Tag>
                </Flex>
            </Flex>
            <Flex justify="end" gap="small" style={{ marginTop: 12 }}>
                <Button
                    icon={<EditOutlined />}
                    onClick={() => onEdit(transaction)}
                    size="small"
                />
                {!transaction.transferId && (
                    <Button
                        icon={<SwapOutlined />}
                        onClick={() => onConvertToTransfer(transaction)}
                        size="small"
                    />
                )}
                <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(transaction.id)}
                    size="small"
                />
            </Flex>
        </Card>
    );
};
