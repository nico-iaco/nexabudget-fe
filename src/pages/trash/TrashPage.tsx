import { useEffect, useState } from 'react';
import { Button, Empty, Flex, Table, Tabs, Tag, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { DeletedAccount, Transaction } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

export const TrashPage = () => {
    const { t } = useTranslation();

    const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([]);
    const [deletedAccounts, setDeletedAccounts] = useState<DeletedAccount[]>([]);
    const [loadingTx, setLoadingTx] = useState(false);
    const [loadingAcc, setLoadingAcc] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    const fetchDeletedTransactions = async () => {
        setLoadingTx(true);
        try {
            const resp = await api.getDeletedTransactions();
            setDeletedTransactions(resp.data);
        } catch {
            message.error(t('trash.restoreError'));
        } finally {
            setLoadingTx(false);
        }
    };

    const fetchDeletedAccounts = async () => {
        setLoadingAcc(true);
        try {
            const resp = await api.getDeletedAccounts();
            setDeletedAccounts(resp.data);
        } catch {
            message.error(t('trash.restoreError'));
        } finally {
            setLoadingAcc(false);
        }
    };

    useEffect(() => {
        fetchDeletedTransactions();
        fetchDeletedAccounts();
    }, []);

    const handleRestoreTransaction = async (id: string) => {
        setRestoringId(id);
        try {
            await api.restoreTransaction(id);
            message.success(t('trash.restoreSuccess'));
            fetchDeletedTransactions();
        } catch {
            message.error(t('trash.restoreError'));
        } finally {
            setRestoringId(null);
        }
    };

    const handleRestoreAccount = async (id: string) => {
        setRestoringId(id);
        try {
            await api.restoreAccount(id);
            message.success(t('trash.restoreSuccess'));
            fetchDeletedAccounts();
        } catch {
            message.error(t('trash.restoreError'));
        } finally {
            setRestoringId(null);
        }
    };

    const txColumns: ColumnsType<Transaction> = [
        {
            title: t('transactions.data'),
            dataIndex: 'date',
            key: 'date',
            render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
            sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
            defaultSortOrder: 'descend',
        },
        {
            title: t('transactions.description'),
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: t('transactions.account'),
            dataIndex: 'accountName',
            key: 'accountName',
        },
        {
            title: t('transactions.amount'),
            dataIndex: 'amount',
            key: 'amount',
            render: (amount: number, record: Transaction) => (
                <span style={{ color: record.type === 'IN' ? 'green' : 'red' }}>
                    {record.type === 'IN' ? '+' : '-'} {amount.toFixed(2)} €
                </span>
            ),
        },
        {
            title: t('transactions.type'),
            dataIndex: 'type',
            key: 'type',
            render: (type: 'IN' | 'OUT') => (
                <Tag color={type === 'IN' ? 'success' : 'error'}>
                    {type === 'IN' ? t('transactions.typeIn') : t('transactions.typeOut')}
                </Tag>
            ),
        },
        {
            title: t('common.actions'),
            key: 'actions',
            render: (_: unknown, record: Transaction) => (
                <Button
                    size="small"
                    onClick={() => handleRestoreTransaction(record.id)}
                    loading={restoringId === record.id}
                >
                    {t('trash.restore')}
                </Button>
            ),
        },
    ];

    const accColumns: ColumnsType<DeletedAccount> = [
        {
            title: t('accounts.accountName'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('accounts.accountType'),
            dataIndex: 'type',
            key: 'type',
            render: (type: DeletedAccount['type']) => {
                const map: Record<DeletedAccount['type'], string> = {
                    CONTO_CORRENTE: t('accounts.accountTypeChecking'),
                    RISPARMIO: t('accounts.accountTypeSavings'),
                    INVESTIMENTO: t('accounts.accountTypeInvestment'),
                    CONTANTI: t('accounts.accountTypeCash'),
                };
                return map[type];
            },
        },
        {
            title: t('accounts.currency'),
            dataIndex: 'currency',
            key: 'currency',
        },
        {
            title: t('trash.deletedAt'),
            dataIndex: 'deletedAt',
            key: 'deletedAt',
            render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
            sorter: (a, b) => dayjs(a.deletedAt).unix() - dayjs(b.deletedAt).unix(),
            defaultSortOrder: 'descend',
        },
        {
            title: t('common.actions'),
            key: 'actions',
            render: (_: unknown, record: DeletedAccount) => (
                <Button
                    size="small"
                    onClick={() => handleRestoreAccount(record.id)}
                    loading={restoringId === record.id}
                >
                    {t('trash.restore')}
                </Button>
            ),
        },
    ];

    return (
        <>
            <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
                <Title level={2} style={{ margin: 0 }}>{t('trash.title')}</Title>
            </Flex>
            <Tabs
                items={[
                    {
                        key: 'transactions',
                        label: t('trash.tabTransactions'),
                        children: (
                            <Table
                                columns={txColumns}
                                dataSource={deletedTransactions}
                                rowKey="id"
                                loading={loadingTx}
                                size="small"
                                locale={{ emptyText: <Empty description={t('trash.emptyTransactions')} /> }}
                                pagination={{ defaultPageSize: 20, showSizeChanger: false }}
                            />
                        ),
                    },
                    {
                        key: 'accounts',
                        label: t('trash.tabAccounts'),
                        children: (
                            <Table
                                columns={accColumns}
                                dataSource={deletedAccounts}
                                rowKey="id"
                                loading={loadingAcc}
                                size="small"
                                locale={{ emptyText: <Empty description={t('trash.emptyAccounts')} /> }}
                                pagination={{ defaultPageSize: 20, showSizeChanger: false }}
                            />
                        ),
                    },
                ]}
            />
        </>
    );
};
