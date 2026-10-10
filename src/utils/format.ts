// src/utils/format.ts
//
// Formattazione unica per importi, numeri e percentuali. Prima convivevano tre strade:
// `toFixed(2)` (niente separatore delle migliaia: "12345.67 €"), la Statistic di AntD
// (separatori fissi all'americana: "1,100.00 €") e `Intl` con locale variabile — così
// nella stessa pagina comparivano "1,100.00 €", "9000,00 €" e "22.100,00 €".
//
// Il locale segue la lingua dell'app (i18n), non quella del browser. Le funzioni leggono
// `i18n.language` al momento della chiamata: i componenti che le usano ri-renderizzano già
// al cambio lingua perché usano `useTranslation`.
import dayjs, { type ConfigType } from 'dayjs';
import { i18n } from '../i18n';

const localeTag = (): string => (i18n.language === 'en' ? 'en-US' : 'it-IT');

// `useGrouping: 'always'`: in italiano il CLDR non raggruppa i numeri a 4 cifre
// ("1100,00" ma "10.000,00"), e in una colonna di importi l'incoerenza salta all'occhio.
// Il valore stringa è ES2023 (il nostro lib è ES2022), da cui il cast; i browser che non
// lo conoscono lo trattano come `true`.
const GROUP_ALWAYS = 'always' as unknown as boolean;

// Costruire un Intl.NumberFormat è costoso e queste funzioni girano per cella di tabella:
// un formatter per combinazione di opzioni, riusato.
const cache = new Map<string, Intl.NumberFormat>();
const getFormatter = (options: Intl.NumberFormatOptions): Intl.NumberFormat => {
    const locale = localeTag();
    const key = `${locale}|${JSON.stringify(options)}`;
    let formatter = cache.get(key);
    if (!formatter) {
        try {
            formatter = new Intl.NumberFormat(locale, { useGrouping: GROUP_ALWAYS, ...options });
        } catch {
            // Codice valuta non valido: meglio un numero senza simbolo che un crash.
            const { style: _style, currency: _currency, ...rest } = options;
            formatter = new Intl.NumberFormat(locale, { useGrouping: GROUP_ALWAYS, ...rest });
        }
        cache.set(key, formatter);
    }
    return formatter;
};

interface MoneyOptions {
    /** Mostra sempre il segno ("+1.100,00 €"), tranne per lo zero. */
    signed?: boolean;
    /** Cifre decimali (default 2). */
    decimals?: number;
}

/** "1.234,56 €" in italiano, "€1,234.56" in inglese. */
export const formatMoney = (value: number, currency = 'EUR', { signed = false, decimals = 2 }: MoneyOptions = {}): string =>
    getFormatter({
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        ...(signed ? { signDisplay: 'exceptZero' } : {}),
    }).format(value);

/**
 * Prezzo unitario (es. di un token): 2 decimali da 1 in su; sotto l'unità quanti ne
 * servono per circa 4 cifre significative, fino a 8 (la precisione del backend). Così un
 * token da 0,00001234 € non appare come "0,00 €". I totali restano su `formatMoney`.
 */
export const formatUnitPrice = (value: number, currency = 'EUR'): string => {
    const abs = Math.abs(value);
    if (abs === 0 || abs >= 1 || !Number.isFinite(abs)) return formatMoney(value, currency);
    const decimals = Math.min(8, Math.max(2, 3 - Math.floor(Math.log10(abs))));
    return getFormatter({
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals,
    }).format(value);
};

/** Numero con separatori localizzati e fino a `maxDecimals` decimali (es. quantità crypto). */
export const formatNumber = (value: number, maxDecimals = 2, minDecimals = 0): string =>
    getFormatter({ minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals }).format(value);

/** Percentuale da un valore già in centesimi: `formatPercent(28.6)` → "28,6%". */
export const formatPercent = (value: number, decimals = 1, signed = false): string =>
    getFormatter({
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        ...(signed ? { signDisplay: 'exceptZero' } : {}),
    }).format(value / 100);


// Date mostrate all'utente: formato della lingua attiva ("09/10/2026" in italiano,
// "10/09/2026" in inglese) invece di 'DD/MM/YYYY' fisso. dayjs segue già la lingua
// (listener in i18n) e il plugin localizedFormat è registrato in main.tsx.
// Le date verso l'API restano 'YYYY-MM-DD'.

/** Data breve localizzata: "09/10/2026". */
export const formatDate = (value: ConfigType): string => dayjs(value).format('L');

/** Data e ora localizzate: "09/10/2026 14:30" (con `seconds`: "09/10/2026 14:30:05"). */
export const formatDateTime = (value: ConfigType, { seconds = false } = {}): string =>
    dayjs(value).format(seconds ? 'L LTS' : 'L LT');
