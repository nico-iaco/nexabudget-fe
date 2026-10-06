import { useEffect, useRef, useState } from 'react';
import { App, Button, Table, Tabs, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../hooks/usePageTitle';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { DeletedAccount, Transaction } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { usePreferences } from '../../contexts/PreferencesContext';
import { FONT_SIZE, getSemanticColors } from '../../theme/tokens';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { formatMoney } from '../../utils/format';
import { useOutletContext } from 'react-router-dom';
import type { AppOutletContext } from '../../types/outletContext';

const { Text } = Typography;

export const TrashPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    usePageTitle(t('trash.title'));
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');
    const { isSmallMobile } = useBreakpoints();
    // Valuta del conto della transazione: prima l'importo era sempre seguito da "€".
    // Il conto può essere stato eliminato a sua volta: in quel caso la valuta di base.
    const { accounts } = useOutletContext<AppOutletContext>();
    const defaultCurrency = useDefaultCurrency();
    const currencyOf = (accountId: string) => accounts.find(a => a.id === accountId)?.currency ?? defaultCurrency;

    const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([]);
    const [deletedAccounts, setDeletedAccounts] = useState<DeletedAccount[]>([]);
    const [loadingTx, setLoadingTx] = useState(false);
    const [loadingAcc, setLoadingAcc] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    const fetchDeletedTransactions = async () => {
        setLoadingTx(true);
        try {
            const resp = await api.getDeletedTransactions();
            setDeletedTransactions(Array.isArray(resp.data) ? resp.data : []);
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
            setDeletedAccounts(Array.isArray(resp.data) ? resp.data : []);
        } catch {
            message.error(t('trash.restoreError'));
        } finally {
            setLoadingAcc(false);
        }
    };

    // Solo la tab visibile viene caricata al mount: prima partivano entrambe le
    // richieste (entrambe non paginate), e quella della tab nascosta era pura attesa
    // finché l'utente non ci passava — se ci passava.
    const [activeTab, setActiveTab] = useState<'transactions' | 'accounts'>('transactions');
    const loadedTabsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (loadedTabsRef.current.has(activeTab)) return;
        loadedTabsRef.current.add(activeTab);
        if (activeTab === 'transactions') {
            fetchDeletedTransactions();
        } else {
            fetchDeletedAccounts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

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

    // Larghezze fisse ovunque tranne descrizione/nome, che con tableLayout="fixed" prendono
    // lo spazio rimanente in ellissi: prima con scroll x 'max-content' la tabella diventava
    // larga quanto la descrizione più lunga. Su mobile la data scende sotto la descrizione
    // e le colonne secondarie spariscono, così la tabella sta nello schermo.
    const txColumns: ColumnsType<Transaction> = [
        {
            title: t('transactions.data'),
            dataIndex: 'date',
            key: 'date',
            width: 110,
            render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
            sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
            defaultSortOrder: 'descend',
            hidden: isSmallMobile,
        },
        {
            title: t('transactions.description'),
            dataIndex: 'description',
            key: 'description',
            ellipsis: { showTitle: true },
            render: (v: string, record: Transaction) => isSmallMobile ? (
                <>
                    <Text ellipsis={{ tooltip: v }} style={{ display: 'block' }}>{v}</Text>
                    <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>{dayjs(record.date).format('DD/MM/YYYY')}</Text>
                </>
            ) : v,
        },
        {
            title: t('transactions.account'),
            dataIndex: 'accountName',
            key: 'accountName',
            width: 160,
            ellipsis: { showTitle: true },
            responsive: ['xl'],
        },
        {
            title: t('transactions.amount'),
            dataIndex: 'amount',
            key: 'amount',
            width: isSmallMobile ? 100 : 130,
            render: (amount: number, record: Transaction) => (
                <span style={{ color: record.type === 'IN' ? semantic.positive : semantic.negative }}>
                    {formatMoney(record.type === 'IN' ? amount : -amount, currencyOf(record.accountId), { signed: true })}
                </span>
            ),
        },
        {
            title: t('transactions.type'),
            dataIndex: 'type',
            key: 'type',
            width: 100,
            responsive: ['xxl'],
            render: (type: 'IN' | 'OUT') => (
                <Tag color={type === 'IN' ? 'success' : 'error'}>
                    {type === 'IN' ? t('transactions.typeIn') : t('transactions.typeOut')}
                </Tag>
            ),
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 120,
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
            ellipsis: { showTitle: true },
        },
        {
            title: t('accounts.accountType'),
            dataIndex: 'type',
            key: 'type',
            width: 150,
            ellipsis: { showTitle: true },
            responsive: ['md'],
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
            width: 90,
            responsive: ['sm'],
        },
        {
            title: t('trash.deletedAt'),
            dataIndex: 'deletedAt',
            key: 'deletedAt',
            width: isSmallMobile ? 110 : 150,
            render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
            sorter: (a, b) => dayjs(a.deletedAt).unix() - dayjs(b.deletedAt).unix(),
            defaultSortOrder: 'descend',
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 120,
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
            <PageHeader title={t('trash.title')} />
            <Tabs
                activeKey={activeTab}
                onChange={(k) => setActiveTab(k as 'transactions' | 'accounts')}
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
                                tableLayout="fixed"
                                locale={{ emptyText: <EmptyState description={t('trash.emptyTransactions')} /> }}
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
                                tableLayout="fixed"
                                locale={{ emptyText: <EmptyState description={t('trash.emptyAccounts')} /> }}
                                pagination={{ defaultPageSize: 20, showSizeChanger: false }}
                            />
                        ),
                    },
                ]}
            />
        </>
    );
};
