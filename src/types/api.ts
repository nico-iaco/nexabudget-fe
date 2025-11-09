// src/types/api.ts
export interface AuthResponse {
    token: string;
    userId: string;
    username: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface UserRequest {
    username?: string;
    email?: string;
    password?: string;
}

export interface Account {
    id: string;
    name: string;
    type: 'CONTO_CORRENTE' | 'RISPARMIO' | 'INVESTIMENTO' | 'CONTANTI';
    actualBalance: number;
    currency: string;
    linkedToExternal: boolean;
    createdAt: string;
}

export interface AccountRequest {
    name: string;
    type: 'CONTO_CORRENTE' | 'RISPARMIO' | 'INVESTIMENTO' | 'CONTANTI';
    starterBalance?: number;
    currency: string;
}

export interface Transaction {
    id: string;
    accountId: string;
    accountName: string;
    categoryId?: string;
    categoryName?: string;
    amount: number;
    type: 'IN' | 'OUT';
    description: string;
    date: string;
    note?: string;
    transferId?: string;
}

export interface TransactionRequest {
    accountId: string;
    categoryId?: string;
    amount: number;
    type: 'IN' | 'OUT';
    description: string;
    date?: string;
    note?: string;
}

export interface TransferRequest {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    description: string;
    transferDate: string;
    notes?: string;
}

export interface LinkTransferRequest {
    sourceTransactionId: string;
    destinationTransactionId: string;
}

export interface Category {
    id: string;
    name: string;
    transactionType: 'IN' | 'OUT';
}

export interface CategoryRequest {
    name: string;
    transactionType: 'IN' | 'OUT';
}

export interface GoCardlessBank {
    id: string;
    name: string;
    bic: string;
    logo: string;
}

export interface GoCardlessBankLinkRequest {
    institutionId: string;
    localAccountId: string;
}

export interface GoCardlessBankDetails {
    account_id: string;
    institution: GoCardlessBank;
    name: string;
}

export interface GoCardlessCompleteBankLinkRequest {
    accountId: string;
}

export interface SyncBankTransactionsRequest {
    actualBalance: number | null;
}
