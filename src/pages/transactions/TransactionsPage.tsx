// src/pages/transactions/TransactionsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import {
    Alert,
    App,
    Badge,
    Button,
    DatePicker,
    Drawer,
    Dropdown,
    Flex,
    Form,
    Input,
    InputNumber,
    Modal,
    Progress,
    Radio,
    Segmented,
    Select,
    Space,
    Spin,
    Table,
    Tag,
    Tooltip,
    Typography
} from 'antd';
import type { GetRef } from 'antd';
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
import { formatMoney, formatNumber, formatDate } from '../../utils/format';
import { FONT_SIZE, RADIUS, SHADOW, SPACING, aboveBottomNav, getSemanticColors } from '../../theme/tokens';
import { usePreferences } from '../../contexts/PreferencesContext';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { MenuProps } from 'antd';
import type { AppOutletContext } from '../../types/outletContext';
import { commaDecimalParser } from '../../utils/number';
import { invalidateDerivedData as invalidateDerivedQueries, queryKeys } from '../../queryKeys';
import {
    DEFAULT_TRANSACTION_SORT,
    useTransactionFilters,
    type TableFilters,
    type TransactionSort,
    type TransactionSortField,
} from '../../hooks/useTransactionFilters';
import { TRANSACTIONS_PAGE_SIZE, useTransactionsList } from '../../hooks/useTransactionsList';
import { getRangePresets } from '../../utils/datePresets';
import { DatePresetPicker } from '../../components/common/DatePresetPicker';
import { apiErrorText, applyApiFieldErrors, getApiErrorStatus } from '../../utils/apiError';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface FormValues extends Omit<TransactionRequest, 'date'> {
    date?: dayjs.Dayjs | null;
}

const SEARCH_DEBOUNCE_MS = 300;
// Candidati per il collegamento a trasferimento: una finestra di 7 giorni su un singolo
// conto sta largamente entro questo limite.
const TRANSFER_CANDIDATES_PAGE_SIZE = 200;
const AI_POLL_INTERVAL_MS = 10_000;
const AI_POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minuti
// Errori di polling consecutivi tollerati prima di dichiarare fallito il job: un singolo
// errore di rete transitorio non deve far credere che la categorizzazione sia fallita.
const AI_POLL_MAX_CONSECUTIVE_ERRORS = 3;

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
    // Toast e notifiche dal contesto App: rispettano tema e ConfigProvider (il `message`
    // statico di antd usciva chiaro in dark mode).
    const { message, notification: apiNotification } = App.useApp();
    const { accountId } = useParams<{ accountId?: string }>();
    const {
        accounts,
        fetchAccounts: fetchLayoutAccounts,
        categories: rawCategories,
        handleOpenTransferModal,
        onOpenBankLink,
    } = useOutletContext<AppOutletContext>();

    const categories = useMemo(
        () => [...rawCategories].sort((a, b) => a.name.localeCompare(b.name)),
        [rawCategories]
    );
    // Opzioni con `label` per le Select con ricerca (showSearch filtra su optionFilterProp).
    const categoryOptions = useMemo(
        () => categories.map(c => ({ value: c.id, label: c.name })),
        [categories]
    );

    const [saving, setSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const amountInputRef = useRef<GetRef<typeof InputNumber>>(null);
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

    // `?page=N` oltre l'ultima pagina (eliminata l'ultima riga, filtro che restringe i
    // risultati, link condiviso): la Table evidenziava N-1 ma la query restava su N, vuota,
    // e cliccare la pagina evidenziata non faceva nulla. Si riporta l'URL sull'ultima valida.
    useEffect(() => {
        if (isMobile || loading || loadFailed || !hasData) return;
        if (currentPage > 1 && transactions.length === 0) {
            const lastPage = Math.max(1, Math.ceil(totalTransactions / TRANSACTIONS_PAGE_SIZE));
            // Solo se cambia davvero: con conteggio e contenuto del backend in disaccordo
            // (pagina "valida" ma vuota) si riscriverebbe lo stesso URL all'infinito.
            if (lastPage !== currentPage) setPage(lastPage);
        }
    }, [isMobile, loading, loadFailed, hasData, currentPage, transactions.length, totalTransactions, setPage]);

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
    // setSearch cambia identità a ogni cambio di URL: dipendere da lui riavvierebbe il
    // timer anche quando l'utente non sta scrivendo. Il timer però deve chiamare la
    // versione più recente: quella del render in cui è partito scrive l'URL di allora, e
    // un filtro o un ordinamento scelti nei 300 ms di attesa andavano persi.
    const setSearchRef = useRef(setSearch);
    useEffect(() => { setSearchRef.current = setSearch; });
    useEffect(() => {
        if (searchInput === urlSearch) return;
        const id = setTimeout(() => setSearchRef.current(searchInput), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [searchInput, urlSearch]);

    const handleClearFilters = () => {
        setSearchInput('');
        clearFilters();
    };

    // Selezione multipla (solo tabella desktop) per eliminare o ricategorizzare in blocco.
    // Si azzera quando cambia ciò che è a schermo: righe selezionate e non più visibili
    // verrebbero modificate "alla cieca".
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkWorking, setBulkWorking] = useState(false);
    const selectionScope = `${accountId ?? ''}|${JSON.stringify(apiFilters)}|${currentPage}`;
    const [prevSelectionScope, setPrevSelectionScope] = useState(selectionScope);
    if (prevSelectionScope !== selectionScope) {
        setPrevSelectionScope(selectionScope);
        setSelectedIds([]);
    }

    // State for "Convert to Transfer" modal
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [sourceTransaction, setSourceTransaction] = useState<Transaction | null>(null);
    const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
    const [destinationTransactions, setDestinationTransactions] = useState<Transaction[]>([]);
    const [loadingDestTransactions, setLoadingDestTransactions] = useState(false);
    const [selectedDestTransactionId, setSelectedDestTransactionId] = useState<string | null>(null);
    // Richiesta di collegamento/conversione in corso: un doppio clic creava due
    // controparti sul conto di destinazione.
    const [linkingTransfer, setLinkingTransfer] = useState(false);
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
    // Letto dalla callback dell'intervallo, che altrimenti vedrebbe il valore del render
    // in cui il polling è partito.
    const aiBackgroundedRef = useRef(false);
    useEffect(() => { aiBackgroundedRef.current = isAiCategorizationBackgrounded; });


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
        // Un intervallo di date è un filtro solo, anche con entrambi gli estremi.
        if (filters.startDate || filters.endDate) count++;
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
                    title: t('transactions.syncStartedTitle'),
                    description: t('transactions.syncStartedDescription'),
                    placement: 'topRight',
                    duration: 5,
                });

            }, 500);
        } catch (error) {
            console.error('Error during sync:', error);
            setIsBalanceModalOpen(false);
            apiNotification.error({
                title: t('transactions.syncErrorTitle'),
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
            afterTransactionsChange();
        }
        setAiCategorizationJob(null);
    };

    // Chiusura del job, in ogni caso: completato, fallito, errore di polling o timeout.
    // Prima errore e timeout fermavano solo il polling e il job restava IN_PROGRESS per
    // sempre: widget fisso a schermo e impossibile avviarne un altro.
    const finishAiJob = (status: 'COMPLETED' | 'FAILED', job?: CategorizationJobResponse) => {
        stopAiPolling();
        if (!aiBackgroundedRef.current) {
            // Modale aperto: mostra l'esito; la lista si aggiorna alla chiusura
            // (dismissAiCategorization).
            setAiCategorizationJob(prev => job ?? (prev ? { ...prev, status } : prev));
            return;
        }
        if (status === 'COMPLETED') {
            afterTransactionsChange();
            apiNotification.success({
                title: t('transactions.categorizeAi.statusCompleted'),
                description: t('transactions.categorizeAi.recap', { categorized: job?.categorized ?? 0 }),
                placement: 'topRight',
                duration: 5,
            });
        } else {
            apiNotification.error({
                title: t('transactions.categorizeAi.statusFailed'),
                description: t('transactions.categorizeAi.errorMessage'),
                placement: 'topRight',
                duration: 5,
            });
        }
        setIsAiCategorizationBackgrounded(false);
        setAiCategorizationJob(null);
    };

    const startAiPolling = (jobId: string) => {
        stopAiPolling();
        // Tetto di sicurezza: se il backend non chiude mai il job, il polling si ferma
        // comunque invece di proseguire indefinitamente.
        // Allo scadere si chiede un'ultima volta lo stato: il job può essere finito proprio
        // nell'ultimo intervallo (o mentre la tab era in background).
        aiPollTimeoutRef.current = setTimeout(async () => {
            stopAiPolling();
            try {
                const res = await api.getCategorizationJobStatus(jobId);
                finishAiJob(res.data.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED', res.data.status === 'COMPLETED' ? res.data : undefined);
            } catch {
                finishAiJob('FAILED');
            }
        }, AI_POLL_TIMEOUT_MS);
        let consecutiveErrors = 0;
        const interval = setInterval(async () => {
            // Niente richieste mentre la tab è in background.
            if (document.hidden) return;
            try {
                const res = await api.getCategorizationJobStatus(jobId);
                // Polling fermato (o sostituito) mentre la richiesta era in volo: una
                // risposta tardiva IN_PROGRESS riporterebbe in vita un job già chiuso.
                if (aiPollingRef.current !== interval) return;
                consecutiveErrors = 0;
                if (res.data.status === 'COMPLETED' || res.data.status === 'FAILED') {
                    finishAiJob(res.data.status, res.data);
                } else {
                    setAiCategorizationJob(res.data);
                }
            } catch {
                if (aiPollingRef.current !== interval) return;
                consecutiveErrors += 1;
                if (consecutiveErrors >= AI_POLL_MAX_CONSECUTIVE_ERRORS) finishAiJob('FAILED');
            }
        }, AI_POLL_INTERVAL_MS);
        aiPollingRef.current = interval;
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
            const status = getApiErrorStatus(error);
            if (status === 422 || status === 400) {
                message.info(apiErrorText(error, t('transactions.categorizeAi.noUncategorized')));
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
    // breakdown, budget, saldo).
    const queryClient = useQueryClient();
    const invalidateDerivedData = useCallback(() => invalidateDerivedQueries(queryClient), [queryClient]);

    // Ricarica tutte le liste di transazioni in cache (ogni conto, filtro e modalità).
    const refreshTransactions = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
    }, [queryClient]);

    // Dopo una modifica: lista, saldi dei conti e dati derivati.
    const afterTransactionsChange = useCallback(() => {
        refreshTransactions();
        fetchLayoutAccounts();
        invalidateDerivedData();
    }, [refreshTransactions, fetchLayoutAccounts, invalidateDerivedData]);

    // Conti con valute diverse: il backend ora mantiene entrambi gli importi reali quando
    // collega due transazioni, quindi l'importo del candidato non deve coincidere.
    const linkIsMultiCurrency = useMemo(() => {
        if (!sourceTransaction || !destinationAccountId) return false;
        const sourceCurrency = accountsById.get(sourceTransaction.accountId)?.currency;
        const destCurrency = accountsById.get(destinationAccountId)?.currency;
        return !!sourceCurrency && !!destCurrency && sourceCurrency !== destCurrency;
    }, [sourceTransaction, destinationAccountId, accountsById]);

    useEffect(() => {
        if (!destinationAccountId || !sourceTransaction) return;
        // Cambiando conto rapidamente, una risposta lenta del conto precedente non deve
        // sovrascrivere i candidati di quello attuale.
        let cancelled = false;

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
                    // Tipo opposto, stesso importo (solo a parità di valuta) e nella finestra
                    return t.type !== sourceTransaction.type &&
                        (linkIsMultiCurrency || t.amount === sourceTransaction.amount) &&
                        !t.transferId &&
                        tDate.isAfter(startDate) && tDate.isBefore(endDate);
                });
                if (!cancelled) setDestinationTransactions(filtered);
            } catch (error) {
                if (cancelled) return;
                console.error("Failed to fetch destination transactions", error);
                message.error(t('transactions.linkTransferLoadError'));
            } finally {
                if (!cancelled) setLoadingDestTransactions(false);
            }
        };

        fetchDestinationTransactions();
        return () => { cancelled = true; };
    }, [destinationAccountId, sourceTransaction, linkIsMultiCurrency, message, t]);


    // Eliminazione senza conferma preventiva ma con "Annulla": è un soft delete (finisce nel
    // cestino), e un modale di conferma a ogni riga rallentava l'operazione più comune
    // senza proteggere da nulla che l'annullamento non copra già.
    const deleteWithUndo = useCallback(async (ids: string[]) => {
        const results = await Promise.allSettled(ids.map(id => api.deleteTransaction(id)));
        const deleted = ids.filter((_, i) => results[i].status === 'fulfilled');
        if (deleted.length < ids.length) {
            console.error('Failed to delete transactions', results.filter(r => r.status === 'rejected'));
            message.error(t('transactions.deleteError'));
        }
        if (deleted.length === 0) return;
        afterTransactionsChange();
        setSelectedIds(prev => prev.filter(id => !deleted.includes(id)));

        const key = `undo-delete-${deleted[0]}`;
        const undo = async () => {
            apiNotification.destroy(key);
            const restored = await Promise.allSettled(deleted.map(id => api.restoreTransaction(id)));
            afterTransactionsChange();
            const failure = restored.find((r): r is PromiseRejectedResult => r.status === 'rejected');
            if (failure) {
                message.error(apiErrorText(failure.reason, t('trash.restoreError')));
            } else {
                message.success(t('trash.restoreSuccess'));
            }
        };
        apiNotification.success({
            key,
            title: deleted.length === 1
                ? t('trash.movedToTrash')
                : t('transactions.bulk.movedToTrash', { count: deleted.length }),
            description: t('trash.recoverableFor30Days'),
            // In alto: in basso finirebbe sopra la bottom bar su mobile.
            placement: 'top',
            duration: 8,
            actions: <Button size="small" onClick={undo}>{t('common.undo')}</Button>,
        });
    }, [t, message, afterTransactionsChange, apiNotification]);

    const handleDelete = useCallback((id: string) => { void deleteWithUndo([id]); }, [deleteWithUndo]);

    // Solo le righe selezionate ancora a schermo: un refetch (sync, ricategorizzazione con
    // filtro attivo, focus) può togliere dalla vista righe rimaste nella selezione, che
    // altrimenti verrebbero eliminate "alla cieca" e contate nella toolbar.
    const visibleSelectedIds = useMemo(() => {
        const visible = new Set(transactions.map(tx => tx.id));
        return selectedIds.filter(id => visible.has(id));
    }, [transactions, selectedIds]);

    const handleBulkDelete = async () => {
        if (visibleSelectedIds.length === 0) return;
        setBulkWorking(true);
        try {
            await deleteWithUndo(visibleSelectedIds);
        } finally {
            setBulkWorking(false);
        }
    };

    const handleBulkCategorize = async (categoryId: string | undefined) => {
        const targets = transactions.filter(tx => visibleSelectedIds.includes(tx.id));
        if (targets.length === 0) return;
        setBulkWorking(true);
        try {
            const results = await Promise.allSettled(targets.map(tx => api.updateTransaction(tx.id, {
                accountId: tx.accountId,
                categoryId,
                amount: tx.amount,
                type: tx.type,
                description: tx.description,
                date: tx.date,
                note: tx.note,
            })));
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) {
                message.error(t('transactions.bulk.categorizeError', { count: failed }));
            } else {
                message.success(t('transactions.bulk.categorized', { count: targets.length }));
                setSelectedIds([]);
            }
            afterTransactionsChange();
        } finally {
            setBulkWorking(false);
        }
    };

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
            applyApiFieldErrors(form, error);
            message.error(apiErrorText(error, t('transactions.saveError')));
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

        setLinkingTransfer(true);
        try {
            await api.linkTransactionsAsTransfer(request);
            message.success(t('transactions.linkTransferSuccess'));
            handleCancelLinkTransferModal();
            afterTransactionsChange();
        } catch (error) {
            console.error("Failed to link transactions", error);
            message.error(apiErrorText(error, t('transactions.linkTransferError')));
        } finally {
            setLinkingTransfer(false);
        }
    };

    const handleConvertSingleToTransfer = async () => {
        if (!sourceTransaction || !destinationAccountId) return;

        setLinkingTransfer(true);
        try {
            await api.convertSingleToTransfer({
                sourceTransactionId: sourceTransaction.id,
                targetAccountId: destinationAccountId,
            });
            message.success(t('transactions.linkTransferSuccess'));
            handleCancelLinkTransferModal();
            // La conversione crea la gamba sul conto di destinazione: ne cambia il saldo.
            afterTransactionsChange();
        } catch (error) {
            console.error("Failed to convert single transaction to transfer", error);
            message.error(apiErrorText(error, t('transactions.linkTransferError')));
        } finally {
            setLinkingTransfer(false);
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
            render: (text: string) => formatDate(text),
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
                        {formatDate(record.date)}
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
                                // Separatore decimale della lingua ("1,0823", non "1.0823").
                                exchangeRate: formatNumber(record.exchangeRate, 6)
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
                {visibleSelectedIds.length > 0 && (
                    <Flex
                        align="center"
                        gap="small"
                        wrap="wrap"
                        role="toolbar"
                        aria-label={t('transactions.bulk.toolbar')}
                        style={{ marginBottom: SPACING.sm }}
                    >
                        <Text strong>{t('transactions.bulk.selected', { count: visibleSelectedIds.length })}</Text>
                        <Select
                            placeholder={t('transactions.bulk.setCategory')}
                            value={null}
                            onChange={(value: string) => { void handleBulkCategorize(value); }}
                            options={categoryOptions}
                            showSearch={{ optionFilterProp: 'label' }}
                            disabled={bulkWorking}
                            style={{ minWidth: 220 }}
                        />
                        <Button danger icon={<DeleteOutlined />} onClick={handleBulkDelete} loading={bulkWorking}>
                            {t('common.delete')}
                        </Button>
                        <Button type="link" onClick={() => setSelectedIds([])} disabled={bulkWorking}>
                            {t('transactions.bulk.clearSelection')}
                        </Button>
                    </Flex>
                )}
                <Table
                    columns={columns}
                    dataSource={processedTransactions}
                    rowKey="id"
                    rowSelection={{
                        selectedRowKeys: visibleSelectedIds,
                        onChange: (keys) => setSelectedIds(keys.map(String)),
                    }}
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
        {
            key: 'import',
            icon: <UploadOutlined />,
            label: t('transactions.import.open'),
            // Su mobile non c'è hover per un tooltip: la voce resta attiva e spiega il motivo.
            onClick: () => {
                if (accountId) setIsImportModalOpen(true);
                else message.info(t('transactions.import.selectAccountFirst'));
            },
        },
    ];

    return (
        <>
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
                        {/* Disabilitato fuori da un conto: il tooltip spiega perché (lo span
                            serve perché un bottone disabilitato non riceve eventi hover). */}
                        <Tooltip title={accountId ? undefined : t('transactions.import.selectAccountFirst')}>
                            <span>
                                <Button
                                    icon={<UploadOutlined />}
                                    onClick={() => setIsImportModalOpen(true)}
                                    size="large"
                                    disabled={!accountId}
                                >
                                    {t('transactions.import.open')}
                                </Button>
                            </span>
                        </Tooltip>
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

            {/* requiresReauth: consenso scaduto, oppure cambio di provider lasciato a metà
                (il vecchio collegamento è già stato azzerato). In entrambi i casi il sync non
                può funzionare finché il wizard non viene completato. */}
            {currentAccount?.requiresReauth && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: SPACING.md }}
                    title={t('accounts.requiresReauthBanner')}
                    action={
                        <Button size="small" type="primary" onClick={() => onOpenBankLink(currentAccount)}>
                            {t('accounts.renewConnection')}
                        </Button>
                    }
                />
            )}

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
                            options={categoryOptions}
                            showSearch={{ optionFilterProp: 'label' }}
                        />
                        {/* Un solo RangePicker con preset: erano due DatePicker separati,
                            senza scorciatoie e senza vincolo inizio ≤ fine. */}
                        <RangePicker
                            placeholder={[t('transactions.fromDate'), t('transactions.toDate')]}
                            value={[filters.startDate ?? null, filters.endDate ?? null]}
                            allowEmpty={[true, true]}
                            presets={getRangePresets(t)}
                            style={{ flex: 2, minWidth: 240 }}
                            onChange={(dates) => applyFiltersAndSort(
                                { ...filters, startDate: dates?.[0] ?? null, endDate: dates?.[1] ?? null },
                                sortConfig,
                            )}
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
                        options={categoryOptions}
                        showSearch={{ optionFilterProp: 'label' }}
                    />
                    {/* Preset + intervallo personalizzato; i picker impediscono inizio > fine. */}
                    <DatePresetPicker
                        presets={getRangePresets(t)}
                        value={[draftFilters.startDate ?? null, draftFilters.endDate ?? null]}
                        onChange={([start, end]) => setDraftFilters(prev => ({ ...prev, startDate: start, endDate: end }))}
                        customLabel={t('dashboard.presets.custom')}
                        startPlaceholder={t('transactions.fromDate')}
                        endPlaceholder={t('transactions.toDate')}
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
                onCancel={handleCancel} footer={null} destroyOnHidden
                // Nuova transazione: focus sull'importo, il primo dato da inserire. Dopo
                // l'apertura e non con autoFocus, che il focus trap del Modal annullerebbe.
                afterOpenChange={(open) => { if (open && !editingRecord) amountInputRef.current?.focus(); }}>
                <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: SPACING.lg }}>
                    <Form.Item name="accountId" label={t('transactions.account')} rules={[{ required: true }]}>
                        <SafeSelect placeholder={t('transactions.selectAccount')} disabled={!!accountId || !!editingRecord}>
                            {accounts.map(acc => <Select.Option key={acc.id} value={acc.id}>{acc.name}</Select.Option>)}
                        </SafeSelect>
                    </Form.Item>
                    {/* Tipo come segmented con default "Uscita" (il caso più comune), sopra
                        l'importo: era una Select obbligatoria senza default, due tap in più
                        a ogni inserimento. */}
                    <Form.Item name="type" label={t('transactions.type')} rules={[{ required: true }]} initialValue="OUT">
                        <Segmented
                            block
                            options={[
                                { value: 'OUT', label: t('transactions.typeOut'), icon: <ArrowDownOutlined /> },
                                { value: 'IN', label: t('transactions.typeIn'), icon: <ArrowUpOutlined /> },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="amount" label={t('transactions.amount')} rules={[{ required: true }]}>
                        {/* inputMode="decimal": su mobile apre il tastierino numerico invece
                            della tastiera completa. */}
                        <InputNumber<number>
                            ref={amountInputRef}
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                            suffix={formSelectedCurrency}
                            parser={commaDecimalParser}
                            inputMode="decimal"
                        />
                    </Form.Item>
                    <Form.Item name="categoryId" label={t('transactions.category')}>
                        <SafeSelect
                            placeholder={t('transactions.selectCategory')}
                            allowClear
                            options={categoryOptions}
                            showSearch={{ optionFilterProp: 'label' }}
                        />
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
                        disabled={!destinationAccountId || linkingTransfer}>
                        {t('transactions.linkTransferCreate')}
                    </Button>,
                    <Button key="submit" type="primary" onClick={handleConfirmLinkTransfer}
                        disabled={!selectedDestTransactionId} loading={linkingTransfer}>
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
                            {formatDate(sourceTransaction.date)} - {sourceTransaction.description} ({sourceTransaction.accountName})
                            -
                            <Text
                                style={{ color: sourceTransaction.type === 'IN' ? semantic.positive : semantic.negative }}> {formatMoney(sourceTransaction.amount, accountsById.get(sourceTransaction.accountId)?.currency ?? 'EUR')}</Text>
                        </p>

                        <Form layout="vertical">
                            <Form.Item label={t('transactions.linkTransferSelectAccount')}>
                                <SafeSelect
                                    placeholder={t('transactions.selectAccount')}
                                    onChange={(value) => {
                                        // Il candidato scelto appartiene al conto precedente.
                                        setDestinationAccountId(value as string);
                                        setSelectedDestTransactionId(null);
                                        setDestinationTransactions([]);
                                    }}
                                    value={destinationAccountId}
                                >
                                    {accounts
                                        .filter(acc => acc.id !== sourceTransaction.accountId)
                                        .map(acc => <Select.Option key={acc.id} value={acc.id}>{acc.name}</Select.Option>)}
                                </SafeSelect>
                            </Form.Item>
                        </Form>

                        {linkIsMultiCurrency && (
                            <Alert type="info" showIcon title={t('transactions.linkTransferMultiCurrencyHint')} />
                        )}

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
                                                    {formatDate(item.date)} - {item.description} -
                                                    <Text
                                                        style={{ color: item.type === 'IN' ? semantic.positive : semantic.negative }}> {formatMoney(item.amount, accountsById.get(destinationAccountId ?? '')?.currency ?? 'EUR')}</Text>
                                                </Radio>
                                            )}
                                        />
                                    </Radio.Group>
                                ) : (
                                    <Alert
                                        title={linkIsMultiCurrency
                                            ? t('transactions.linkTransferNoCompatibleMultiCurrency')
                                            : t('transactions.linkTransferNoCompatible')}
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
                        loading={syncingTransactions}
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
                    // Su mobile resta sopra la bottom nav invece di coprirla.
                    bottom: isMobile ? aboveBottomNav(SPACING.md) : SPACING.lg,
                    right: isMobile ? SPACING.md : SPACING.lg,
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
