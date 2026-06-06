// src/pages/transactions/TransactionsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    Pagination,
    Progress,
    Radio,
    Select,
    Space,
    Spin,
    Table,
    Tag,
    Typography
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, FilterOutlined, PlusOutlined, RetweetOutlined, RobotOutlined, SearchOutlined, SwapOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import type { TransactionFilters } from '../../services/api';
import type {
    CategorizationJobResponse,
    LinkTransferRequest,
    Transaction,
    TransactionRequest
} from '../../types/api';
import { useAuth } from '../../contexts/AuthContext';
import dayjs, { type Dayjs } from 'dayjs';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { usePageTitle } from '../../hooks/usePageTitle';
import { TransactionCard } from '../../components/TransactionCard';
import { TransactionImportModal } from '../../components/modals/TransactionImportModal';
import { PageHeader } from '../../components/PageHeader';
import { getCurrencySymbol } from '../../utils/currency';
import { COLOR_POSITIVE, COLOR_NEGATIVE } from '../../theme/tokens';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import type { AppOutletContext } from '../../types/outletContext';

const { Text } = Typography;
const { Option } = Select;

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
        categories: rawCategories,
        handleOpenTransferModal
    } = useOutletContext<AppOutletContext>();

    const categories = useMemo(
        () => [...rawCategories].sort((a, b) => a.name.localeCompare(b.name)),
        [rawCategories]
    );

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

    const [form] = Form.useForm<FormValues>();
    const { isSmallMobile: isMobile } = useBreakpoints();

    usePageTitle(accountId
        ? accounts.find(a => a.id === accountId)?.name ?? t('nav.transactions')
        : t('nav.transactions')
    );

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

    const [isAiCategorizationModalOpen, setIsAiCategorizationModalOpen] = useState(false);
    const [isAiCategorizationBackgrounded, setIsAiCategorizationBackgrounded] = useState(false);
    const [aiCategorizationJob, setAiCategorizationJob] = useState<CategorizationJobResponse | null>(null);
    const [aiCategorizationLoading, setAiCategorizationLoading] = useState(false);
    const aiPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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


    const stopAiPolling = () => {
        if (aiPollingRef.current !== null) {
            clearInterval(aiPollingRef.current);
            aiPollingRef.current = null;
        }
    };

    const dismissAiCategorization = (job: CategorizationJobResponse | null) => {
        stopAiPolling();
        setIsAiCategorizationModalOpen(false);
        setIsAiCategorizationBackgrounded(false);
        if (job?.status === 'COMPLETED') {
            setCurrentPage(1);
            fetchTransactions(1);
        }
        setAiCategorizationJob(null);
    };

    const startAiPolling = (jobId: string) => {
        stopAiPolling();
        aiPollingRef.current = setInterval(async () => {
            try {
                const res = await api.getCategorizationJobStatus(jobId);
                setAiCategorizationJob(res.data);
                if (res.data.status === 'COMPLETED' || res.data.status === 'FAILED') {
                    stopAiPolling();
                    setIsAiCategorizationBackgrounded(prev => {
                        if (prev) {
                            if (res.data.status === 'COMPLETED') {
                                setCurrentPage(1);
                                fetchTransactionsRef.current(1);
                                apiNotification.success({
                                    message: t('transactions.categorizeAi.statusCompleted'),
                                    description: t('transactions.categorizeAi.recap', { categorized: res.data.categorized }),
                                    placement: 'topRight',
                                    duration: 5,
                                });
                            } else {
                                apiNotification.error({
                                    message: t('transactions.categorizeAi.statusFailed'),
                                    description: t('transactions.categorizeAi.errorMessage'),
                                    placement: 'topRight',
                                    duration: 5,
                                });
                            }
                            setIsAiCategorizationBackgrounded(false);
                            setAiCategorizationJob(null);
                        }
                        return false;
                    });
                }
            } catch {
                stopAiPolling();
            }
        }, 10000);
    };

    const handleStartAiCategorization = async () => {
        if (aiCategorizationJob && (aiCategorizationJob.status === 'PENDING' || aiCategorizationJob.status === 'IN_PROGRESS')) {
            handleReopenAiCategorizationModal();
            return;
        }
        setAiCategorizationLoading(true);
        setAiCategorizationJob(null);
        try {
            const res = await api.startCategorizationJob();
            setAiCategorizationJob(res.data);
            setIsAiCategorizationModalOpen(true);
            setIsAiCategorizationBackgrounded(false);
            if (res.data.status !== 'COMPLETED' && res.data.status !== 'FAILED') {
                startAiPolling(res.data.jobId);
            }
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
            const status = axiosError?.response?.status;
            if (status === 422 || status === 400) {
                const backendMessage = axiosError?.response?.data?.message;
                message.info(backendMessage ?? t('transactions.categorizeAi.noUncategorized'));
            } else {
                message.error(t('transactions.categorizeAi.startError'));
            }
        } finally {
            setAiCategorizationLoading(false);
        }
    };

    const handleBackgroundAiCategorization = () => {
        setIsAiCategorizationModalOpen(false);
        setIsAiCategorizationBackgrounded(true);
    };

    const handleReopenAiCategorizationModal = () => {
        setIsAiCategorizationBackgrounded(false);
        setIsAiCategorizationModalOpen(true);
    };

    const handleCloseAiCategorizationModal = () => {
        dismissAiCategorization(aiCategorizationJob);
    };

    const scrollToTop = () => {
        document.querySelector('.ant-layout-content')?.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const fetchTransactions = (page = currentPage, currentFilters = filters, append = false) => {
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
                if (append) {
                    setTransactions(prev => [...prev, ...response.data.content]);
                } else {
                    setTransactions(response.data.content);
                }
                setTotalTransactions(response.data.page.totalElements);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    // Stable ref so useCallback closures always call the latest version
    const fetchTransactionsRef = useRef(fetchTransactions);
    useEffect(() => { fetchTransactionsRef.current = fetchTransactions; });

    useEffect(() => {
        setCurrentPage(1);
        fetchTransactionsRef.current(1, filters, /* append */ false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId, auth, transactionRefreshKey]);

    useEffect(() => {
        setCurrentPage(1);
        fetchTransactionsRef.current(1, filters, /* append */ false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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


    const handleDelete = useCallback(async (id: string) => {
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
                    fetchTransactionsRef.current();
                    fetchLayoutAccounts();
                } catch (error) {
                    console.error("Failed to delete transaction", error);
                    message.error(t('transactions.deleteError'));
                }
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t, fetchLayoutAccounts]);

    const handleOpenEditModal = useCallback((record: Transaction) => {
        setEditingRecord(record);
        form.setFieldsValue({
            ...record,
            date: record.date ? dayjs(record.date) : null,
        });
        setIsModalOpen(true);
    }, [form]);

    const handleOpenLinkTransferModal = useCallback((transaction: Transaction) => {
        setSourceTransaction(transaction);
        setIsLinkModalOpen(true);
    }, []);

    const handleOpenCreateModal = () => {
        setEditingRecord(null);
        form.resetFields();
        if (accountId) {
            form.setFieldsValue({ accountId: accountId });
        }
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

    const handleConvertSingleToTransfer = async () => {
        if (!sourceTransaction || !destinationAccountId) return;

        try {
            await api.convertSingleToTransfer({
                sourceTransactionId: sourceTransaction.id,
                targetAccountId: destinationAccountId,
            });
            message.success(t('transactions.linkTransferSuccess'));
            handleCancelLinkTransferModal();
            fetchTransactions();
        } catch (error) {
            console.error("Failed to convert single transaction to transfer", error);
            message.error(t('transactions.linkTransferError'));
        }
    };

    const columns: ColumnsType<Transaction> = [
        {
            title: t('transactions.data'),
            dataIndex: 'date',
            key: 'date',
            width: 120,
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
            ellipsis: { showTitle: true },
        },
        {
            title: t('transactions.account'),
            dataIndex: 'accountName',
            key: 'accountName',
            width: 160,
            ellipsis: { showTitle: true },
            sorter: (a, b) => a.accountName.localeCompare(b.accountName),
            sortOrder: sortConfig.field === 'accountName' ? sortConfig.order : null,
        },
        {
            title: t('transactions.category'),
            dataIndex: 'categoryName',
            key: 'categoryName',
            width: 160,
            ellipsis: { showTitle: true },
            sorter: (a, b) => (a.categoryName || '').localeCompare(b.categoryName || ''),
            sortOrder: sortConfig.field === 'categoryName' ? sortConfig.order : null,
        },
        {
            title: t('transactions.amount'),
            dataIndex: 'amount',
            key: 'amount',
            width: 180,
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
                        <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                            {t('transactions.exchangeRateHint', {
                                originalAmount: record.originalAmount.toFixed(2),
                                originalCurrency: record.originalCurrency,
                                exchangeRate: record.exchangeRate
                            })}
                        </Text>
                    )}
                </span>);
            }
        },
        {
            title: t('transactions.type'),
            dataIndex: 'type',
            key: 'type',
            width: 110,
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
            width: 140,
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
        const nextField = nextSorter.field as string | undefined;
        const nextOrder = nextSorter.order;
        if (nextField === sortConfig.field && nextOrder === sortConfig.order) return;
        setSortConfig({ field: nextField, order: nextOrder });
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
                        loading={loading}
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
                    />
                    <Pagination
                        current={currentPage}
                        pageSize={pageSize}
                        total={totalTransactions}
                        onChange={(page) => {
                            setCurrentPage(page);
                            fetchTransactions(page, filters, false);
                            scrollToTop();
                        }}
                        showSizeChanger={false}
                        showTotal={(total) => t('transactions.totalLabel', { total })}
                        size="small"
                        style={{ textAlign: 'center', marginTop: 16 }}
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
                    tableLayout="fixed"
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
                            scrollToTop();
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
                tableLayout="fixed"
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
                        scrollToTop();
                    }
                }}
            />
        );
    };

    return (
        <>
            {contextHolder}
            <PageHeader
                title={pageTitle}
                actions={
                    <Space wrap size={isMobile ? 'small' : 'middle'} style={{ width: isMobile ? '100%' : 'auto' }}>
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
                            icon={<RobotOutlined />}
                            onClick={handleStartAiCategorization}
                            loading={aiCategorizationLoading}
                            size={isMobile ? 'middle' : 'large'}
                        >
                            {t('transactions.categorizeWithAi')}
                        </Button>
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
                }
            />


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
                        <Select placeholder={t('transactions.selectAccount')} disabled={!!accountId || !!editingRecord} getPopupContainer={triggerNode => triggerNode.parentNode}>
                            {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="amount" label={t('transactions.amount')} rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={0} addonAfter={formSelectedCurrency} parser={(value) => value?.replace(',', '.') as any} />
                    </Form.Item>
                    <Form.Item name="type" label={t('transactions.type')} rules={[{ required: true }]}>
                        <Select placeholder={t('transactions.selectType')} getPopupContainer={triggerNode => triggerNode.parentNode}>
                            <Option value="IN">{t('transactions.typeIn')}</Option>
                            <Option value="OUT">{t('transactions.typeOut')}</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="categoryId" label={t('transactions.category')}>
                        <Select placeholder={t('transactions.selectCategory')} allowClear getPopupContainer={triggerNode => triggerNode.parentNode}>
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
                    <Button key="convert" type="default" onClick={handleConvertSingleToTransfer}
                        disabled={!destinationAccountId}>
                        {t('transactions.linkTransferCreate')}
                    </Button>,
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
                            parser={(value) => value?.replace(',', '.') as any}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={t('transactions.categorizeAi.modalTitle')}
                open={isAiCategorizationModalOpen}
                onCancel={() => {
                    const isRunning = aiCategorizationJob?.status === 'PENDING' || aiCategorizationJob?.status === 'IN_PROGRESS';
                    if (isRunning) {
                        handleBackgroundAiCategorization();
                    } else {
                        handleCloseAiCategorizationModal();
                    }
                }}
                footer={
                    (aiCategorizationJob?.status === 'COMPLETED' || aiCategorizationJob?.status === 'FAILED')
                        ? [
                            <Button key="close" type="primary" onClick={handleCloseAiCategorizationModal}>
                                {t('transactions.categorizeAi.close')}
                            </Button>
                        ]
                        : [
                            <Button key="background" onClick={handleBackgroundAiCategorization}>
                                {t('transactions.categorizeAi.sendToBackground')}
                            </Button>
                        ]
                }
                closable={true}
                maskClosable={false}
            >
                {aiCategorizationJob ? (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {(aiCategorizationJob.status === 'PENDING' || aiCategorizationJob.status === 'IN_PROGRESS') && (
                            <>
                                <Flex justify="space-between" align="center">
                                    <Text>
                                        {aiCategorizationJob.status === 'PENDING'
                                            ? t('transactions.categorizeAi.statusPending')
                                            : t('transactions.categorizeAi.statusInProgress')}
                                    </Text>
                                    <Text type="secondary">
                                        {t('transactions.categorizeAi.total', { total: aiCategorizationJob.total })}
                                    </Text>
                                </Flex>
                                <Progress
                                    percent={aiCategorizationJob.total > 0
                                        ? Math.round((aiCategorizationJob.processed / aiCategorizationJob.total) * 100)
                                        : 0}
                                    status="active"
                                />
                                <Text type="secondary">
                                    {t('transactions.categorizeAi.categorized', {
                                        categorized: aiCategorizationJob.categorized,
                                        processed: aiCategorizationJob.processed,
                                    })}
                                </Text>
                            </>
                        )}
                        {aiCategorizationJob.status === 'COMPLETED' && (
                            <>
                                <Alert
                                    type="success"
                                    showIcon
                                    message={t('transactions.categorizeAi.statusCompleted')}
                                    description={t('transactions.categorizeAi.recap', {
                                        categorized: aiCategorizationJob.categorized,
                                    })}
                                />
                            </>
                        )}
                        {aiCategorizationJob.status === 'FAILED' && (
                            <Alert
                                type="error"
                                showIcon
                                message={t('transactions.categorizeAi.statusFailed')}
                                description={t('transactions.categorizeAi.errorMessage')}
                            />
                        )}
                    </Space>
                ) : (
                    <Flex justify="center" align="center" style={{ padding: '24px 0' }}>
                        <Spin />
                    </Flex>
                )}
            </Modal>

            {isAiCategorizationBackgrounded && aiCategorizationJob && (
                <div style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 1000,
                    width: 280,
                    background: 'var(--ant-color-bg-elevated)',
                    borderRadius: 8,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}>
                    <Flex justify="space-between" align="center">
                        <Text strong style={{ fontSize: 13 }}>
                            <RobotOutlined style={{ marginRight: 6 }} />
                            {t('transactions.categorizeAi.modalTitle')}
                        </Text>
                        <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto' }}
                            onClick={handleReopenAiCategorizationModal}
                        >
                            {t('transactions.categorizeAi.reopen')}
                        </Button>
                    </Flex>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {aiCategorizationJob.status === 'PENDING'
                            ? t('transactions.categorizeAi.statusPending')
                            : t('transactions.categorizeAi.statusInProgress')}
                    </Text>
                    <Progress
                        percent={aiCategorizationJob.total > 0
                            ? Math.round((aiCategorizationJob.processed / aiCategorizationJob.total) * 100)
                            : 0}
                        status="active"
                        size="small"
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        {t('transactions.categorizeAi.progress', {
                            processed: aiCategorizationJob.processed,
                            total: aiCategorizationJob.total,
                        })}
                    </Text>
                </div>
            )}
        </>
    );
};
