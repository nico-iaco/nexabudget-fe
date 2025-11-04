// src/types/api.ts
export interface AuthResponse {
    token: string;
    userId: number;
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
    id: number;
    name: string;
    type: 'CONTO_CORRENTE' | 'RISPARMIO' | 'INVESTIMENTO' | 'CONTANTI';
    actualBalance: number;
    currency: string;
    createdAt: string;
}

export interface AccountRequest {
    name: string;
    type: 'CONTO_CORRENTE' | 'RISPARMIO' | 'INVESTIMENTO' | 'CONTANTI';
    starterBalance?: number;
    currency: string;
}

export interface Transaction {
    id: number;
    accountId: number;
    accountName: string;
    categoryId?: number;
    categoryName?: string;
    amount: number;
    type: 'IN' | 'OUT';
    description: string;
    date: string;
    note?: string;
    transferId?: string;
}

export interface TransactionRequest {
    accountId: number;
    categoryId?: number;
    importo: number;
    type: 'IN' | 'OUT';
    descrizione: string;
    data?: string;
    note?: string;
}

export interface TransferRequest {
    sourceAccountId: number;
    destinationAccountId: number;
    amount: number;
    description: string;
    transferDate: string;
    notes?: string;
}

export interface LinkTransferRequest {
    sourceTransactionId: number;
    destinationTransactionId: number;
}

export interface Category {
    id: number;
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
    localAccountId: number;
}

export interface GoCardlessBankDetails {
    account_id: string;
    institution: GoCardlessBank;
    name: string;
}

export interface GoCardlessCompleteBankLinkRequest {
    accountId: string;
}
