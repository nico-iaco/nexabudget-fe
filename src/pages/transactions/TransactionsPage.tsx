// src/pages/transactions/TransactionsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import {
    Alert,
    Badge,
    Button,
    DatePicker,
    Drawer,
    Flex,
    Form,
    Input,
    InputNumber,
    List,
    message,
    Modal,
    notification,
    Radio,
    Select,
    Space,
    Spin,
    Table,
    Tag,
    Typography
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, FilterOutlined, PlusOutlined, RetweetOutlined, SearchOutlined, SwapOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import type { TransactionFilters } from '../../services/api';
import type {
    Account,
    Category,
    LinkTransferRequest,
    Transaction,
    TransactionRequest
} from '../../types/api';
import { useAuth } from '../../contexts/AuthContext';
import dayjs, { type Dayjs } from 'dayjs';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { TransactionCard } from '../../components/TransactionCard';
import { TransactionImportModal } from '../../components/modals/TransactionImportModal';
import { getCurrencySymbol } from '../../utils/currency';
import { COLOR_POSITIVE, COLOR_NEGATIVE } from '../../theme/tokens';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';

const { Title, Text } = Typography;
const { Option } = Select;

interface OutletContextType {
    accounts: Account[];
    fetchAccounts: (background?: boolean) => Promise<Account[]>;
    transactionRefreshKey: number;
    categories: Category[];
    handleOpenTransferModal: () => void;
}

interface FormValues extends Omit<TransactionRequest, 'date'> {
    date?: dayjs.Dayjs | null;
}

interface TableFilters {
    type?: 'IN' | 'OUT';
    categoryId?: string;
    startDate?: Dayjs | null;
    endDate?: Dayjs | null;
    search?: string;
}

export const TransactionsPage = () => {
    const { t } = useTranslation();
    const { accountId } = useParams<{ accountId?: string }>();
    const { auth } = useAuth();
    const {
        accounts,
        fetchAccounts: fetchLayoutAccounts,
        transactionRefreshKey,
        categories,
        handleOpenTransferModal
    } = useOutletContext<OutletContextType>();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

    const [form] = Form.useForm<FormValues>();
    const isMobile = useMediaQuery('(max-width: 768px)');

    // State for sorting and filtering
    const [sortConfig, setSortConfig] = useState<SorterResult<Transaction>>({
        field: 'date',
        order: 'descend',
    });
    const [filters, setFilters] = useState<TableFilters>({});

    // State for "Convert to Transfer" modal
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [sourceTransaction, setSourceTransaction] = useState<Transaction | null>(null);
    const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
    const [destinationTransactions, setDestinationTransactions] = useState<Transaction[]>([]);
    const [loadingDestTransactions, setLoadingDestTransactions] = useState(false);
    const [selectedDestTransactionId, setSelectedDestTransactionId] = useState<string | null>(null);
    const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);

    const [syncingTransactions, setSyncingTransactions] = useState(false);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [draftFilters, setDraftFilters] = useState<TableFilters>({});
    const [draftSortConfig, setDraftSortConfig] = useState<SorterResult<Transaction>>({
        field: 'date',
        order: 'descend',
    });

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const [apiNotification, contextHolder] = notification.useNotification();

    const currentAccount = useMemo(() => {
        if (!accountId) return null;
        return accounts.find(acc => acc.id === accountId) || null;
    }, [accounts, accountId]);

    const formattedCurrentBalance = useMemo(() => {
        if (!currentAccount) return null;
        const currency = currentAccount.currency || 'EUR';
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(currentAccount.actualBalance);
    }, [currentAccount]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.type) count++;
        if (filters.categoryId) count++;
        if (filters.startDate) count++;
        if (filters.endDate) count++;
        return count;
    }, [filters]);

    const formSelectedAccountId = Form.useWatch('accountId', form);
    const formSelectedCurrency = useMemo(() => {
        const acc = accounts.find(a => a.id === (formSelectedAccountId ?? accountId));
        return getCurrencySymbol(acc?.currency ?? 'EUR');
    }, [formSelectedAccountId, accountId, accounts]);

    const typeLabel = (type: 'IN' | 'OUT') => type === 'IN' ? t('transactions.typeIn') : t('transactions.typeOut');

    const handleSyncGoCardlessTransactions = async () => {
        console.log('handleSyncGoCardlessTransactions called', { accountId, currentBalance });

        if (!accountId) {
            message.error(t('transactions.invalidAccountId'));
            return;
        }

        setSyncingTransactions(true);

        try {
            console.log('Calling syncGoCardlessBankAccount...');
            await api.syncGoCardlessBankAccount(accountId, { actualBalance: currentBalance });
            console.log('Sync API call completed successfully');

            // Chiudi il modal PRIMA di mostrare la notifica
            setIsBalanceModalOpen(false);
            setCurrentBalance(null);

            // Aggiorna subito lo stato degli account per far partire il loader
            // Attendiamo che fetchLayoutAccounts finisca prima di proseguire,
            // così lo stato "synchronizing" viene aggiornato nel context
            await fetchLayoutAccounts(true);

            // Aspetta che il modal si chiuda completamente prima di mostrare la notifica
            setTimeout(() => {
                console.log('Showing notification...');

                apiNotification.success({
                    message: t('transactions.syncStartedTitle'),
                    description: t('transactions.syncStartedDescription'),
                    placement: 'topRight',
                    duration: 5,
                });

            }, 500);

            // Refresh automatico dopo 30 secondi per mostrare le nuove transazioni
            setTimeout(() => {
                fetchTransactions();
                fetchLayoutAccounts(true);
            }, 30000);
        } catch (error) {
            console.error('Error during sync:', error);
            setIsBalanceModalOpen(false);
            apiNotification.error({
                message: t('transactions.syncErrorTitle'),
                description: t('transactions.syncErrorDescription'),
                placement: 'topRight',
                duration: 5,
            })
        } finally {
            setSyncingTransactions(false);
        }
    };


    const fetchTransactions = (page = currentPage, currentFilters = filters) => {
        if (!auth) return;
        setLoading(true);

        const sortField = sortConfig.field as string | undefined;
        const apiFilters: TransactionFilters = {
            type: currentFilters.type,
            categoryId: currentFilters.categoryId,
            startDate: currentFilters.startDate?.format('YYYY-MM-DD'),
            endDate: currentFilters.endDate?.format('YYYY-MM-DD'),
            search: currentFilters.search,
            sortBy: (['date', 'amount', 'description', 'type'].includes(sortField ?? '') ? sortField : 'date') as TransactionFilters['sortBy'],
            sortDir: sortConfig.order === 'ascend' ? 'ASC' : 'DESC',
        };

        const call = accountId
            ? api.getTransactionsByAccountIdPaged(accountId, page - 1, pageSize, apiFilters)
            : api.getTransactionsPaged(page - 1, pageSize, apiFilters);

        call
            .then(response => {
                setTransactions(response.data.content);
                setTotalTransactions(response.data.totalElements);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        setCurrentPage(1);
        fetchTransactions(1);
    }, [accountId, auth, transactionRefreshKey]);

    useEffect(() => {
        setCurrentPage(1);
        fetchTransactions(1, filters);
    }, [filters, sortConfig]);

    useEffect(() => {
        if (!destinationAccountId || !sourceTransaction) return;

        const fetchDestinationTransactions = async () => {
            setLoadingDestTransactions(true);
            try {
                const response = await api.getTransactionsByAccountId(destinationAccountId);
                const sourceDate = dayjs(sourceTransaction.date);
                const startDate = sourceDate.subtract(3, 'day');
                const endDate = sourceDate.add(3, 'day');

                const filtered = response.data.filter(t => {
                    const tDate = dayjs(t.date);
                    // Must be opposite type, same amount, and within date range
                    return t.type !== sourceTransaction.type &&
                        t.amount === sourceTransaction.amount &&
                        !t.transferId &&
                        tDate.isAfter(startDate) && tDate.isBefore(endDate);
                });
                setDestinationTransactions(filtered);
            } catch (error) {
                console.error("Failed to fetch destination transactions", error);
                message.error(t('transactions.linkTransferLoadError'));
            } finally {
                setLoadingDestTransactions(false);
            }
        };

        fetchDestinationTransactions();
    }, [destinationAccountId, sourceTransaction]);


    const handleDelete = async (id: string) => {
        Modal.confirm({
            title: t('transactions.deleteConfirm'),
            content: t('trash.recoverableFor30Days'),
            okText: t('common.delete'),
            okButtonProps: { danger: true },
            cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    await api.deleteTransaction(id);
                    message.success(t('trash.movedToTrash'));
                    fetchTransactions();
                    fetchLayoutAccounts();
                } catch (error) {
                    console.error("Failed to delete transaction", error);
                    message.error(t('transactions.deleteError'));
                }
            }
        });
    };

    const handleOpenCreateModal = () => {
        setEditingRecord(null);
        form.resetFields();
        if (accountId) {
            form.setFieldsValue({ accountId: accountId });
        }
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (record: Transaction) => {
        setEditingRecord(record);
        form.setFieldsValue({
            ...record,
            date: record.date ? dayjs(record.date) : null,
        });
        setIsModalOpen(true);
    };


    const handleCancel = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
    };

    const onFinish = async (values: FormValues) => {
        try {
            const dataToSend: TransactionRequest = {
                ...values,
                date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                amount: values.amount,
                type: values.type,
                description: values.description,
                accountId: values.accountId,
            };

            if (editingRecord) {
                await api.updateTransaction(editingRecord.id, dataToSend);
            } else {
                await api.createTransaction(dataToSend);
            }

            setIsModalOpen(false);
            fetchTransactions();
            fetchLayoutAccounts();
        } catch (error) {
            console.error("Failed to save transaction", error);
            message.error(t('transactions.saveError'));
        }
    };

    const handleOpenLinkTransferModal = (transaction: Transaction) => {
        setSourceTransaction(transaction);
        setIsLinkModalOpen(true);
    };

    const handleCancelLinkTransferModal = () => {
        setIsLinkModalOpen(false);
        setSourceTransaction(null);
        setDestinationAccountId(null);
        setDestinationTransactions([]);
        setSelectedDestTransactionId(null);
    };

    const handleConfirmLinkTransfer = async () => {
        if (!sourceTransaction || !selectedDestTransactionId) return;

        const request: LinkTransferRequest = {
            sourceTransactionId: sourceTransaction.id,
            destinationTransactionId: selectedDestTransactionId,
        };

        try {
            await api.linkTransactionsAsTransfer(request);
            message.success(t('transactions.linkTransferSuccess'));
            handleCancelLinkTransferModal();
            fetchTransactions();
        } catch (error) {
            console.error("Failed to link transactions", error);
            message.error(t('transactions.linkTransferError'));
        }
    };

    const columns: ColumnsType<Transaction> = [
        {
            title: t('transactions.data'),
            dataIndex: 'date',
            key: 'date',
            render: (text: string) => dayjs(text).format('DD/MM/YYYY'),
            sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
            sortOrder: sortConfig.field === 'date' ? sortConfig.order : null,
            defaultSortOrder: 'descend',
        },
        {
            title: t('transactions.description'),
            dataIndex: 'description',
            key: 'description',
            sorter: (a, b) => a.description.localeCompare(b.description),
            sortOrder: sortConfig.field === 'description' ? sortConfig.order : null,
        },
        {
            title: t('transactions.account'),
            dataIndex: 'accountName',
            key: 'accountName',
            sorter: (a, b) => a.accountName.localeCompare(b.accountName),
            sortOrder: sortConfig.field === 'accountName' ? sortConfig.order : null,
        },
        {
            title: t('transactions.category'),
            dataIndex: 'categoryName',
            key: 'categoryName',
            sorter: (a, b) => (a.categoryName || '').localeCompare(b.categoryName || ''),
            sortOrder: sortConfig.field === 'categoryName' ? sortConfig.order : null,
        },
        {
            title: t('transactions.amount'),
            dataIndex: 'amount',
            key: 'amount',
            sorter: (a, b) => {
                const amountA = a.type === 'OUT' ? -a.amount : a.amount;
                const amountB = b.type === 'OUT' ? -b.amount : b.amount;
                return amountA - amountB;
            },
            sortOrder: sortConfig.field === 'amount' ? sortConfig.order : null,
            render: (amount: number, record: Transaction) => {
                const sym = getCurrencySymbol(accounts.find(a => a.id === record.accountId)?.currency ?? 'EUR');
                return (<span>
                    <span style={{ color: record.type === 'IN' ? COLOR_POSITIVE : COLOR_NEGATIVE }}>
                        {record.type === 'IN'
                            ? <ArrowUpOutlined aria-hidden="true" />
                            : <ArrowDownOutlined aria-hidden="true" />}
                        {' '}{amount.toFixed(2)} {sym}
                    </span>
                    {record.originalCurrency && record.originalAmount != null && record.exchangeRate != null && (
                        <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.45)' }}>
                            {t('transactions.exchangeRateHint', {
                                originalAmount: record.originalAmount.toFixed(2),
                                originalCurrency: record.originalCurrency,
                                exchangeRate: record.exchangeRate
                            })}
                        </div>
                    )}
                </span>);
            }
        },
        {
            title: t('transactions.type'),
            dataIndex: 'type',
            key: 'type',
            render: (type: 'IN' | 'OUT') => (
                <Tag color={type === 'IN' ? 'success' : 'error'}>{typeLabel(type)}</Tag>
            ),
            filters: [
                { text: t('transactions.typeIn'), value: 'IN' },
                { text: t('transactions.typeOut'), value: 'OUT' },
            ],
        },
        {
            title: t('transactions.actions'),
            key: 'actions',
            render: (_: unknown, record: Transaction) => (
                <Flex gap="small">
                    <Button icon={<EditOutlined />} onClick={() => handleOpenEditModal(record)} aria-label={t('common.edit')} />
                    {!record.transferId && (
                        <Button icon={<SwapOutlined />} onClick={() => handleOpenLinkTransferModal(record)} aria-label={t('transactions.linkTransfer')} />
                    )}
                    <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} aria-label={t('common.delete')} />
                </Flex>
            )
        },
    ];

    const handleTableChange: TableProps<Transaction>['onChange'] = (_, _tableFilters, sorter) => {
        const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        setSortConfig({
            field: nextSorter.field as string,
            order: nextSorter.order,
        });
    };

    const processedTransactions = useMemo(() => {
        let data = transactions.map(t => {
            if (!t.accountName) {
                const account = accounts.find(acc => acc.id === t.accountId);
                return { ...t, accountName: account?.name || 'N/A' };
            }
            return t;
        });

        return data;
    }, [transactions, accounts]);

    const pageTitle = accountId
        ? t('transactions.titleAccount', { account: accounts.find(acc => acc.id === accountId)?.name })
        : t('transactions.titleAll');

    if (loading && transactions.length === 0) return <Spin size="large" />;

    const renderContent = () => {
        if (isMobile) {
            return (
                <>
                    {accountId && (
                        <Alert
                            type="info"
                            showIcon
                            message={currentAccount?.name || t('transactions.accountLabelFallback')}
                            description={t('transactions.currentBalanceLabel', { balance: formattedCurrentBalance ?? t('transactions.currentBalanceFallback') })}
                            style={{ marginBottom: 12 }}
                        />
                    )}
                    <List
                        dataSource={processedTransactions}
                        renderItem={item => (
                            <TransactionCard
                                transaction={item}
                                currency={accounts.find(a => a.id === item.accountId)?.currency}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDelete}
                                onConvertToTransfer={handleOpenLinkTransferModal}
                            />
                        )}
                        pagination={{
                            current: currentPage,
                            pageSize,
                            total: totalTransactions,
                            position: 'bottom',
                            align: 'center',
                            showSizeChanger: false,
                            showTotal: (total) => t('transactions.totalLabel', { total }),
                            onChange: (page) => {
                                setCurrentPage(page);
                                fetchTransactions(page);
                            },
                        }}
                    />
                </>
            );
        }
        if (accountId) {
            return (
                <Table
                    columns={columns}
                    dataSource={processedTransactions}
                    rowKey="id"
                    loading={loading}
                    onChange={handleTableChange}
                    size={'small'}
                    pagination={{
                        current: currentPage,
                        pageSize,
                        total: totalTransactions,
                        position: ['bottomCenter'],
                        showSizeChanger: false,
                        showTotal: (total) => t('transactions.totalLabel', { total }),
                        onChange: (page) => {
                            setCurrentPage(page);
                            fetchTransactions(page);
                        },
                    }}
                />
            );
        }
        return (
            <Table
                columns={columns}
                dataSource={processedTransactions}
                rowKey="id"
                loading={loading}
                onChange={handleTableChange}
                size={'small'}
                pagination={{
                    current: currentPage,
                    pageSize,
                    total: totalTransactions,
                    position: ['bottomCenter'],
                    showSizeChanger: false,
                    showTotal: (total) => t('transactions.totalLabel', { total }),
                    onChange: (page) => {
                        setCurrentPage(page);
                        fetchTransactions(page);
                    }
                }}
            />
        );
    };

    return (
        <>
            {contextHolder}
            <Flex justify="space-between" align="center" style={{ marginBottom: 16 }} wrap="wrap" gap="small">
                <Title level={2} style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem' }}>{pageTitle}</Title>
                <Space wrap size={isMobile ? 'small' : 'middle'}>
                    {accountId && accounts.find(acc => acc.id === accountId)?.linkedToExternal && (
                        <Button
                            icon={<RetweetOutlined spin={accounts.find(acc => acc.id === accountId)?.synchronizing} />}
                            onClick={() => setIsBalanceModalOpen(true)}
                            loading={syncingTransactions || accounts.find(acc => acc.id === accountId)?.synchronizing}
                            disabled={accounts.find(acc => acc.id === accountId)?.synchronizing}
                            size={isMobile ? 'middle' : 'large'}
                        >
                            {accounts.find(acc => acc.id === accountId)?.synchronizing ? t('transactions.syncing') : t('transactions.syncGoCardless')}
                        </Button>
                    )}
                    <Button
                        icon={<RetweetOutlined />}
                        onClick={handleOpenTransferModal}
                        size={isMobile ? 'middle' : 'large'}
                    >
                        {t('transactions.newTransfer')}
                    </Button>
                    <Button
                        icon={<UploadOutlined />}
                        onClick={() => setIsImportModalOpen(true)}
                        size={isMobile ? 'middle' : 'large'}
                        disabled={!accountId}
                    >
                        {t('transactions.import.open')}
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleOpenCreateModal}
                        size={isMobile ? 'middle' : 'large'}
                    >
                        {t('transactions.newTransaction')}
                    </Button>
                </Space>
            </Flex>


            <Flex vertical gap="middle" style={{ marginBottom: 16 }}>
                <Flex gap="small" align="stretch">
                    <Input
                        aria-label={t('transactions.searchPlaceholder')}
                        placeholder={t('transactions.searchPlaceholder')}
                        allowClear
                        size="middle"
                        style={{ flex: 1 }}
                        value={filters.search}
                        onChange={(e) => {
                            const val = e.target.value;
                            setFilters(prev => ({ ...prev, search: val || undefined }));
                        }}
                        onPressEnter={() => {
                            // La ricerca avviene tramite l'effetlo su 'filters'
                        }}
                        prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-description)' }} />}
                    />
                    {isMobile && (
                        <Badge count={activeFilterCount} size="small" style={{ display: 'flex' }}>
                            <Button
                                icon={<FilterOutlined />}
                                size="middle"
                                style={{ height: '100%' }}
                                onClick={() => {
                                    setDraftFilters(filters);
                                    setDraftSortConfig(sortConfig);
                                    setIsFilterDrawerOpen(true);
                                }}
                            />
                        </Badge>
                    )}
                </Flex>
                {!isMobile && (
                    <Flex gap="small" wrap="wrap">
                        <Select
                            placeholder={t('transactions.filterType')}
                            value={filters.type}
                            onChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
                            style={{ flex: 1, minWidth: 120 }}
                            allowClear
                        >
                            <Option value="IN">{t('transactions.typeIn')}</Option>
                            <Option value="OUT">{t('transactions.typeOut')}</Option>
                        </Select>
                        <Select
                            placeholder={t('transactions.filterCategory')}
                            value={filters.categoryId}
                            onChange={(value) => setFilters(prev => ({ ...prev, categoryId: value }))}
                            style={{ flex: 1, minWidth: 120 }}
                            allowClear
                        >
                            {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                        </Select>
                        <DatePicker
                            placeholder={t('transactions.fromDate')}
                            value={filters.startDate}
                            style={{ flex: 1, minWidth: 120 }}
                            onChange={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                        />
                        <DatePicker
                            placeholder={t('transactions.toDate')}
                            value={filters.endDate}
                            style={{ flex: 1, minWidth: 120 }}
                            onChange={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
                        />
                        <Select
                            placeholder={t('transactions.sortBy')}
                            value={sortConfig.field as string}
                            onChange={(value) => setSortConfig(prev => ({ ...prev, field: value }))}
                            style={{ flex: 1, minWidth: 120 }}
                        >
                            <Option value="date">{t('transactions.data')}</Option>
                            <Option value="description">{t('transactions.description')}</Option>
                            <Option value="amount">{t('transactions.amount')}</Option>
                            <Option value="accountName">{t('transactions.account')}</Option>
                            <Option value="categoryName">{t('transactions.category')}</Option>
                        </Select>
                        <Select
                            placeholder={t('transactions.sortOrder')}
                            value={sortConfig.order}
                            onChange={(value) => setSortConfig(prev => ({ ...prev, order: value }))}
                            style={{ flex: 1, minWidth: 120 }}
                        >
                            <Option value="ascend">{t('transactions.sortAsc')}</Option>
                            <Option value="descend">{t('transactions.sortDesc')}</Option>
                        </Select>
                    </Flex>
                )}
            </Flex>

            <Drawer
                title={t('transactions.filters')}
                placement="bottom"
                height="auto"
                open={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                styles={{ body: { paddingBottom: 'env(safe-area-inset-bottom, 16px)' } }}
                footer={
                    <Flex gap="small" justify="space-between">
                        <Button
                            block
                            onClick={() => {
                                setDraftFilters({});
                                setDraftSortConfig({ field: 'date', order: 'descend' });
                            }}
                        >
                            {t('transactions.clearFilters')}
                        </Button>
                        <Button
                            type="primary"
                            block
                            onClick={() => {
                                setFilters(draftFilters);
                                setSortConfig(draftSortConfig);
                                setIsFilterDrawerOpen(false);
                            }}
                        >
                            {t('transactions.applyFilters')}
                        </Button>
                    </Flex>
                }
            >
                <Flex vertical gap="middle">
                    <Select
                        placeholder={t('transactions.filterType')}
                        value={draftFilters.type}
                        onChange={(value) => setDraftFilters(prev => ({ ...prev, type: value }))}
                        style={{ width: '100%' }}
                        allowClear
                    >
                        <Option value="IN">{t('transactions.typeIn')}</Option>
                        <Option value="OUT">{t('transactions.typeOut')}</Option>
                    </Select>
                    <Select
                        placeholder={t('transactions.filterCategory')}
                        value={draftFilters.categoryId}
                        onChange={(value) => setDraftFilters(prev => ({ ...prev, categoryId: value }))}
                        style={{ width: '100%' }}
                        allowClear
                    >
                        {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                    </Select>
                    <DatePicker
                        placeholder={t('transactions.fromDate')}
                        value={draftFilters.startDate}
                        style={{ width: '100%' }}
                        onChange={(date) => setDraftFilters(prev => ({ ...prev, startDate: date }))}
                    />
                    <DatePicker
                        placeholder={t('transactions.toDate')}
                        value={draftFilters.endDate}
                        style={{ width: '100%' }}
                        onChange={(date) => setDraftFilters(prev => ({ ...prev, endDate: date }))}
                    />
                    <Select
                        placeholder={t('transactions.sortBy')}
                        value={draftSortConfig.field as string}
                        onChange={(value) => setDraftSortConfig(prev => ({ ...prev, field: value }))}
                        style={{ width: '100%' }}
                    >
                        <Option value="date">{t('transactions.data')}</Option>
                        <Option value="description">{t('transactions.description')}</Option>
                        <Option value="amount">{t('transactions.amount')}</Option>
                        <Option value="accountName">{t('transactions.account')}</Option>
                        <Option value="categoryName">{t('transactions.category')}</Option>
                    </Select>
                    <Select
                        placeholder={t('transactions.sortOrder')}
                        value={draftSortConfig.order}
                        onChange={(value) => setDraftSortConfig(prev => ({ ...prev, order: value }))}
                        style={{ width: '100%' }}
                    >
                        <Option value="ascend">{t('transactions.sortAsc')}</Option>
                        <Option value="descend">{t('transactions.sortDesc')}</Option>
                    </Select>
                </Flex>
            </Drawer>

            {renderContent()}

            <Modal title={editingRecord ? t('transactions.editTransaction') : t('transactions.newTransaction')} open={isModalOpen}
                onCancel={handleCancel} footer={null} destroyOnClose>
                <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 24 }}>
                    <Form.Item name="accountId" label={t('transactions.account')} rules={[{ required: true }]}>
                        <Select placeholder={t('transactions.selectAccount')} disabled={!!accountId || !!editingRecord}>
                            {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="amount" label={t('transactions.amount')} rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={0} addonAfter={formSelectedCurrency} />
                    </Form.Item>
                    <Form.Item name="type" label={t('transactions.type')} rules={[{ required: true }]}>
                        <Select placeholder={t('transactions.selectType')}>
                            <Option value="IN">{t('transactions.typeIn')}</Option>
                            <Option value="OUT">{t('transactions.typeOut')}</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="categoryId" label={t('transactions.category')}>
                        <Select placeholder={t('transactions.selectCategory')} allowClear>
                            {categories.map(cat => <Option key={cat.id} value={cat.id}>{cat.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="description" label={t('transactions.description')} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="date" label={t('transactions.data')} initialValue={dayjs()}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="note" label={t('transactions.note')}>
                        <Input.TextArea />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>{t('transactions.save')}</Button>

                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={t('transactions.linkTransfer')}
                open={isLinkModalOpen}
                onCancel={handleCancelLinkTransferModal}
                footer={[
                    <Button key="back" onClick={handleCancelLinkTransferModal}>{t('common.cancel')}</Button>,
                    <Button key="submit" type="primary" onClick={handleConfirmLinkTransfer}
                        disabled={!selectedDestTransactionId}>
                        {t('transactions.linkTransferSave')}
                    </Button>,
                ]}
                width={600}
                style={{ maxWidth: '95vw' }}
            >
                {sourceTransaction && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Text strong>{t('transactions.linkTransferSource')}</Text>
                        <p>
                            {dayjs(sourceTransaction.date).format('DD/MM/YYYY')} - {sourceTransaction.description} ({sourceTransaction.accountName})
                            -
                            <Text
                                type={sourceTransaction.type === 'IN' ? 'success' : 'danger'}> {sourceTransaction.amount.toFixed(2)} {getCurrencySymbol(accounts.find(a => a.id === sourceTransaction.accountId)?.currency ?? 'EUR')}</Text>
                        </p>

                        <Form layout="vertical">
                            <Form.Item label={t('transactions.linkTransferSelectAccount')}>
                                <Select
                                    placeholder={t('transactions.selectAccount')}
                                    onChange={(value) => setDestinationAccountId(value)}
                                    value={destinationAccountId}
                                >
                                    {accounts
                                        .filter(acc => acc.id !== sourceTransaction.accountId)
                                        .map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                                </Select>
                            </Form.Item>
                        </Form>

                        {loadingDestTransactions ? <Spin /> : (
                            destinationAccountId && (
                                destinationTransactions.length > 0 ? (
                                    <Radio.Group
                                        onChange={(e) => setSelectedDestTransactionId(e.target.value)}
                                        value={selectedDestTransactionId}
                                        style={{ width: '100%' }}
                                    >
                                        <List
                                            header={<div>{t('transactions.linkTransferSelectTransaction')}</div>}
                                            bordered
                                            dataSource={destinationTransactions}
                                            renderItem={item => (
                                                <List.Item>
                                                    <Radio value={item.id}>
                                                        {dayjs(item.date).format('DD/MM/YYYY')} - {item.description} -
                                                        <Text
                                                            type={item.type === 'IN' ? 'success' : 'danger'}> {item.amount.toFixed(2)} {getCurrencySymbol(accounts.find(a => a.id === destinationAccountId)?.currency ?? 'EUR')}</Text>
                                                    </Radio>
                                                </List.Item>
                                            )}
                                        />
                                    </Radio.Group>
                                ) : (
                                    <Alert
                                        message={t('transactions.linkTransferNoCompatible')}
                                        type="info" showIcon />
                                )
                            )
                        )}
                    </Space>
                )}
            </Modal>

            {accountId && (
                <TransactionImportModal
                    open={isImportModalOpen}
                    accountId={accountId}
                    categories={categories}
                    currency={currentAccount?.currency}
                    onClose={() => setIsImportModalOpen(false)}
                    onImported={() => {
                        setCurrentPage(1);
                        fetchTransactions(1);
                        fetchLayoutAccounts(true);
                    }}
                />
            )}

            <Modal
                title={t('transactions.balanceModalTitle')}
                open={isBalanceModalOpen}
                onCancel={() => {
                    setIsBalanceModalOpen(false);
                    setCurrentBalance(null);
                }}
                footer={[
                    <Button key="cancel" onClick={() => {
                        setIsBalanceModalOpen(false);
                        setCurrentBalance(null);
                    }}>
                        {t('common.cancel')}
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={handleSyncGoCardlessTransactions}
                    >
                        {t('common.confirm')}
                    </Button>
                ]}
            >
                <Form layout="vertical">
                    <Alert
                        message={t('transactions.balanceCurrent')}
                        description={t('transactions.balanceCurrentInfo')}
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                    <Form.Item label={t('transactions.balanceCurrent')}>
                        <InputNumber
                            style={{ width: '100%' }}
                            value={currentBalance}
                            onChange={(value) => setCurrentBalance(value)}
                            placeholder={t('transactions.balanceCurrentPlaceholder')}
                            addonAfter={getCurrencySymbol(currentAccount?.currency ?? 'EUR')}
                            precision={2}
                            autoFocus
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};
