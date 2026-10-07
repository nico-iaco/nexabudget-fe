import { useEffect, useRef, useState } from 'react';
import { App, Button, Table, Tabs, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '../../hooks/usePageTitle';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { DeletedAccount, Transaction } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { InlineError } from '../../components/common/InlineError';
import { queryKeys } from '../../queryKeys';
import { usePreferences } from '../../contexts/PreferencesContext';
import { FONT_SIZE, getSemanticColors } from '../../theme/tokens';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';
import { formatMoney } from '../../utils/format';
import { apiErrorText, getApiErrorStatus } from '../../utils/apiError';
import { useOutletContext } from 'react-router-dom';
import type { AppOutletContext } from '../../types/outletContext';

const { Text } = Typography;

export const TrashPage = () => {
    const { t } = useTranslation();
    const { message, notification } = App.useApp();
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
    // Un caricamento fallito non è un cestino vuoto: la tabella mostra l'errore con Riprova.
    const [txLoadError, setTxLoadError] = useState(false);
    const [accLoadError, setAccLoadError] = useState(false);
    const queryClient = useQueryClient();

    // Un elemento ripristinato ricompare in conti, saldi, transazioni e grafici: senza
    // invalidazione restava invisibile fino allo scadere dello staleTime.
    const invalidateRestoredData = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
        queryClient.invalidateQueries({ queryKey: queryKeys.totalBalance });
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
        queryClient.invalidateQueries({ queryKey: ['reports'] });
    };

    const fetchDeletedTransactions = async () => {
        setLoadingTx(true);
        try {
            const resp = await api.getDeletedTransactions();
            setDeletedTransactions(Array.isArray(resp.data) ? resp.data : []);
            setTxLoadError(false);
        } catch {
            message.error(t('trash.loadError'));
            setTxLoadError(true);
        } finally {
            setLoadingTx(false);
        }
    };

    const fetchDeletedAccounts = async () => {
        setLoadingAcc(true);
        try {
            const resp = await api.getDeletedAccounts();
            setDeletedAccounts(Array.isArray(resp.data) ? resp.data : []);
            setAccLoadError(false);
        } catch {
            message.error(t('trash.loadError'));
            setAccLoadError(true);
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

    const handleRestoreAccount = async (id: string) => {
        setRestoringId(id);
        try {
            await api.restoreAccount(id);
            message.success(t('trash.restoreSuccess'));
            fetchDeletedAccounts();
            // Il conto riporta con sé solo le transazioni cancellate insieme a lui: quelle
            // già nel cestino prima restano lì. Si ricarica la lista invece di dedurla.
            if (loadedTabsRef.current.has('transactions')) fetchDeletedTransactions();
            invalidateRestoredData();
        } catch (error) {
            message.error(apiErrorText(error, t('trash.restoreError')));
        } finally {
            setRestoringId(null);
        }
    };

    // 409: il conto della transazione è nel cestino. Si mostra il messaggio del backend e,
    // se il conto è fra quelli eliminati, si offre di ripristinarlo direttamente.
    const notifyAccountInTrash = async (record: Transaction, error: unknown) => {
        let deletedAccount: DeletedAccount | undefined;
        try {
            const resp = await api.getDeletedAccounts();
            const list = Array.isArray(resp.data) ? resp.data : [];
            setDeletedAccounts(list);
            setAccLoadError(false);
            deletedAccount = list.find(a => a.id === record.accountId);
        } catch {
            // Senza la lista resta il messaggio del backend, che indica già cosa fare.
        }
        const key = `restore-account-first-${record.id}`;
        const account = deletedAccount;
        notification.warning({
            key,
            title: t('trash.restoreAccountFirstTitle'),
            description: apiErrorText(error, t('trash.restoreError')),
            duration: 10,
            actions: account ? (
                <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                        notification.destroy(key);
                        void handleRestoreAccount(account.id);
                    }}
                >
                    {t('trash.restoreAccountNamed', { name: account.name })}
                </Button>
            ) : undefined,
        });
    };

    const handleRestoreTransaction = async (record: Transaction) => {
        setRestoringId(record.id);
        try {
            // Per un trasferimento il backend ripristina entrambe le gambe: lista e saldi
            // di tutti i conti vengono ricaricati, non solo la riga cliccata.
            await api.restoreTransaction(record.id);
            message.success(t('trash.restoreSuccess'));
            fetchDeletedTransactions();
            invalidateRestoredData();
        } catch (error) {
            if (getApiErrorStatus(error) === 409) {
                await notifyAccountInTrash(record, error);
            } else {
                message.error(apiErrorText(error, t('trash.restoreError')));
            }
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
                    onClick={() => handleRestoreTransaction(record)}
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
                                locale={{
                                    emptyText: txLoadError
                                        ? <InlineError message={t('trash.loadError')} onRetry={fetchDeletedTransactions} />
                                        : <EmptyState description={t('trash.emptyTransactions')} />,
                                }}
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
                                locale={{
                                    emptyText: accLoadError
                                        ? <InlineError message={t('trash.loadError')} onRetry={fetchDeletedAccounts} />
                                        : <EmptyState description={t('trash.emptyAccounts')} />,
                                }}
                                pagination={{ defaultPageSize: 20, showSizeChanger: false }}
                            />
                        ),
                    },
                ]}
            />
        </>
    );
};
