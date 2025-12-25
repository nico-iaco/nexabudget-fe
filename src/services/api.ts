// src/services/api.ts
import axios, { type AxiosResponse } from 'axios';
import type {
    Account,
    AccountRequest,
    AuthResponse,
    BinanceKeysRequest,
    Category,
    CategoryRequest,
    CryptoHolding,
    GoCardlessBank,
    GoCardlessBankDetails,
    GoCardlessBankLinkRequest,
    GoCardlessCompleteBankLinkRequest,
    LinkTransferRequest,
    LoginRequest,
    ManualHoldingsRequest,
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
export const getTransactionsBetweenDates = (startDate: string, endDate: string): Promise<AxiosResponse<Transaction[]>> => apiClient.get(`/transactions/daterange?start=${startDate}&end=${endDate}`);
export const createTransaction = (data: TransactionRequest): Promise<AxiosResponse<Transaction>> => apiClient.post('/transactions', data);
export const updateTransaction = (id: string, data: TransactionRequest): Promise<AxiosResponse<Transaction>> => apiClient.put(`/transactions/${id}`, data);
export const createTransfer = (data: TransferRequest): Promise<AxiosResponse<Transaction[]>> => apiClient.post('/transactions/transfer', data);
export const deleteTransaction = (id: string): Promise<AxiosResponse<void>> => apiClient.delete(`/transactions/${id}`);
export const linkTransactionsAsTransfer = (data: LinkTransferRequest): Promise<AxiosResponse<void>> => apiClient.post('/transactions/convert-to-transfer', data);


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