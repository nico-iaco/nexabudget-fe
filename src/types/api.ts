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
    synchronizing: boolean;
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
    exchangeRate?: number;
    originalCurrency?: string;
    originalAmount?: number;
    deleted?: boolean;
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

export interface PortfolioValueResponse {
    totalValue: number;
    currency: string;
    assets: CryptoAsset[]
}

export interface CryptoAsset {
    id: string;
    source: string;
    symbol: string;
    amount: number;
    price: number;
    value: number;
}

export interface UpdateCryptoAsset {
    amount: number;
}

export interface BinanceKeysRequest {
    apiKey: string;
    apiSecret: string;
}

export interface ManualHoldingsRequest {
    symbol: string;
    amount: number;
}

export interface DeletedAccount {
    id: string;
    name: string;
    type: 'CONTO_CORRENTE' | 'RISPARMIO' | 'INVESTIMENTO' | 'CONTANTI';
    currency: string;
    deletedAt: string;
}

export interface Page<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
}

export interface MonthlyTrendItem {
    year: number;
    month: number;
    income: number;
    expense: number;
    net: number;
}

export interface CategoryBreakdownItem {
    categoryId: string;
    categoryName: string;
    total: number;
    percentage: number;
    transactionCount?: number;
}

export interface CategoryBreakdownResponse {
    startDate: string;
    endDate: string;
    type: 'IN' | 'OUT';
    grandTotal: number;
    categories: CategoryBreakdownItem[];
}

export interface MonthlyPeriodStats {
    income: number;
    expense: number;
}

export interface MonthComparisonResponse {
    currentMonth: MonthlyPeriodStats;
    previousMonth: MonthlyPeriodStats;
    incomeChange: number;
    expenseChange: number;
}

export interface MonthlyProjectionResponse {
    year: number;
    month: number;
    currentMonthIncome: number;
    currentMonthExpense: number;
    projectedMonthlyIncome: number;
    projectedMonthlyExpense: number;
    projectedMonthlySavings: number;
    daysElapsed: number;
    daysInMonth: number;
}

export type BudgetRecurrenceType = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface BudgetTemplate {
    id: string;
    categoryId: string;
    categoryName: string;
    budgetLimit: number;
    recurrenceType: BudgetRecurrenceType;
    active: boolean;
    createdAt: string;
}

export interface BudgetTemplateRequest {
    categoryId: string;
    budgetLimit: number;
    recurrenceType: BudgetRecurrenceType;
    active: boolean;
}

export interface BudgetAlert {
    id: string;
    budgetId: string;
    thresholdPercentage: number;
    active: boolean;
    lastNotifiedAt: string | null;
    createdAt: string;
}

export interface BudgetAlertRequest {
    budgetId: string;
    thresholdPercentage: number;
    active: boolean;
}

export type AuditAction =
    | 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'DELETE_TRANSACTION'
    | 'CREATE_TRANSFER'
    | 'CREATE_ACCOUNT' | 'UPDATE_ACCOUNT' | 'DELETE_ACCOUNT'
    | 'CREATE_BUDGET' | 'UPDATE_BUDGET' | 'DELETE_BUDGET'
    | 'CREATE_CATEGORY' | 'UPDATE_CATEGORY' | 'DELETE_CATEGORY';

export type AuditEntityType = 'Transaction' | 'Account' | 'Budget' | 'Category';

export interface AuditLogEntry {
    id: string;
    userId: string;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string;
    newValue: string;
    timestamp: string;
    ipAddress: string;
}

export interface CryptoHolding {
    id: string;
    symbol: string;
    amount: number;
    source: string;
}

export interface AiAnalysisRequest {
    startDate: string;
    endDate: string;
}

export interface AiAnalysisJobResponse {
    jobId: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export interface AiAnalysisStatusResponse {
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    content?: string;
}
