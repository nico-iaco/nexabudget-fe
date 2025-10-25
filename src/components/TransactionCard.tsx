// src/components/TransactionCard.tsx
import { Card, Tag, Button, Flex, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Transaction } from '../types/api';

const { Text } = Typography;

interface TransactionCardProps {
    transaction: Transaction;
    onEdit: (transaction: Transaction) => void;
    onDelete: (id: number) => void;
}

export const TransactionCard = ({ transaction, onEdit, onDelete }: TransactionCardProps) => {
    const isIncome = transaction.type === 'IN';
    const amountColor = isIncome ? 'green' : 'red';

    return (
        <Card style={{ marginBottom: 16 }}>
            <Flex justify="space-between" align="start">
                <Flex vertical>
                    <Text strong>{transaction.descrizione}</Text>
                    <Text type="secondary">{transaction.accountName}</Text>
                    {transaction.categoryName && <Text type="secondary" italic>{transaction.categoryName}</Text>}
                    <Text type="secondary" style={{ fontSize: '0.8em', marginTop: 4 }}>
                        {dayjs(transaction.data).format('DD/MM/YYYY')}
                    </Text>
                </Flex>
                <Flex vertical align="end">
                    <Text strong style={{ color: amountColor, fontSize: '1.1em' }}>
                        {isIncome ? '+' : '-'} {transaction.importo.toFixed(2)} €
                    </Text>
                    <Tag color={isIncome ? 'success' : 'error'}>{transaction.type}</Tag>
                </Flex>
            </Flex>
            <Flex justify="end" style={{ marginTop: 16 }}>
                <Button icon={<EditOutlined />} onClick={() => onEdit(transaction)} style={{ marginRight: 8 }} />
                <Button danger icon={<DeleteOutlined />} onClick={() => onDelete(transaction.id)} />
            </Flex>
        </Card>
    );
};
