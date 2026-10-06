// src/pages/transactions/TransactionsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import {
    Alert,
    Badge,
    Button,
    DatePicker,
    Drawer,
    Dropdown,
    Flex,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    notification,
    Progress,
    Radio,
    Select,
    Space,
    Spin,
    Table,
    Tag,
    Typography
} from 'antd';
import { SafeSelect } from '../../components/common/SafeSelect';
import { SafeDatePicker } from '../../components/common/SafeDatePicker';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, FilterOutlined, MoreOutlined, PlusOutlined, RetweetOutlined, RobotOutlined, SearchOutlined, SwapOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../services/api';
import type {
    CategorizationJobResponse,
    LinkTransferRequest,
    Transaction,
    TransactionRequest
} from '../../types/api';
import dayjs from 'dayjs';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePageTitle } from '../../hooks/usePageTitle';
import { TransactionCard } from '../../components/TransactionCard';
import { TransactionImportModal } from '../../components/modals/TransactionImportModal';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { InlineError } from '../../components/common/InlineError';
import { ItemList } from '../../components/common/ItemList';
import { getCurrencySymbol } from '../../utils/currency';
import { formatMoney, formatNumber } from '../../utils/format';
import { FONT_SIZE, RADIUS, SHADOW, SPACING, getSemanticColors } from '../../theme/tokens';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useConfirm } from '../../hooks/useConfirm';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { MenuProps } from 'antd';
import type { AppOutletContext } from '../../types/outletContext';
import { commaDecimalParser } from '../../utils/number';
import { queryKeys } from '../../queryKeys';
import {
    DEFAULT_TRANSACTION_SORT,
    useTransactionFilters,
    type TableFilters,
    type TransactionSort,
    type TransactionSortField,
} from '../../hooks/useTransactionFilters';
import { TRANSACTIONS_PAGE_SIZE, useTransactionsList } from '../../hooks/useTransactionsList';

const { Text } = Typography;
const { Option } = Select;

interface FormValues extends Omit<TransactionRequest, 'date'> {
    date?: dayjs.Dayjs | null;
}

const SEARCH_DEBOUNCE_MS = 300;
// Candidati per il collegamento a trasferimento: una finestra di 7 giorni su un singolo
// conto sta largamente entro questo limite.
const TRANSFER_CANDIDATES_PAGE_SIZE = 200;
const AI_POLL_INTERVAL_MS = 10_000;
const AI_POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minuti

/**
 * Carica la pagina successiva quando il fondo della lista entra nel viewport, con un
 * pulsante come alternativa (e per chi non scorre). Sostituisce la paginazione numerata
 * su mobile, che costringeva a tornare in cima a ogni pagina.
 */
const LoadMore = ({ onLoadMore, loading, label }: { onLoadMore: () => void; loading: boolean; label: string }) => {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const onLoadMoreRef = useRef(onLoadMore);
    useEffect(() => { onLoadMoreRef.current = onLoadMore; });

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        // rootMargin: parte un po' prima del fondo, così la pagina successiva è spesso già
        // arrivata quando l'utente ci scorre sopra.
        const observer = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) onLoadMoreRef.current();
        }, { rootMargin: '200px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <Flex ref={sentinelRef} justify="center" style={{ marginTop: SPACING.md }}>
            <Button onClick={onLoadMore} loading={loading}>{label}</Button>
        </Flex>
    );
};

export const TransactionsPage = () => {
    const { t } = useTranslation();
    const { accountId } = useParams<{ accountId?: string }>();
    const confirm = useConfirm();
    const {
        accounts,
        fetchAccounts: fetchLayoutAccounts,
        categories: rawCategories,
        handleOpenTransferModal
    } = useOutletContext<AppOutletContext>();

    const categories = useMemo(
        () => [...rawCategories].sort((a, b) => a.name.localeCompare(b.name)),
        [rawCategories]
    );

    const [saving, setSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

    const [form] = Form.useForm<FormValues>();
    const { isSmallMobile: isMobile } = useBreakpoints();
    // Su touch (tablet in vista tabella) i bottoni hanno min 44px (mobile.css): la colonna
    // azioni deve allargarsi di conseguenza, altrimenti i tre bottoni escono dalla cella.
    const isCoarsePointer = useMediaQuery('(pointer: coarse)');
    // Fra 992 e 1199px la Sider (300px) è aperta e restano ~600px: data e categoria
    // diventano una riga secondaria sotto la descrizione invece di colonne proprie.
    const isCompactTable = useMediaQuery('(min-width: 992px) and (max-width: 1199px)');
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');

    // Indice per id: il render faceva `accounts.find(...)` una volta per riga nella colonna
    // importo e altre cinque volte nell'header, per ogni render.
    const accountsById = useMemo(
        () => new Map(accounts.map(a => [a.id, a])),
        [accounts]
    );


    usePageTitle(accountId
        ? accountsById.get(accountId)?.name ?? t('nav.transactions')
        : t('nav.transactions')
    );

    // Filtri, ordinamento e pagina vivono nell'URL (vedi useTransactionFilters).
    const {
        filters,
        sort: sortConfig,
        page: currentPage,
        apiFilters,
        hasActiveFilters,
        setFilter,
        setSearch,
        setSort,
        applyFiltersAndSort,
        setPage,
        clearFilters,
    } = useTransactionFilters();

    const {
        transactions,
        total: totalTransactions,
        hasData,
        isLoading: loading,
        isError: loadFailed,
        refetch: refetchTransactions,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
    } = useTransactionsList({ accountId, filters: apiFilters, page: currentPage, infinite: isMobile });

    // Il campo di ricerca ha uno stato locale e scrive nell'URL con debounce: senza,
    // ogni tasto premuto avrebbe fatto una richiesta (12 per una ricerca di 12 caratteri).
    const [searchInput, setSearchInput] = useState(filters.search ?? '');
    // Cambiando conto la query string riparte vuota: il campo va riallineato. Aggiustamento
    // durante il render (non in un effetto) per non mostrare per un frame il testo vecchio.
    const [searchAccountId, setSearchAccountId] = useState(accountId);
    if (searchAccountId !== accountId) {
        setSearchAccountId(accountId);
        setSearchInput(filters.search ?? '');
    }
    const urlSearch = filters.search ?? '';
    useEffect(() => {
        if (searchInput === urlSearch) return;
        const id = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
        // setSearch cambia identità a ogni cambio di URL: dipendere da lui riavvierebbe il
        // timer anche quando l'utente non sta scrivendo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput, urlSearch]);

    const handleClearFilters = () => {
        setSearchInput('');
        clearFilters();
    };

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
    const [draftSortConfig, setDraftSortConfig] = useState<TransactionSort>(DEFAULT_TRANSACTION_SORT);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const [isAiCategorizationModalOpen, setIsAiCategorizationModalOpen] = useState(false);
    const [isAiCategorizationBackgrounded, setIsAiCategorizationBackgrounded] = useState(false);
    const [aiCategorizationJob, setAiCategorizationJob] = useState<CategorizationJobResponse | null>(null);
    const [aiCategorizationLoading, setAiCategorizationLoading] = useState(false);
    const aiPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const aiPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [apiNotification, contextHolder] = notification.useNotification();

    const currentAccount = useMemo(() => {
        if (!accountId) return null;
        return accountsById.get(accountId) ?? null;
    }, [accountsById, accountId]);

    const formattedCurrentBalance = currentAccount
        ? formatMoney(currentAccount.actualBalance, currentAccount.currency || 'EUR')
        : null;

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
        const acc = accountsById.get(formSelectedAccountId ?? accountId ?? '');
        return getCurrencySymbol(acc?.currency ?? 'EUR');
    }, [formSelectedAccountId, accountId, accountsById]);

    const typeLabel = useCallback((type: 'IN' | 'OUT') => type === 'IN' ? t('transactions.typeIn') : t('transactions.typeOut'), [t]);

    const handleSyncBankTransactions = async () => {
        if (!accountId) {
            message.error(t('transactions.invalidAccountId'));
            return;
        }

        setSyncingTransactions(true);

        try {
            await api.syncBankAccount(api.providerSlug(currentAccount?.provider ?? null), accountId, { actualBalance: currentBalance });

            // Chiudi il modal PRIMA di mostrare la notifica
            setIsBalanceModalOpen(false);
            setCurrentBalance(null);

            // Aggiorna subito lo stato degli account per far partire il loader
            // Attendiamo che fetchLayoutAccounts finisca prima di proseguire,
            // così lo stato "synchronizing" viene aggiornato nel context
            await fetchLayoutAccounts(true);

            // Aspetta che il modal si chiuda completamente prima di mostrare la notifica
            setTimeout(() => {
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
        if (aiPollTimeoutRef.current !== null) {
            clearTimeout(aiPollTimeoutRef.current);
            aiPollTimeoutRef.current = null;
        }
    };

    // Cleanup su unmount: senza di questo, uscendo dalla pagina con un job in corso
    // l'intervallo sopravviveva e continuava a chiamare l'API ogni 10 s senza alcun
    // tetto, facendo setState su un albero smontato. Il modello corretto è quello di
    // useAccountSync (guard su document.hidden + tetto + cleanup).
    const stopAiPollingRef = useRef(stopAiPolling);
    useEffect(() => { stopAiPollingRef.current = stopAiPolling; });
    useEffect(() => () => stopAiPollingRef.current(), []);

    const dismissAiCategorization = (job: CategorizationJobResponse | null) => {
        stopAiPolling();
        setIsAiCategorizationModalOpen(false);
        setIsAiCategorizationBackgrounded(false);
        if (job?.status === 'COMPLETED') {
            refreshTransactions();
        }
        setAiCategorizationJob(null);
    };

    const startAiPolling = (jobId: string) => {
        stopAiPolling();
        // Tetto di sicurezza: se il backend non chiude mai il job, il polling si ferma
        // comunque invece di proseguire indefinitamente.
        aiPollTimeoutRef.current = setTimeout(() => stopAiPolling(), AI_POLL_TIMEOUT_MS);
        aiPollingRef.current = setInterval(async () => {
            // Niente richieste mentre la tab è in background.
            if (document.hidden) return;
            try {
                const res = await api.getCategorizationJobStatus(jobId);
                setAiCategorizationJob(res.data);
                if (res.data.status === 'COMPLETED' || res.data.status === 'FAILED') {
                    stopAiPolling();
                    setIsAiCategorizationBackgrounded(prev => {
                        if (prev) {
                            if (res.data.status === 'COMPLETED') {
                                refreshTransactions();
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
        }, AI_POLL_INTERVAL_MS);
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

    // Le mutazioni sulle transazioni cambiano anche i dati derivati (totali, trend,
    // breakdown, budget, saldo): si invalidano per prefisso, così coprono sia
    // `['dashboardData', …]` sia le query sotto `['reports', …]`.
    const queryClient = useQueryClient();
    const invalidateDerivedData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
        queryClient.invalidateQueries({ queryKey: ['reports'] });
    }, [queryClient]);

    // Ricarica tutte le liste di transazioni in cache (ogni conto, filtro e modalità).
    const refreshTransactions = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
    }, [queryClient]);

    useEffect(() => {
        if (!destinationAccountId || !sourceTransaction) return;

        const fetchDestinationTransactions = async () => {
            setLoadingDestTransactions(true);
            try {
                const sourceDate = dayjs(sourceTransaction.date);
                const startDate = sourceDate.subtract(3, 'day');
                const endDate = sourceDate.add(3, 'day');

                // Query mirata invece di `getTransactionsByAccountId`, che restituisce
                // l'intero storico non paginato del conto per poi scartarne quasi tutto
                // lato client. Finestra e tipo li filtra il backend, che li supporta già;
                // importo e assenza di transferId restano lato client. Il predicato
                // client sotto è invariato, così il risultato è identico a prima: la
                // finestra server è un sovrainsieme (inclusiva) di quella client
                // (esclusiva).
                const oppositeType = sourceTransaction.type === 'IN' ? 'OUT' : 'IN';
                const response = await api.getTransactionsByAccountIdPaged(
                    destinationAccountId,
                    0,
                    TRANSFER_CANDIDATES_PAGE_SIZE,
                    {
                        type: oppositeType,
                        startDate: startDate.format('YYYY-MM-DD'),
                        endDate: endDate.format('YYYY-MM-DD'),
                    }
                );

                const filtered = response.data.content.filter(t => {
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
        confirm({
            title: t('transactions.deleteConfirm'),
            content: t('trash.recoverableFor30Days'),
            okText: t('common.delete'),
            danger: true,
            cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    await api.deleteTransaction(id);
                    message.success(t('trash.movedToTrash'));
                    refreshTransactions();
                    fetchLayoutAccounts();
                    invalidateDerivedData();
                } catch (error) {
                    console.error("Failed to delete transaction", error);
                    message.error(t('transactions.deleteError'));
                }
            }
        });
    }, [t, confirm, fetchLayoutAccounts, invalidateDerivedData, refreshTransactions]);

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
        if (saving) return;
        setSaving(true);
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
            message.success(t(editingRecord ? 'transactions.updatedSuccess' : 'transactions.createdSuccess'));
            refreshTransactions();
            fetchLayoutAccounts();
            invalidateDerivedData();
        } catch (error) {
            console.error("Failed to save transaction", error);
            message.error(t('transactions.saveError'));
        } finally {
            setSaving(false);
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
            refreshTransactions();
            invalidateDerivedData();
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
            refreshTransactions();
            invalidateDerivedData();
        } catch (error) {
            console.error("Failed to convert single transaction to transfer", error);
            message.error(t('transactions.linkTransferError'));
        }
    };

    // Memoizzate: erano ricostruite a ogni render, con closure render/sorter nuove, quindi
    // la Table ri-renderizzava tutte le celle. I tre handler usati qui dentro sono già
    // useCallback e `semantic` è ora una costante per tema.
    //
    // Larghezze: tutte le colonne hanno una larghezza fissa tranne la descrizione, che con
    // tableLayout="fixed" prende lo spazio rimanente e va in ellissi. Le colonne secondarie
    // spariscono sotto certi breakpoint (`responsive`) così la tabella sta sempre nello
    // schermo: il tipo è già espresso da freccia e colore dell'importo, il conto è
    // ridondante nella vista del singolo conto.
    const columns: ColumnsType<Transaction> = useMemo(() => [
        {
            title: t('transactions.data'),
            dataIndex: 'date',
            key: 'date',
            width: 110,
            hidden: isCompactTable,
            render: (text: string) => dayjs(text).format('DD/MM/YYYY'),
            // sorter: true = ordinamento lato server. Un comparatore client riordinava
            // solo i 20 elementi della pagina corrente.
            sorter: true,
            sortOrder: sortConfig.field === 'date' ? sortConfig.order : null,
            sortDirections: ['descend', 'ascend'],
        },
        {
            title: t('transactions.description'),
            dataIndex: 'description',
            key: 'description',
            sorter: true,
            sortOrder: sortConfig.field === 'description' ? sortConfig.order : null,
            ellipsis: { showTitle: true },
            render: (text: string, record: Transaction) => isCompactTable ? (
                <>
                    <Text ellipsis={{ tooltip: text }} style={{ display: 'block' }}>{text}</Text>
                    <Text type="secondary" ellipsis style={{ display: 'block', fontSize: FONT_SIZE.xs }}>
                        {dayjs(record.date).format('DD/MM/YYYY')}
                        {record.categoryName && ` · ${record.categoryName}`}
                    </Text>
                </>
            ) : text,
        },
        {
            title: t('transactions.account'),
            dataIndex: 'accountName',
            key: 'accountName',
            width: 160,
            responsive: ['xl'],
            hidden: !!accountId,
            ellipsis: { showTitle: true },
        },
        {
            title: t('transactions.category'),
            dataIndex: 'categoryName',
            key: 'categoryName',
            width: 150,
            hidden: isCompactTable,
            ellipsis: { showTitle: true },
        },
        {
            title: t('transactions.amount'),
            dataIndex: 'amount',
            key: 'amount',
            width: 150,
            sorter: true,
            sortOrder: sortConfig.field === 'amount' ? sortConfig.order : null,
            render: (amount: number, record: Transaction) => {
                const currency = accountsById.get(record.accountId)?.currency ?? 'EUR';
                return (<span>
                    <span style={{ color: record.type === 'IN' ? semantic.positive : semantic.negative }}>
                        {record.type === 'IN'
                            ? <ArrowUpOutlined aria-hidden="true" />
                            : <ArrowDownOutlined aria-hidden="true" />}
                        {' '}{formatMoney(amount, currency)}
                    </span>
                    {record.originalCurrency && record.originalAmount != null && record.exchangeRate != null && (
                        <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, display: 'block' }}>
                            {t('transactions.exchangeRateHint', {
                                originalAmount: formatNumber(record.originalAmount, 2, 2),
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
            width: 100,
            responsive: ['xxl'],
            render: (type: 'IN' | 'OUT') => (
                <Tag color={type === 'IN' ? 'success' : 'error'}>{typeLabel(type)}</Tag>
            ),
            // Filtro collegato a quello sopra la tabella: prima veniva ignorato.
            filters: [
                { text: t('transactions.typeIn'), value: 'IN' },
                { text: t('transactions.typeOut'), value: 'OUT' },
            ],
            filterMultiple: false,
            filteredValue: filters.type ? [filters.type] : null,
        },
        {
            title: t('transactions.actions'),
            key: 'actions',
            width: isCoarsePointer ? 170 : 130,
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
    ], [t, sortConfig, filters.type, semantic, accountsById, typeLabel, handleDelete, handleOpenEditModal, handleOpenLinkTransferModal, isCoarsePointer, isCompactTable, accountId]);

    const handleTableChange: TableProps<Transaction>['onChange'] = (_, tableFilters, sorter, extra) => {
        if (extra.action === 'filter') {
            const type = tableFilters.type?.[0];
            setFilter('type', type === 'IN' || type === 'OUT' ? type : undefined);
            return;
        }
        if (extra.action !== 'sort') return;
        const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        // Il terzo click su una colonna toglie l'ordinamento: si torna al default (data, desc).
        if (!nextSorter.order) {
            setSort(DEFAULT_TRANSACTION_SORT);
            return;
        }
        setSort({ field: nextSorter.columnKey as TransactionSortField, order: nextSorter.order });
    };

    const handlePageChange = (page: number) => {
        setPage(page);
        scrollToTop();
    };

    const processedTransactions = useMemo(() => {
        const data = transactions.map(t => {
            if (!t.accountName) {
                const account = accountsById.get(t.accountId);
                return { ...t, accountName: account?.name || 'N/A' };
            }
            return t;
        });

        return data;
    }, [transactions, accountsById]);

    const pageTitle = accountId
        ? t('transactions.titleAccount', { account: currentAccount?.name })
        : t('transactions.titleAll');

    // Stato vuoto onesto: un errore non è "nessuna transazione", e una ricerca senza
    // risultati non è un conto vuoto (prima entrambi invitavano a creare la prima transazione).
    const emptyState = hasActiveFilters ? (
        <EmptyState
            description={t('transactions.noResults')}
            actions={[{ label: t('transactions.resetFilters'), onClick: handleClearFilters }]}
        />
    ) : (
        <EmptyState
            description={t('transactions.emptyDescription')}
            actions={[{ label: t('transactions.newTransaction'), onClick: handleOpenCreateModal }]}
        />
    );

    const renderContent = () => {
        if (loadFailed && !hasData) {
            return <InlineError message={t('transactions.loadError')} onRetry={refetchTransactions} />;
        }
        // Errore su un aggiornamento con dati già a schermo: restano visibili, con l'avviso.
        const staleWarning = loadFailed && (
            <InlineError
                message={t('transactions.refreshError')}
                onRetry={refetchTransactions}
                style={{ marginBottom: SPACING.sm }}
            />
        );
        if (isMobile) {
            return (
                <>
                    {accountId && (
                        <Alert
                            type="info"
                            showIcon
                            title={currentAccount?.name || t('transactions.accountLabelFallback')}
                            description={t('transactions.currentBalanceLabel', { balance: formattedCurrentBalance ?? t('transactions.currentBalanceFallback') })}
                            style={{ marginBottom: SPACING.sm }}
                        />
                    )}
                    {staleWarning}
                    <ItemList
                        items={processedTransactions}
                        rowKey={item => item.id}
                        loading={loading}
                        aria-label={pageTitle}
                        deferOffscreen
                        empty={emptyState}
                        renderItem={item => (
                            <TransactionCard
                                transaction={item}
                                currency={accountsById.get(item.accountId)?.currency}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDelete}
                                onConvertToTransfer={handleOpenLinkTransferModal}
                            />
                        )}
                    />
                    {/* Non durante un cambio di filtri: hasNextPage si riferirebbe ancora
                        ai dati precedenti mostrati come placeholder. */}
                    {hasNextPage && !loading && (
                        <LoadMore
                            onLoadMore={() => { if (!isFetchingNextPage) fetchNextPage(); }}
                            loading={isFetchingNextPage}
                            label={t('transactions.loadMore', {
                                count: Math.min(TRANSACTIONS_PAGE_SIZE, totalTransactions - processedTransactions.length),
                            })}
                        />
                    )}
                    {processedTransactions.length > 0 && (
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: SPACING.sm, fontSize: FONT_SIZE.sm }}>
                            {t('transactions.shownOfTotal', { shown: processedTransactions.length, total: totalTransactions })}
                        </Text>
                    )}
                </>
            );
        }
        return (
            <>
                {staleWarning}
                <Table
                    columns={columns}
                    dataSource={processedTransactions}
                    rowKey="id"
                    loading={loading}
                    onChange={handleTableChange}
                    size={'small'}
                    tableLayout="fixed"
                    locale={{ emptyText: loading ? ' ' : emptyState }}
                    pagination={{
                        current: currentPage,
                        pageSize: TRANSACTIONS_PAGE_SIZE,
                        total: totalTransactions,
                        placement: ['bottomCenter'],
                        showSizeChanger: false,
                        showTotal: (total) => t('transactions.totalLabel', { total }),
                        onChange: handlePageChange,
                    }}
                />
            </>
        );
    };

    const mobileSecondaryActions: MenuProps['items'] = [
        ...(accountId && currentAccount?.linkedToExternal ? [{
            key: 'sync',
            icon: <RetweetOutlined spin={currentAccount?.synchronizing} />,
            label: currentAccount?.synchronizing ? t('transactions.syncing') : t('transactions.syncBank'),
            disabled: syncingTransactions || currentAccount?.synchronizing,
            onClick: () => setIsBalanceModalOpen(true),
        }] : []),
        {
            key: 'ai',
            icon: <RobotOutlined />,
            label: t('transactions.categorizeWithAi'),
            disabled: aiCategorizationLoading,
            onClick: handleStartAiCategorization,
        },
        { key: 'transfer', icon: <RetweetOutlined />, label: t('transactions.newTransfer'), onClick: handleOpenTransferModal },
        { key: 'import', icon: <UploadOutlined />, label: t('transactions.import.open'), disabled: !accountId, onClick: () => setIsImportModalOpen(true) },
    ];

    return (
        <>
            {contextHolder}
            <PageHeader
                title={pageTitle}
                actions={isMobile ? (
                    // Su mobile i cinque bottoni andavano su tre righe prima di qualsiasi
                    // transazione: resta visibile l'azione principale, le altre nel menu.
                    <Flex gap="small" style={{ width: '100%' }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal} style={{ flex: 1 }}>
                            {t('transactions.newTransaction')}
                        </Button>
                        <Dropdown menu={{ items: mobileSecondaryActions }} trigger={['click']} placement="bottomRight">
                            <Button icon={<MoreOutlined />} aria-label={t('common.actions')} />
                        </Dropdown>
                    </Flex>
                ) : (
                    <Space wrap size="middle">
                        {accountId && currentAccount?.linkedToExternal && (
                            <Button
                                icon={<RetweetOutlined spin={currentAccount?.synchronizing} />}
                                onClick={() => setIsBalanceModalOpen(true)}
                                loading={syncingTransactions || currentAccount?.synchronizing}
                                disabled={currentAccount?.synchronizing}
                                size="large"
                            >
                                {currentAccount?.synchronizing ? t('transactions.syncing') : t('transactions.syncBank')}
                            </Button>
                        )}
                        <Button
                            icon={<RobotOutlined />}
                            onClick={handleStartAiCategorization}
                            loading={aiCategorizationLoading}
                            size="large"
                        >
                            {t('transactions.categorizeWithAi')}
                        </Button>
                        <Button
                            icon={<RetweetOutlined />}
                            onClick={handleOpenTransferModal}
                            size="large"
                        >
                            {t('transactions.newTransfer')}
                        </Button>
                        <Button
                            icon={<UploadOutlined />}
                            onClick={() => setIsImportModalOpen(true)}
                            size="large"
                            disabled={!accountId}
                        >
                            {t('transactions.import.open')}
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenCreateModal}
                            size="large"
                        >
                            {t('transactions.newTransaction')}
                        </Button>
                    </Space>
                )}
            />


            <Flex vertical gap="middle" style={{ marginBottom: SPACING.md }}>
                <Flex gap="small" align="stretch">
                    <Input
                        aria-label={t('transactions.searchPlaceholder')}
                        placeholder={t('transactions.searchPlaceholder')}
                        allowClear
                        size="middle"
                        style={{ flex: 1 }}
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        // Invio cerca subito, senza aspettare il debounce.
                        onPressEnter={() => setSearch(searchInput)}
                        prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-description)' }} />}
                    />
                    {isMobile && (
                        <Badge count={activeFilterCount} size="small" style={{ display: 'flex' }}>
                            <Button
                                icon={<FilterOutlined />}
                                size="middle"
                                style={{ height: '100%' }}
                                aria-label={activeFilterCount > 0
                                    ? `${t('transactions.filters')} (${activeFilterCount})`
                                    : t('transactions.filters')}
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
                            onChange={(value) => setFilter('type', value)}
                            style={{ flex: 1, minWidth: 120 }}
                            allowClear
                        >
                            <Option value="IN">{t('transactions.typeIn')}</Option>
                            <Option value="OUT">{t('transactions.typeOut')}</Option>
                        </Select>
                        <Select
                            placeholder={t('transactions.filterCategory')}
                            value={filters.categoryId}
                            onChange={(value) => setFilter('categoryId', value)}
                            style={{ flex: 1, minWidth: 120 }}
                            allowClear
                        >
                            {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                        </Select>
                        <DatePicker
                            placeholder={t('transactions.fromDate')}
                            value={filters.startDate}
                            style={{ flex: 1, minWidth: 120 }}
                            onChange={(date) => setFilter('startDate', date)}
                           
                        />
                        <DatePicker
                            placeholder={t('transactions.toDate')}
                            value={filters.endDate}
                            style={{ flex: 1, minWidth: 120 }}
                            onChange={(date) => setFilter('endDate', date)}
                           
                        />
                        <Select
                            placeholder={t('transactions.sortBy')}
                            value={sortConfig.field}
                            onChange={(value) => setSort({ ...sortConfig, field: value })}
                            style={{ flex: 1, minWidth: 120 }}
                        >
                            <Option value="date">{t('transactions.data')}</Option>
                            <Option value="description">{t('transactions.description')}</Option>
                            <Option value="amount">{t('transactions.amount')}</Option>
                        </Select>
                        <Select
                            placeholder={t('transactions.sortOrder')}
                            value={sortConfig.order}
                            onChange={(value) => setSort({ ...sortConfig, order: value })}
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
                size="auto"
                open={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                styles={{ body: { paddingBottom: 'env(safe-area-inset-bottom, 16px)' } }}
                footer={
                    <Flex gap="small" justify="space-between">
                        <Button
                            block
                            onClick={() => {
                                setDraftFilters({});
                                setDraftSortConfig(DEFAULT_TRANSACTION_SORT);
                            }}
                        >
                            {t('transactions.clearFilters')}
                        </Button>
                        <Button
                            type="primary"
                            block
                            onClick={() => {
                                applyFiltersAndSort(draftFilters, draftSortConfig);
                                setIsFilterDrawerOpen(false);
                            }}
                        >
                            {t('transactions.applyFilters')}
                        </Button>
                    </Flex>
                }
            >
                <Flex vertical gap="middle">
                    <SafeSelect
                        placeholder={t('transactions.filterType')}
                        value={draftFilters.type}
                        onChange={(value) => setDraftFilters(prev => ({ ...prev, type: value as 'IN' | 'OUT' | undefined }))}
                        style={{ width: '100%' }}
                        allowClear
                    >
                        <Select.Option value="IN">{t('transactions.typeIn')}</Select.Option>
                        <Select.Option value="OUT">{t('transactions.typeOut')}</Select.Option>
                    </SafeSelect>
                    <SafeSelect
                        placeholder={t('transactions.filterCategory')}
                        value={draftFilters.categoryId}
                        onChange={(value) => setDraftFilters(prev => ({ ...prev, categoryId: value as string | undefined }))}
                        style={{ width: '100%' }}
                        allowClear
                    >
                        {categories.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                    </SafeSelect>
                    <SafeDatePicker
                        placeholder={t('transactions.fromDate')}
                        value={draftFilters.startDate}
                        style={{ width: '100%' }}
                        onChange={(date) => setDraftFilters(prev => ({ ...prev, startDate: date }))}
                    />
                    <SafeDatePicker
                        placeholder={t('transactions.toDate')}
                        value={draftFilters.endDate}
                        style={{ width: '100%' }}
                        onChange={(date) => setDraftFilters(prev => ({ ...prev, endDate: date }))}
                    />
                    <SafeSelect
                        placeholder={t('transactions.sortBy')}
                        value={draftSortConfig.field}
                        onChange={(value) => setDraftSortConfig(prev => ({ ...prev, field: (value as TransactionSortField | undefined) ?? DEFAULT_TRANSACTION_SORT.field }))}
                        style={{ width: '100%' }}
                    >
                        <Select.Option value="date">{t('transactions.data')}</Select.Option>
                        <Select.Option value="description">{t('transactions.description')}</Select.Option>
                        <Select.Option value="amount">{t('transactions.amount')}</Select.Option>
                    </SafeSelect>
                    <SafeSelect
                        placeholder={t('transactions.sortOrder')}
                        value={draftSortConfig.order}
                        onChange={(value) => setDraftSortConfig(prev => ({ ...prev, order: (value as TransactionSort['order'] | undefined) ?? DEFAULT_TRANSACTION_SORT.order }))}
                        style={{ width: '100%' }}
                    >
                        <Select.Option value="ascend">{t('transactions.sortAsc')}</Select.Option>
                        <Select.Option value="descend">{t('transactions.sortDesc')}</Select.Option>
                    </SafeSelect>
                </Flex>
            </Drawer>

            {renderContent()}

            <Modal title={editingRecord ? t('transactions.editTransaction') : t('transactions.newTransaction')} open={isModalOpen}
                onCancel={handleCancel} footer={null} destroyOnHidden>
                <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: SPACING.lg }}>
                    <Form.Item name="accountId" label={t('transactions.account')} rules={[{ required: true }]}>
                        <SafeSelect placeholder={t('transactions.selectAccount')} disabled={!!accountId || !!editingRecord}>
                            {accounts.map(acc => <Select.Option key={acc.id} value={acc.id}>{acc.name}</Select.Option>)}
                        </SafeSelect>
                    </Form.Item>
                    <Form.Item name="amount" label={t('transactions.amount')} rules={[{ required: true }]}>
                        <InputNumber<number> style={{ width: '100%' }} min={0} suffix={formSelectedCurrency} parser={commaDecimalParser} />
                    </Form.Item>
                    <Form.Item name="type" label={t('transactions.type')} rules={[{ required: true }]}>
                        <SafeSelect placeholder={t('transactions.selectType')}>
                            <Select.Option value="IN">{t('transactions.typeIn')}</Select.Option>
                            <Select.Option value="OUT">{t('transactions.typeOut')}</Select.Option>
                        </SafeSelect>
                    </Form.Item>
                    <Form.Item name="categoryId" label={t('transactions.category')}>
                        <SafeSelect placeholder={t('transactions.selectCategory')} allowClear>
                            {categories.map(cat => <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>)}
                        </SafeSelect>
                    </Form.Item>
                    <Form.Item name="description" label={t('transactions.description')} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="date" label={t('transactions.data')} initialValue={dayjs()}>
                        <SafeDatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="note" label={t('transactions.note')}>
                        <Input.TextArea />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={saving}>{t('transactions.save')}</Button>

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
                    <Space orientation="vertical" style={{ width: '100%' }}>
                        <Text strong>{t('transactions.linkTransferSource')}</Text>
                        <p>
                            {dayjs(sourceTransaction.date).format('DD/MM/YYYY')} - {sourceTransaction.description} ({sourceTransaction.accountName})
                            -
                            <Text
                                type={sourceTransaction.type === 'IN' ? 'success' : 'danger'}> {formatMoney(sourceTransaction.amount, accountsById.get(sourceTransaction.accountId)?.currency ?? 'EUR')}</Text>
                        </p>

                        <Form layout="vertical">
                            <Form.Item label={t('transactions.linkTransferSelectAccount')}>
                                <SafeSelect
                                    placeholder={t('transactions.selectAccount')}
                                    onChange={(value) => setDestinationAccountId(value as string)}
                                    value={destinationAccountId}
                                >
                                    {accounts
                                        .filter(acc => acc.id !== sourceTransaction.accountId)
                                        .map(acc => <Select.Option key={acc.id} value={acc.id}>{acc.name}</Select.Option>)}
                                </SafeSelect>
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
                                        <ItemList
                                            header={t('transactions.linkTransferSelectTransaction')}
                                            bordered
                                            items={destinationTransactions}
                                            rowKey={item => item.id}
                                            renderItem={item => (
                                                <Radio value={item.id}>
                                                    {dayjs(item.date).format('DD/MM/YYYY')} - {item.description} -
                                                    <Text
                                                        type={item.type === 'IN' ? 'success' : 'danger'}> {formatMoney(item.amount, accountsById.get(destinationAccountId ?? '')?.currency ?? 'EUR')}</Text>
                                                </Radio>
                                            )}
                                        />
                                    </Radio.Group>
                                ) : (
                                    <Alert
                                        title={t('transactions.linkTransferNoCompatible')}
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
                        setPage(1);
                        refreshTransactions();
                        fetchLayoutAccounts(true);
                        invalidateDerivedData();
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
                        onClick={handleSyncBankTransactions}
                    >
                        {t('common.confirm')}
                    </Button>
                ]}
            >
                <Form layout="vertical">
                    <Alert
                        title={t('transactions.balanceCurrent')}
                        description={t('transactions.balanceCurrentInfo')}
                        type="info"
                        showIcon
                        style={{ marginBottom: SPACING.md }}
                    />
                    <Form.Item label={t('transactions.balanceCurrent')}>
                        <InputNumber<number>
                            style={{ width: '100%' }}
                            value={currentBalance}
                            onChange={(value) => setCurrentBalance(value)}
                            placeholder={t('transactions.balanceCurrentPlaceholder')}
                            suffix={getCurrencySymbol(currentAccount?.currency ?? 'EUR')}
                            precision={2}
                            autoFocus
                            parser={commaDecimalParser}
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
                mask={{ closable: false }}
            >
                {aiCategorizationJob ? (
                    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
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
                                    title={t('transactions.categorizeAi.statusCompleted')}
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
                                title={t('transactions.categorizeAi.statusFailed')}
                                description={t('transactions.categorizeAi.errorMessage')}
                            />
                        )}
                    </Space>
                ) : (
                    <Flex justify="center" align="center" style={{ padding: `${SPACING.lg}px 0` }}>
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
                    borderRadius: RADIUS.lg,
                    boxShadow: SHADOW.elevated,
                    padding: `${SPACING.sm}px ${SPACING.md}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}>
                    <Flex justify="space-between" align="center">
                        <Text strong style={{ fontSize: FONT_SIZE.md }}>
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
                    <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
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
                    <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>
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
