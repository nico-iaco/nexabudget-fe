// src/utils/investments.ts
//
// Funzioni pure di supporto a investimenti e patrimonio netto: formattazione null-safe,
// mapping form → request, raggruppamenti. Nessun calcolo finanziario: prezzo medio, P/L e
// valori arrivano già calcolati dal backend e qui si mostrano soltanto.
import dayjs from 'dayjs';
import type {
    AllocationSlice,
    InvestmentAssetRequest,
    InvestmentAssetType,
    InvestmentOperationRequest,
    InvestmentOperationType,
    InvestmentPosition,
    InvestmentPriceSource,
    NetWorth,
} from '../types/api';
import { formatMoney, formatNumber, formatUnitPrice, notAvailable } from './format';

export const ASSET_TYPES: InvestmentAssetType[] = ['ETF', 'STOCK', 'BOND', 'FUND', 'OTHER'];
export const PRICE_SOURCES: InvestmentPriceSource[] = ['YAHOO', 'TWELVE_DATA', 'MANUAL'];
export const OPERATION_TYPES: InvestmentOperationType[] = ['BUY', 'SELL', 'DIVIDEND', 'COUPON'];

/** Obbligazione: quantità = valore nominale, prezzo = quotazione in % del nominale. */
export const isBond = (assetType: InvestmentAssetType | undefined | null): boolean => assetType === 'BOND';

/**
 * Tipi di operazione proposti per un asset: il backend li accetta tutti su qualunque asset
 * (contano uguale nei totali), ma COUPON ha senso per le obbligazioni e DIVIDEND per gli
 * altri. `current` (modifica di un'operazione esistente) resta sempre selezionabile.
 */
export const operationTypesFor = (
    assetType: InvestmentAssetType | undefined | null,
    current?: InvestmentOperationType | null,
): InvestmentOperationType[] =>
    OPERATION_TYPES.filter(o =>
        o === current || (o === 'COUPON' ? isBond(assetType) : o === 'DIVIDEND' ? !isBond(assetType) : true));

/** Il simbolo serve per i prezzi automatici (Yahoo, Twelve Data), non per quelli manuali. */
export const symbolRequired = (priceSource: InvestmentPriceSource | undefined | null): boolean =>
    priceSource !== undefined && priceSource !== null && priceSource !== 'MANUAL';

/** Valute proposte quando il backend non riesce a ricavarla dal ticker. */
export const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK'] as const;

/** 400 del backend sulla creazione: "Impossibile determinare la valuta dello strumento…". */
export const isCurrencyUndeterminedError = (status: number | undefined, message: string | undefined): boolean =>
    status === 400 && /valuta|currency/i.test(message ?? '');

/** BUY/SELL hanno quantità, prezzo e commissioni; DIVIDEND/COUPON solo l'importo netto. */
export const isTradeOperation = (type: InvestmentOperationType | undefined | null): boolean =>
    type === 'BUY' || type === 'SELL';

// ─── Posizioni ───────────────────────────────────────────────────────────────

/** Una posizione con quantità 0 è chiusa: resta solo il P/L realizzato. */
export const isClosedPosition = (position: Pick<InvestmentPosition, 'quantity'>): boolean =>
    !(position.quantity > 0);

export const splitPositions = (positions: InvestmentPosition[] | null | undefined) => {
    const open: InvestmentPosition[] = [];
    const closed: InvestmentPosition[] = [];
    for (const p of positions ?? []) (isClosedPosition(p) ? closed : open).push(p);
    return { open, closed };
};

/** Mostra il badge "Prezzo non aggiornato" solo se il backend lo dice esplicitamente. */
export const isStalePosition = (position: Pick<InvestmentPosition, 'stale'>): boolean => position.stale === true;

/**
 * Prezzo di un asset: per le obbligazioni è una percentuale del nominale ("98,50%"), per
 * gli altri una valuta nella valuta del prezzo. Null → "n/d", mai 0.
 */
export const formatAssetPrice = (
    price: number | null | undefined,
    assetType: InvestmentAssetType,
    currency: string | null | undefined,
): string => {
    if (price === null || price === undefined || !Number.isFinite(price)) return notAvailable();
    if (isBond(assetType)) return `${formatNumber(price, 2, 2)}%`;
    return formatUnitPrice(price, currency || 'EUR');
};

/** Quantità: per le obbligazioni il valore nominale (in valuta), altrimenti un numero. */
export const formatAssetQuantity = (
    quantity: number | null | undefined,
    assetType: InvestmentAssetType,
    currency: string,
): string => {
    if (quantity === null || quantity === undefined || !Number.isFinite(quantity)) return notAvailable();
    return isBond(assetType) ? formatMoney(quantity, currency) : formatNumber(quantity, 6);
};

/** Verde per un P/L positivo, rosso per uno negativo; nessun colore per null e zero. */
export const plColor = (
    value: number | null | undefined,
    semantic: { positive: string; negative: string },
): string | undefined => {
    if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return undefined;
    return value > 0 ? semantic.positive : semantic.negative;
};

// ─── Storici ─────────────────────────────────────────────────────────────────

/**
 * Data del primo punto in cui `key` ha un valore (gli snapshot partono dal giorno in cui la
 * funzione è attiva, senza backfill: prima è null e non va letto come zero). Null se non ce
 * ne sono.
 */
export const firstAvailableDate = <T extends { date: string }>(
    points: readonly T[] | null | undefined,
    key: keyof T,
): string | null => {
    const first = (points ?? []).find(p => p[key] !== null && p[key] !== undefined);
    return first ? first.date : null;
};

/** True se la serie ha dei null all'inizio ma non è null dappertutto (storico parziale). */
export const hasLeadingGap = <T extends { date: string }>(
    points: readonly T[] | null | undefined,
    key: keyof T,
): boolean => {
    const list = points ?? [];
    const first = list.findIndex(p => p[key] !== null && p[key] !== undefined);
    return first > 0;
};

// ─── Allocazione e patrimonio netto ──────────────────────────────────────────

export interface BarSegment {
    key: string;
    value: number;
    /** Quota 0–1 della barra, normalizzata sui soli valori positivi. */
    share: number;
}

/**
 * Segmenti di una barra impilata. Valori null o negativi non si disegnano (una quota
 * negativa non ha una larghezza): restano nella legenda con il loro valore reale.
 */
export const buildBarSegments = (
    slices: readonly { key: string; value: number | null }[] | null | undefined,
): BarSegment[] => {
    const positive = (slices ?? []).filter(
        (s): s is { key: string; value: number } => s.value !== null && Number.isFinite(s.value) && s.value > 0,
    );
    const sum = positive.reduce((acc, s) => acc + s.value, 0);
    if (sum <= 0) return [];
    return positive.map(s => ({ key: s.key, value: s.value, share: s.value / sum }));
};

export type NetWorthComponentKey = 'liquidity' | 'crypto' | 'investments';

export interface NetWorthComponent extends AllocationSlice {
    key: NetWorthComponentKey;
}

/** Le tre componenti del patrimonio con valore e percentuale (entrambi anche null). */
export const netWorthComponents = (nw: NetWorth): NetWorthComponent[] => [
    { key: 'liquidity', value: nw.liquidity, percent: nw.liquidityPercent },
    { key: 'crypto', value: nw.crypto, percent: nw.cryptoPercent },
    { key: 'investments', value: nw.investments, percent: nw.investmentsPercent },
];

// ─── Ricerca asset ───────────────────────────────────────────────────────────

export const SEARCH_MIN_LENGTH = 2;

export const normalizeSearchQuery = (q: string): string => q.trim();

export const canSearch = (q: string): boolean => normalizeSearchQuery(q).length >= SEARCH_MIN_LENGTH;

/** Formato ISIN: 2 lettere, 9 alfanumerici, 1 cifra di controllo. */
export const looksLikeIsin = (q: string): boolean => /^[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]$/.test(q.trim());

/** I risultati OpenFIGI non sono verificati: si mostra un avviso e si lascia scegliere. */
export const isUnverifiedProvider = (provider: string | null | undefined): boolean =>
    (provider ?? '').toUpperCase() === 'OPENFIGI';

/** Fonte prezzo di default del backend: Yahoo se c'è un ticker, altrimenti manuale. */
export const defaultPriceSource = (symbol: string | null | undefined): InvestmentPriceSource =>
    symbol && symbol.trim() ? 'YAHOO' : 'MANUAL';

// ─── Mapping form → request ──────────────────────────────────────────────────

const blankToUndefined = (value: string | null | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
};

export interface AssetFormValues {
    assetType: InvestmentAssetType;
    name: string;
    isin?: string | null;
    symbol?: string | null;
    currency?: string | null;
    priceSource?: InvestmentPriceSource;
    manualPrice?: number | null;
    couponRate?: number | null;
    couponFrequency?: InvestmentAssetRequest['couponFrequency'];
    /** yyyy-MM-dd */
    maturityDate?: string | null;
}

/**
 * Body di POST/PUT /investments/assets.
 *  - creazione: `currency` solo se compilata (senza, con un symbol la ricava il backend);
 *    `manualPrice` solo con fonte MANUAL;
 *  - modifica: la valuta non è modificabile e il prezzo manuale ha un endpoint a parte;
 *    `isin` e `symbol` si mandano sempre (null se vuoti), perché il PUT li richiede;
 *  - campi cedola/scadenza solo per i BOND.
 */
export const buildAssetRequest = (values: AssetFormValues, mode: 'create' | 'edit'): InvestmentAssetRequest => {
    const symbol = blankToUndefined(values.symbol);
    const isin = blankToUndefined(values.isin)?.toUpperCase();
    const priceSource = values.priceSource ?? defaultPriceSource(symbol);

    const request: InvestmentAssetRequest = {
        assetType: values.assetType,
        name: values.name.trim(),
        priceSource,
    };

    if (mode === 'edit') {
        request.isin = isin ?? null;
        request.symbol = symbol ?? null;
    } else {
        if (isin) request.isin = isin;
        if (symbol) request.symbol = symbol;
        const currency = blankToUndefined(values.currency)?.toUpperCase();
        if (currency) request.currency = currency;
        if (priceSource === 'MANUAL' && values.manualPrice != null) request.manualPrice = values.manualPrice;
    }

    if (isBond(values.assetType)) {
        if (values.couponRate != null) request.couponRate = values.couponRate;
        if (values.couponFrequency) request.couponFrequency = values.couponFrequency;
        if (values.maturityDate) request.maturityDate = values.maturityDate;
    }
    return request;
};

export interface OperationFormValues {
    type: InvestmentOperationType;
    /** yyyy-MM-dd */
    operationDate: string;
    quantity?: number | null;
    price?: number | null;
    fees?: number | null;
    amount?: number | null;
    notes?: string | null;
}

/**
 * Body di POST/PUT di un'operazione: BUY/SELL mandano quantità, prezzo e commissioni;
 * DIVIDEND/COUPON solo l'importo netto. I campi dell'altro gruppo (rimasti nel form dopo
 * un cambio di tipo) non vengono inviati.
 */
export const buildOperationRequest = (values: OperationFormValues): InvestmentOperationRequest => {
    const request: InvestmentOperationRequest = {
        type: values.type,
        operationDate: values.operationDate,
    };
    if (isTradeOperation(values.type)) {
        if (values.quantity != null) request.quantity = values.quantity;
        if (values.price != null) request.price = values.price;
        if (values.fees != null) request.fees = values.fees;
    } else if (values.amount != null) {
        request.amount = values.amount;
    }
    const notes = blankToUndefined(values.notes);
    if (notes) request.notes = notes;
    return request;
};

// ─── Periodo ─────────────────────────────────────────────────────────────────

export const PERIOD_MONTHS = [6, 12, 24] as const;
export type PeriodMonths = (typeof PERIOD_MONTHS)[number];

/** Intervallo [oggi − n mesi, oggi] in 'YYYY-MM-DD': la fine non è mai nel futuro. */
export const periodRange = (months: number, today = dayjs()): { startDate: string; endDate: string } => ({
    startDate: today.subtract(months, 'month').format('YYYY-MM-DD'),
    endDate: today.format('YYYY-MM-DD'),
});
