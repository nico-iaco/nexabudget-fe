// src/types/api.ts
export interface AuthResponse {
    token: string;
    userId: string;
    username: string;
    email?: string;
    defaultCurrency?: string;
}

export interface UpdateUserRequest {
    defaultCurrency?: string;
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
    requiresReauth: boolean;
    /** Provider di aggregazione bancaria collegato; null = conto manuale, mai collegato a un provider esterno. */
    provider?: 'GOCARDLESS' | 'ENABLE_BANKING' | null;
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

export interface ConvertSingleToTransferRequest {
    sourceTransactionId: string;
    targetAccountId: string;
}

export interface Category {
    id: string;
    name: string;
    isDefault: boolean;
}

export interface CategoryRequest {
    name: string;
}

export interface GoCardlessBank {
    id: string;
    name: string;
    bic: string;
    logo: string;
}

export interface GoCardlessBankDetails {
    account_id: string;
    institution: GoCardlessBank;
    name: string;
}

export type GoCardlessLinkedStatus = 'linked' | 'expired' | 'rejected' | 'suspended' | 'pending' | 'unknown';

/**
 * Risposta dell'endpoint legacy GoCardless `/gocardless/bank/{id}/account`.
 * Ancora usata per leggere lo stato del collegamento (linkedStatus/pending/reason),
 * che l'endpoint unificato /api/banking/{provider}/{id}/accounts non espone.
 */
export interface GoCardlessBankAccountsResponse {
    linkedStatus: GoCardlessLinkedStatus;
    requisitionStatus?: string;
    renewable: boolean;
    /** Alias semantico di renewable — usare questo nella UI */
    requiresReauth: boolean;
    /** Valorizzato solo quando linkedStatus === 'pending' */
    link?: string;
    errorCode?: string;
    reason?: string;
    /** Valorizzato solo quando linkedStatus === 'linked' */
    accounts: GoCardlessBankDetails[];
}

export interface SyncBankTransactionsRequest {
    actualBalance: number | null;
}

// --- API unificata multi-provider /api/banking/{provider}/... ---

/** Slug provider usato nel path dell'API unificata. */
export type BankProvider = 'gocardless' | 'enable-banking';

export interface BankInstitutionDto {
    id: string;
    name: string;
    bic: string;
    countries: string[];
    logo: string;
    maxAccessValidForDays: number;
}

export interface BankLinkRequest {
    institutionId: string;
    localAccountId: string;
}

export interface BankLinkResult {
    redirectUrl: string;
    /** Valorizzato solo per GoCardless (requisitionId); null per Enable Banking in questo step. */
    providerReference: string | null;
}

export interface BankSessionRequest {
    code: string;
}

export interface NormalizedBankAccount {
    providerAccountId: string;
    name: string;
    iban: string;
    currency: string;
    institutionName: string;
}

export interface BankLinkCompletionResult {
    providerReference: string;
    accounts: NormalizedBankAccount[];
}

export interface CompleteBankLinkRequest {
    accountId: string;
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

export interface CoinbaseKeysRequest {
    apiKeyName: string;
    privateKey: string;
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
    page: {
        size: number;
        number: number;
        totalElements: number;
        totalPages: number;
    };
}

export interface MonthlyTrendItem {
    year: number;
    month: number;
    income: number;
    expense: number;
    net: number;
}

export interface MonthlyTrendResponse {
    currency: string;
    items: MonthlyTrendItem[];
}

export interface BalanceTrendItem {
    year: number;
    month: number;
    monthlyNet: number;
    closingBalance: number;
}

export interface BalanceTrendResponse {
    startDate: string;
    endDate: string;
    currency: string;
    openingBalance: number;
    items: BalanceTrendItem[];
}

export interface CategoryBreakdownItem {
    categoryId: string | null;
    categoryName: string;
    net: number;
    inferredType: 'IN' | 'OUT';
    percentage: number;
    transactionCount?: number;
}

export interface CategoryBreakdownResponse {
    startDate: string;
    endDate: string;
    currency: string;
    totalIncome: number;
    totalExpense: number;
    grandTotal: number;
    categories: CategoryBreakdownItem[];
}

export interface PeriodTotalsResponse {
    startDate: string;
    endDate: string;
    currency: string;
    income: number;
    expense: number;
    net: number;
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

export interface ApiKeyResponse {
    id: string;
    name: string;
    scopes: string;
    expiresAt?: string;
    lastUsedAt?: string;
    active: boolean;
    createdAt: string;
}

export interface CreateApiKeyRequest {
    name: string;
    scopes?: string;
    expiresAt?: string;
}

export interface CreateApiKeyResponse extends ApiKeyResponse {
    plaintextKey: string;
}

export interface UpdateApiKeyRequest {
    name: string;
    scopes?: string;
    expiresAt?: string;
    active: boolean;
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
    templateId: string;
    thresholdPercentage: number;
    active: boolean;
}

export interface MonthlySummaryResponse {
    budgetId: string;
    categoryId: string;
    categoryName: string;
    limit: number;
    spent: number;
    remaining: number;
    percentageUsed: number;
    budgetStartDate: string;
    budgetEndDate: string;
    periodStart: string;
    periodEnd: string;
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
    userLanguage?: string;
}

/**
 * Risposta di POST /reports/ai-analysis: 202 + PENDING per un job nuovo, 200 + COMPLETED se
 * il report per lo stesso periodo e lingua è già in cache. In quel caso il contenuto è già
 * disponibile: se `content` manca nella risposta, la UI lo legge una volta da GET /{jobId}.
 */
export interface AiAnalysisJobResponse {
    jobId: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    content?: string;
}

export interface AiAnalysisStatusResponse {
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    content?: string;
}

export type ImportTransactionType = 'IN' | 'OUT';

export type ImportFileFormat = 'CSV' | 'OFX';

export interface CsvColumnMapping {
    dateColumn: number;
    amountColumn: number;
    descriptionColumn: number;
    typeColumn?: number | null;
    dateFormat?: string;
    delimiter?: string;
    hasHeader?: boolean;
}

export interface ImportPreviewTransaction {
    date: string;
    amount: number;
    type: ImportTransactionType;
    description: string;
    duplicate: boolean;
    importHash: string;
}

export interface ImportPreviewResponse {
    total: number;
    duplicates: number;
    toImport: number;
    transactions: ImportPreviewTransaction[];
}

export interface ImportConfirmRequest {
    selectedHashes?: string[];
    defaultCategoryId?: string;
}

export interface ImportResultResponse {
    imported: number;
    skipped: number;
    errors: number;
}

export type CategorizationJobStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface CategorizationJobResponse {
    jobId: string;
    status: CategorizationJobStatus;
    total: number;
    processed: number;
    categorized: number;
}

export interface ChatSession {
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
}

export interface ChatMessage {
    id: string;
    role: 'USER' | 'ASSISTANT' | 'TOOL';
    content: string | null;
    createdAt: string;
    toolName: string | null;
}

export interface ChatRequest {
    sessionId: string | null;
    message: string;
}

export interface ChatResponse {
    /**
     * null quando il modello AI non risponde su una chat nuova: il backend non ha salvato
     * nulla (né sessione né messaggi) e `reply` è un testo di ripiego.
     */
    sessionId: string | null;
    reply: string;
    toolsUsed: string[];
}

// ─── Investimenti e patrimonio netto ─────────────────────────────────────────
// Fonte di verità: Swagger del backend (sezione "2b. Investments & Net Worth" di
// docs/API_GUIDE.md). I campi `| null` sono davvero null per il backend (prezzo o cambio
// non disponibile): la UI li mostra come "n/d", mai come 0.

export type InvestmentAssetType = 'ETF' | 'STOCK' | 'BOND' | 'FUND' | 'OTHER';
export type InvestmentPriceSource = 'YAHOO' | 'TWELVE_DATA' | 'MANUAL';
export type CouponFrequency = 'ANNUAL' | 'SEMIANNUAL' | 'QUARTERLY';
export type InvestmentOperationType = 'BUY' | 'SELL' | 'DIVIDEND' | 'COUPON';

export interface InvestmentSearchResult {
    symbol: string;
    name: string;
    exchange: string | null;
    suggestedType: InvestmentAssetType | null;
    /** Provider della ricerca; `OPENFIGI` = risultato non verificato. */
    provider: string;
}

export interface InvestmentAssetRequest {
    assetType: InvestmentAssetType;
    name: string;
    isin?: string | null;
    symbol?: string | null;
    /** Solo in creazione: la valuta non è modificabile. Se assente la ricava il backend dal symbol. */
    currency?: string;
    priceSource?: InvestmentPriceSource;
    /** Solo in creazione. In modifica si usa `updateInvestmentManualPrice`. */
    manualPrice?: number;
    /** % annua, 0–100, solo BOND. */
    couponRate?: number | null;
    couponFrequency?: CouponFrequency | null;
    maturityDate?: string | null;
}

// Campi sempre presenti nel JSON, null quando vuoti (confermato dal backend).
export interface InvestmentAsset {
    id: string;
    assetType: InvestmentAssetType;
    name: string;
    isin: string | null;
    symbol: string | null;
    currency: string;
    priceSource: InvestmentPriceSource;
    /** Con fonte MANUAL è il prezzo usato; con le altre è il prezzo di riserva. */
    manualPrice: number | null;
    manualPriceAt: string | null;
    couponRate: number | null;
    couponFrequency: CouponFrequency | null;
    maturityDate: string | null;
    createdAt: string;
}

export interface InvestmentOperationRequest {
    type: InvestmentOperationType;
    /** yyyy-MM-dd, non nel futuro. */
    operationDate: string;
    /** BUY/SELL. Per i BOND è il valore nominale. */
    quantity?: number;
    /** BUY/SELL. Per i BOND è la quotazione in % del nominale. */
    price?: number;
    fees?: number;
    /** DIVIDEND/COUPON: importo NETTO incassato. */
    amount?: number;
    notes?: string;
}

export interface InvestmentOperation {
    id: string;
    assetId: string;
    assetName: string;
    type: InvestmentOperationType;
    operationDate: string;
    /** null per DIVIDEND/COUPON. */
    quantity: number | null;
    price: number | null;
    /** 0 se non indicate. */
    fees: number;
    /** null per BUY/SELL. */
    amount: number | null;
    notes: string | null;
}

export interface InvestmentPosition {
    assetId: string;
    assetType: InvestmentAssetType;
    name: string;
    isin: string | null;
    symbol: string | null;
    /** Valuta dell'asset. */
    currency: string;
    /** Per i BOND: valore nominale. */
    quantity: number;
    /** Nella valuta dell'asset (per i BOND: % del nominale). */
    avgPrice: number | null;
    costBasis: number | null;
    /** Nella valuta `priceCurrency` (per i BOND: % del nominale). */
    price: number | null;
    priceCurrency: string | null;
    priceSource: InvestmentPriceSource;
    priceAsOf: string | null;
    stale: boolean;
    marketValue: number | null;
    unrealizedPl: number | null;
    unrealizedPlPercent: number | null;
    realizedPl: number | null;
    income: number | null;
    couponRate: number | null;
    couponFrequency: CouponFrequency | null;
    maturityDate: string | null;
}

export interface AllocationSlice {
    key: string;
    value: number | null;
    percent: number | null;
}

export interface InvestmentPortfolio {
    currency: string;
    totalValue: number | null;
    totalCostBasis: number | null;
    unrealizedPl: number | null;
    unrealizedPlPercent: number | null;
    realizedPl: number | null;
    income: number | null;
    /** false = qualche posizione senza prezzo/cambio è esclusa dai totali. */
    complete: boolean;
    positions: InvestmentPosition[];
    allocationByType: AllocationSlice[];
    allocationByCurrency: AllocationSlice[];
}

export interface InvestmentHistoryPoint {
    date: string;
    marketValue: number | null;
    costBasis: number | null;
}

export interface InvestmentHistoryResponse {
    currency: string;
    points: InvestmentHistoryPoint[];
}

export interface InvestmentPerformance {
    startDate: string;
    endDate: string;
    currency: string;
    invested: number | null;
    divested: number | null;
    realizedPl: number | null;
    income: number | null;
    startValue: number | null;
    endValue: number | null;
    totalGain: number | null;
}

export interface NetWorth {
    currency: string;
    total: number | null;
    liquidity: number | null;
    crypto: number | null;
    investments: number | null;
    liquidityPercent: number | null;
    cryptoPercent: number | null;
    investmentsPercent: number | null;
    /** false = il totale è parziale: vedi `warnings`. */
    complete: boolean;
    warnings: string[];
    investmentAccountsBalance: number | null;
    possibleDoubleCounting: boolean;
}

export interface NetWorthHistoryPoint {
    date: string;
    liquidity: number | null;
    /** null prima del primo snapshot (nel `total` contano come 0). */
    crypto: number | null;
    investments: number | null;
    total: number | null;
}

export interface NetWorthHistoryResponse {
    currency: string;
    points: NetWorthHistoryPoint[];
    cryptoIncludedInHistory: boolean;
}
