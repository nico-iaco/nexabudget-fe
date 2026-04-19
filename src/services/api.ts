// src/services/api.ts
import axios, { type AxiosResponse } from 'axios';
import type {
    Account,
    AccountRequest,
    AuditEntityType,
    AuditLogEntry,
    AuthResponse,
    BinanceKeysRequest,
    BudgetAlert,
    BudgetAlertRequest,
    BudgetTemplate,
    BudgetTemplateRequest,
    Category,
    CategoryBreakdownResponse,
    CategoryRequest,
    CryptoHolding,
    DeletedAccount,
    GoCardlessBank,
    GoCardlessBankDetails,
    GoCardlessBankLinkRequest,
    GoCardlessCompleteBankLinkRequest,
    LinkTransferRequest,
    LoginRequest,
    ManualHoldingsRequest,
    MonthComparisonResponse,
    MonthlyProjectionResponse,
    MonthlyTrendItem,
    Page,
    PortfolioValueResponse,
    SyncBankTransactionsRequest,
    Transaction,
    TransactionRequest,
    TransferRequest,
    UpdateCryptoAsset,
    UserRequest
} from '../types/api';

const apiClient = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 403 && !(error.request?.responseURL.includes('/auth/login') || error.request?.responseURL.includes('/auth/register'))) {
            // Rimuovi il token e reindirizza al login
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth
export const login = (data: LoginRequest): Promise<AxiosResponse<AuthResponse>> => apiClient.post('/auth/login', data);
export const register = (data: UserRequest): Promise<AxiosResponse<AuthResponse>> => apiClient.post('/auth/register', data);

// Accounts
export const getAccounts = (): Promise<AxiosResponse<Account[]>> => apiClient.get('/accounts/');
export const createAccount = (data: AccountRequest): Promise<AxiosResponse<Account>> => apiClient.post('/accounts', data);
export const updateAccount = (id: string, data: AccountRequest): Promise<AxiosResponse<Account>> => apiClient.put(`/accounts/${id}`, data);
export const deleteAccount = (id: string): Promise<AxiosResponse<void>> => apiClient.delete(`/accounts/${id}`);

// Transactions
export const getTransactionsByUserId = (): Promise<AxiosResponse<Transaction[]>> => apiClient.get(`/transactions`);
export const getTransactionsByAccountId = (accountId: string): Promise<AxiosResponse<Transaction[]>> => apiClient.get(`/transactions/account/${accountId}`);
export interface TransactionFilters {
    type?: 'IN' | 'OUT';
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    sortBy?: 'date' | 'amount' | 'description' | 'type';
    sortDir?: 'ASC' | 'DESC';
}

const buildTransactionParams = (page: number, size: number, filters?: TransactionFilters): string => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    if (filters?.type) p.append('type', filters.type);
    if (filters?.categoryId) p.append('categoryId', filters.categoryId);
    if (filters?.startDate) p.append('startDate', filters.startDate);
    if (filters?.endDate) p.append('endDate', filters.endDate);
    if (filters?.search?.trim()) p.append('search', filters.search.trim());
    if (filters?.sortBy) p.append('sortBy', filters.sortBy);
    if (filters?.sortDir) p.append('sortDir', filters.sortDir);
    return p.toString();
};

export const getTransactionsByAccountIdPaged = (accountId: string, page: number, size: number, filters?: TransactionFilters): Promise<AxiosResponse<Page<Transaction>>> =>
    apiClient.get(`/transactions/account/${accountId}/paged?${buildTransactionParams(page, size, filters)}`);
export const getTransactionsBetweenDates = (startDate: string, endDate: string): Promise<AxiosResponse<Transaction[]>> => apiClient.get(`/transactions/daterange?start=${startDate}&end=${endDate}`);
export const getTransactionsPaged = (page: number, size: number, filters?: TransactionFilters): Promise<AxiosResponse<Page<Transaction>>> =>
    apiClient.get(`/transactions/paged?${buildTransactionParams(page, size, filters)}`);
export const createTransaction = (data: TransactionRequest): Promise<AxiosResponse<Transaction>> => apiClient.post('/transactions', data);
export const updateTransaction = (id: string, data: TransactionRequest): Promise<AxiosResponse<Transaction>> => apiClient.put(`/transactions/${id}`, data);
export const createTransfer = (data: TransferRequest): Promise<AxiosResponse<Transaction[]>> => apiClient.post('/transactions/transfer', data);
export const deleteTransaction = (id: string): Promise<AxiosResponse<void>> => apiClient.delete(`/transactions/${id}`);
export const linkTransactionsAsTransfer = (data: LinkTransferRequest): Promise<AxiosResponse<void>> => apiClient.post('/transactions/convert-to-transfer', data);

// Trash
export const getDeletedTransactions = (): Promise<AxiosResponse<Transaction[]>> => apiClient.get('/trash/transactions');
export const getDeletedAccounts = (): Promise<AxiosResponse<DeletedAccount[]>> => apiClient.get('/trash/accounts');
export const restoreTransaction = (id: string): Promise<AxiosResponse<void>> => apiClient.post(`/trash/transactions/${id}/restore`);
export const restoreAccount = (id: string): Promise<AxiosResponse<void>> => apiClient.post(`/trash/accounts/${id}/restore`);

// Reports
export const getMonthlyTrend = (months = 12): Promise<AxiosResponse<MonthlyTrendItem[]>> => apiClient.get(`/reports/monthly-trend?months=${months}`);
export const getCategoryBreakdown = (type: 'IN' | 'OUT', startDate: string, endDate: string): Promise<AxiosResponse<CategoryBreakdownResponse>> => apiClient.get(`/reports/category-breakdown?type=${type}&startDate=${startDate}&endDate=${endDate}`);
export const getMonthComparison = (year: number, month: number): Promise<AxiosResponse<MonthComparisonResponse>> => apiClient.get(`/reports/month-comparison?year=${year}&month=${month}`);
export const getMonthlyProjection = (): Promise<AxiosResponse<MonthlyProjectionResponse>> => apiClient.get('/reports/monthly-projection');

// Budget Templates
export const getBudgetTemplates = (): Promise<AxiosResponse<BudgetTemplate[]>> => apiClient.get('/budget-templates');
export const getBudgetTemplate = (id: string): Promise<AxiosResponse<BudgetTemplate>> => apiClient.get(`/budget-templates/${id}`);
export const createBudgetTemplate = (data: BudgetTemplateRequest): Promise<AxiosResponse<BudgetTemplate>> => apiClient.post('/budget-templates', data);
export const updateBudgetTemplate = (id: string, data: BudgetTemplateRequest): Promise<AxiosResponse<BudgetTemplate>> => apiClient.put(`/budget-templates/${id}`, data);
export const deleteBudgetTemplate = (id: string): Promise<AxiosResponse<void>> => apiClient.delete(`/budget-templates/${id}`);

// Budget Alerts
export const getBudgetAlerts = (budgetId?: string): Promise<AxiosResponse<BudgetAlert[]>> => apiClient.get(`/budget-alerts${budgetId ? `?budgetId=${budgetId}` : ''}`);
export const createBudgetAlert = (data: BudgetAlertRequest): Promise<AxiosResponse<BudgetAlert>> => apiClient.post('/budget-alerts', data);
export const updateBudgetAlert = (id: string, data: BudgetAlertRequest): Promise<AxiosResponse<BudgetAlert>> => apiClient.put(`/budget-alerts/${id}`, data);
export const deleteBudgetAlert = (id: string): Promise<AxiosResponse<void>> => apiClient.delete(`/budget-alerts/${id}`);

// Audit Log
export const getAuditLog = (page: number, size: number): Promise<AxiosResponse<Page<AuditLogEntry>>> => apiClient.get(`/audit-log?page=${page}&size=${size}`);
export const getAuditLogForEntity = (entityType: AuditEntityType, entityId: string): Promise<AxiosResponse<AuditLogEntry[]>> => apiClient.get(`/audit-log/${entityType}/${entityId}`);


// Categories
export const getCategories = (): Promise<AxiosResponse<Category[]>> => apiClient.get('/categories');
export const createCategory = (category: CategoryRequest): Promise<AxiosResponse<void>> => apiClient.post('/categories', category);
export const updateCategory = (id: string, category: CategoryRequest): Promise<AxiosResponse<void>> => apiClient.put(`/categories/${id}`, category);
export const deleteCategory = (id: string): Promise<AxiosResponse<void>> => apiClient.delete(`/categories/${id}`);

// GoCardless
export const getGoCardlessBankList = (countryCode: string): Promise<AxiosResponse<GoCardlessBank[]>> => apiClient.get(`/gocardless/bank?countryCode=${countryCode}`);
export const getGoCardlessBankLink = (data: GoCardlessBankLinkRequest): Promise<AxiosResponse<string>> => apiClient.post(`/gocardless/bank/link`, data);
export const getGoCardlessBankAccounts = (localAccountId: string): Promise<AxiosResponse<GoCardlessBankDetails[]>> => apiClient.get(`/gocardless/bank/${localAccountId}/account`);
export const linkGoCardlessBankAccount = (localAccountId: string, data: GoCardlessCompleteBankLinkRequest): Promise<AxiosResponse<void>> => apiClient.post(`/gocardless/bank/${localAccountId}/link`, data);
export const syncGoCardlessBankAccount = (localAccountId: string, data: SyncBankTransactionsRequest): Promise<AxiosResponse<void>> => apiClient.post(`/gocardless/bank/${localAccountId}/sync`, data);

// Crypto
export const getPortfolioValue = (currency: string): Promise<AxiosResponse<PortfolioValueResponse>> => apiClient.get('/crypto/portfolio?currency=' + currency);
export const addManualHolding = (data: ManualHoldingsRequest): Promise<AxiosResponse<CryptoHolding>> => apiClient.post('/crypto/holdings', data);
export const updateManualHolding = (id: string, data: UpdateCryptoAsset): Promise<AxiosResponse<CryptoHolding>> => apiClient.patch(`/crypto/holdings/${id}`, data);
export const deleteManualHolding = (id: string): Promise<AxiosResponse<void>> => apiClient.delete(`/crypto/holdings/${id}`);
export const saveBinanceKeys = (data: BinanceKeysRequest): Promise<AxiosResponse<void>> => apiClient.post('/crypto/binance/keys', data);
export const syncFromBinance = (): Promise<AxiosResponse<void>> => apiClient.post('/crypto/binance/sync');