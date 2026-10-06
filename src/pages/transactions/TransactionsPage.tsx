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
import { SafeSelect } from '../../components/common/SafeSelect';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, FilterOutlined, PlusOutlined, RetweetOutlined, RobotOutlined, SearchOutlined, SwapOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
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
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePageTitle } from '../../hooks/usePageTitle';
import { TransactionCard } from '../../components/TransactionCard';
import { TransactionImportModal } from '../../components/modals/TransactionImportModal';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { getCurrencySymbol } from '../../utils/currency';
import { FONT_SIZE, RADIUS, SHADOW, SPACING, getSemanticColors } from '../../theme/tokens';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useConfirm } from '../../hooks/useConfirm';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import type { AppOutletContext } from '../../types/outletContext';
import { commaDecimalParser } from '../../utils/number';

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
    const confirm = useConfirm();
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
    const aiPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [apiNotification, contextHolder] = notification.useNotification();

    const currentAccount = useMemo(() => {
        if (!accountId) return null;
        return accountsById.get(accountId) ?? null;
    }, [accountsById, accountId]);

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
            setCurrentPage(1);
            fetchTransactions(1);
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
    // breakdown, budget, saldo). Prima l'unico canale era `transactionRefreshKey`, che è
    // dichiarato in Layout con `useState(0)` e nessun setter: non poteva mai cambiare, e
    // le invalidazioni su `queryKeys.transactions()` non erano lette da nessuna query.
    // Risultato: dopo aver modificato una transazione la dashboard restava su numeri
    // vecchi fino a 2 minuti o al focus della finestra. Qui invalidiamo per prefisso,
    // così coprono sia `['dashboardData', …]` sia le query sotto `['reports', …]`.
    const queryClient = useQueryClient();
    const invalidateDerivedData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
        queryClient.invalidateQueries({ queryKey: ['reports'] });
    }, [queryClient]);

    // Sequenza di richiesta: senza di essa, due fetch concorrenti (tipico della ricerca)
    // possono risolversi fuori ordine e lo stato finisce con la risposta arrivata per
    // ultima, non con quella della query corrente.
    const requestSeqRef = useRef(0);

    const fetchTransactions = (page = currentPage, currentFilters = filters, append = false) => {
        if (!auth) return;
        const seq = ++requestSeqRef.current;
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
                // Risposta di una richiesta già superata: la scartiamo.
                if (seq !== requestSeqRef.current) return;
                if (append) {
                    setTransactions(prev => [...prev, ...response.data.content]);
                } else {
                    setTransactions(response.data.content);
                }
                setTotalTransactions(response.data.page.totalElements);
            })
            .catch(error => {
                if (seq !== requestSeqRef.current) return;
                console.error("Failed to fetch transactions", error);
                message.error(t('transactions.loadError'));
            })
            .finally(() => {
                if (seq === requestSeqRef.current) setLoading(false);
            });
    };

    // Stable ref so useCallback closures always call the latest version
    const fetchTransactionsRef = useRef(fetchTransactions);
    useEffect(() => { fetchTransactionsRef.current = fetchTransactions; });

    // Debounce del testo di ricerca: `filters.search` viene scritto a ogni onChange, e
    // senza questo l'effetto di fetch partiva a ogni tasto premuto (12 richieste per una
    // ricerca di 12 caratteri). Stesso approccio già usato in BalanceTrendSection.
    const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [filters.search]);

    // I filtri effettivamente inviati al backend: identici a `filters` tranne la ricerca,
    // che passa dal valore debounced.
    // Le dipendenze sono i singoli campi, NON l'oggetto `filters`: dato che `search` vive
    // dentro `filters`, dipendere dall'oggetto dava un'identità nuova a ogni battitura e
    // l'effetto di fetch ripartiva comunque, scavalcando il debounce. Verificato con
    // browser headless: 13 richieste per 12 caratteri.
    const { type: filterType, categoryId: filterCategoryId, startDate: filterStartDate, endDate: filterEndDate } = filters;
    const effectiveFilters = useMemo(
        () => ({
            type: filterType,
            categoryId: filterCategoryId,
            startDate: filterStartDate,
            endDate: filterEndDate,
            search: debouncedSearch,
        }),
        [filterType, filterCategoryId, filterStartDate, filterEndDate, debouncedSearch]
    );

    // Un solo effetto di caricamento. Prima erano due, con dipendenze diverse ma corpo
    // identico: entrambi scattavano al mount, quindi ogni ingresso nella pagina faceva
    // due volte la stessa richiesta paginata.
    useEffect(() => {
        setCurrentPage(1);
        fetchTransactionsRef.current(1, effectiveFilters, /* append */ false);
    }, [accountId, auth, transactionRefreshKey, effectiveFilters, sortConfig]);

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
                    fetchTransactionsRef.current();
                    fetchLayoutAccounts();
                    invalidateDerivedData();
                } catch (error) {
                    console.error("Failed to delete transaction", error);
                    message.error(t('transactions.deleteError'));
                }
            }
        });
    }, [t, confirm, fetchLayoutAccounts, invalidateDerivedData]);

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
            invalidateDerivedData();
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
            fetchTransactions();
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
            sorter: (a, b) => a.accountName.localeCompare(b.accountName),
            sortOrder: sortConfig.field === 'accountName' ? sortConfig.order : null,
        },
        {
            title: t('transactions.category'),
            dataIndex: 'categoryName',
            key: 'categoryName',
            width: 150,
            hidden: isCompactTable,
            ellipsis: { showTitle: true },
            sorter: (a, b) => (a.categoryName || '').localeCompare(b.categoryName || ''),
            sortOrder: sortConfig.field === 'categoryName' ? sortConfig.order : null,
        },
        {
            title: t('transactions.amount'),
            dataIndex: 'amount',
            key: 'amount',
            width: 150,
            sorter: (a, b) => {
                const amountA = a.type === 'OUT' ? -a.amount : a.amount;
                const amountB = b.type === 'OUT' ? -b.amount : b.amount;
                return amountA - amountB;
            },
            sortOrder: sortConfig.field === 'amount' ? sortConfig.order : null,
            render: (amount: number, record: Transaction) => {
                const sym = getCurrencySymbol(accountsById.get(record.accountId)?.currency ?? 'EUR');
                return (<span>
                    <span style={{ color: record.type === 'IN' ? semantic.positive : semantic.negative }}>
                        {record.type === 'IN'
                            ? <ArrowUpOutlined aria-hidden="true" />
                            : <ArrowDownOutlined aria-hidden="true" />}
                        {' '}{amount.toFixed(2)} {sym}
                    </span>
                    {record.originalCurrency && record.originalAmount != null && record.exchangeRate != null && (
                        <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, display: 'block' }}>
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
            width: 100,
            responsive: ['xxl'],
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
    ], [t, sortConfig, semantic, accountsById, typeLabel, handleDelete, handleOpenEditModal, handleOpenLinkTransferModal, isCoarsePointer, isCompactTable, accountId]);

    const handleTableChange: TableProps<Transaction>['onChange'] = (_, _tableFilters, sorter) => {
        const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        const nextField = nextSorter.field as string | undefined;
        const nextOrder = nextSorter.order;
        if (nextField === sortConfig.field && nextOrder === sortConfig.order) return;
        setSortConfig({ field: nextField, order: nextOrder });
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
                            style={{ marginBottom: SPACING.sm }}
                        />
                    )}
                    <List
                        loading={loading}
                        dataSource={processedTransactions}
                        locale={{
                            emptyText: (
                                <EmptyState
                                    description={t('transactions.emptyDescription')}
                                    actions={[{ label: t('transactions.newTransaction'), onClick: handleOpenCreateModal }]}
                                />
                            ),
                        }}
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
                        style={{ textAlign: 'center', marginTop: SPACING.md }}
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
                    locale={{ emptyText: <EmptyState description={t('transactions.emptyDescription')} /> }}
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
                locale={{ emptyText: <EmptyState description={t('transactions.emptyDescription')} /> }}
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
                        {accountId && currentAccount?.linkedToExternal && (
                            <Button
                                icon={<RetweetOutlined spin={currentAccount?.synchronizing} />}
                                onClick={() => setIsBalanceModalOpen(true)}
                                loading={syncingTransactions || currentAccount?.synchronizing}
                                disabled={currentAccount?.synchronizing}
                                size={isMobile ? 'middle' : 'large'}
                            >
                                {currentAccount?.synchronizing ? t('transactions.syncing') : t('transactions.syncBank')}
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


            <Flex vertical gap="middle" style={{ marginBottom: SPACING.md }}>
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
                    <SafeSelect
                        placeholder={t('transactions.sortBy')}
                        value={draftSortConfig.field as string}
                        onChange={(value) => setDraftSortConfig(prev => ({ ...prev, field: value as string }))}
                        style={{ width: '100%' }}
                    >
                        <Select.Option value="date">{t('transactions.data')}</Select.Option>
                        <Select.Option value="description">{t('transactions.description')}</Select.Option>
                        <Select.Option value="amount">{t('transactions.amount')}</Select.Option>
                        <Select.Option value="accountName">{t('transactions.account')}</Select.Option>
                        <Select.Option value="categoryName">{t('transactions.category')}</Select.Option>
                    </SafeSelect>
                    <SafeSelect
                        placeholder={t('transactions.sortOrder')}
                        value={draftSortConfig.order}
                        onChange={(value) => setDraftSortConfig(prev => ({ ...prev, order: value as 'ascend' | 'descend' | null | undefined }))}
                        style={{ width: '100%' }}
                    >
                        <Select.Option value="ascend">{t('transactions.sortAsc')}</Select.Option>
                        <Select.Option value="descend">{t('transactions.sortDesc')}</Select.Option>
                    </SafeSelect>
                </Flex>
            </Drawer>

            {renderContent()}

            <Modal title={editingRecord ? t('transactions.editTransaction') : t('transactions.newTransaction')} open={isModalOpen}
                onCancel={handleCancel} footer={null} destroyOnClose>
                <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: SPACING.lg }}>
                    <Form.Item name="accountId" label={t('transactions.account')} rules={[{ required: true }]}>
                        <SafeSelect placeholder={t('transactions.selectAccount')} disabled={!!accountId || !!editingRecord}>
                            {accounts.map(acc => <Select.Option key={acc.id} value={acc.id}>{acc.name}</Select.Option>)}
                        </SafeSelect>
                    </Form.Item>
                    <Form.Item name="amount" label={t('transactions.amount')} rules={[{ required: true }]}>
                        <InputNumber<number> style={{ width: '100%' }} min={0} addonAfter={formSelectedCurrency} parser={commaDecimalParser} />
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
                                type={sourceTransaction.type === 'IN' ? 'success' : 'danger'}> {sourceTransaction.amount.toFixed(2)} {getCurrencySymbol(accountsById.get(sourceTransaction.accountId)?.currency ?? 'EUR')}</Text>
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
                                        <List
                                            header={<div>{t('transactions.linkTransferSelectTransaction')}</div>}
                                            bordered
                                            dataSource={destinationTransactions}
                                            renderItem={item => (
                                                <List.Item>
                                                    <Radio value={item.id}>
                                                        {dayjs(item.date).format('DD/MM/YYYY')} - {item.description} -
                                                        <Text
                                                            type={item.type === 'IN' ? 'success' : 'danger'}> {item.amount.toFixed(2)} {getCurrencySymbol(accountsById.get(destinationAccountId ?? '')?.currency ?? 'EUR')}</Text>
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
                        message={t('transactions.balanceCurrent')}
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
                            addonAfter={getCurrencySymbol(currentAccount?.currency ?? 'EUR')}
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
