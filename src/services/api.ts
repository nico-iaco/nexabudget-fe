// src/services/api.ts
import axios, {type AxiosResponse} from 'axios';
import type {
    Account,
    AccountRequest,
    AuthResponse, Category, CategoryRequest, LinkTransferRequest,
    LoginRequest,
    Transaction,
    TransactionRequest,
    TransferRequest,
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

// Auth
export const login = (data: LoginRequest): Promise<AxiosResponse<AuthResponse>> => apiClient.post('/auth/login', data);
export const register = (data: UserRequest): Promise<AxiosResponse<AuthResponse>> => apiClient.post('/auth/register', data);

// Accounts
export const getAccounts = (): Promise<AxiosResponse<Account[]>> => apiClient.get('/accounts/');
export const createAccount = (data: AccountRequest): Promise<AxiosResponse<Account>> => apiClient.post('/accounts', data);
export const updateAccount = (id: number, data: AccountRequest): Promise<AxiosResponse<Account>> => apiClient.put(`/accounts/${id}`, data);
export const deleteAccount = (id: number): Promise<AxiosResponse<void>> => apiClient.delete(`/accounts/${id}`);

// Transactions
export const getTransactionsByUserId = (): Promise<AxiosResponse<Transaction[]>> => apiClient.get(`/transactions`);
export const getTransactionsByAccountId = (accountId: number): Promise<AxiosResponse<Transaction[]>> => apiClient.get(`/transactions/account/${accountId}`);
export const createTransaction = (data: TransactionRequest): Promise<AxiosResponse<Transaction>> => apiClient.post('/transactions', data);
export const updateTransaction = (id: number, data: TransactionRequest): Promise<AxiosResponse<Transaction>> => apiClient.put(`/transactions/${id}`, data);
export const createTransfer = (data: TransferRequest): Promise<AxiosResponse<Transaction[]>> => apiClient.post('/transactions/transfer', data);
export const deleteTransaction = (id: number): Promise<AxiosResponse<void>> => apiClient.delete(`/transactions/${id}`);
export const linkTransactionsAsTransfer = (data: LinkTransferRequest): Promise<AxiosResponse<void>> => apiClient.post('/transactions/convert-to-transfer', data);


// Categories
export const getCategories = (): Promise<AxiosResponse<Category[]>> => apiClient.get('/categories');
export const createCategory = (category: CategoryRequest): Promise<AxiosResponse<void>> => apiClient.post('/categories', category);
export const updateCategory = (id: number, category: CategoryRequest): Promise<AxiosResponse<void>> => apiClient.put(`/categories/${id}`, category);
export const deleteCategory = (id: number): Promise<AxiosResponse<void>> => apiClient.delete(`/categories/${id}`);