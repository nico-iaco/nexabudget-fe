import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { i18n } from '../i18n';
import type { InvestmentPosition, NetWorth } from '../types/api';
import {
    buildAssetRequest,
    buildBarSegments,
    buildOperationRequest,
    canSearch,
    defaultPriceSource,
    firstAvailableDate,
    formatAssetPrice,
    formatAssetQuantity,
    hasLeadingGap,
    isCurrencyUndeterminedError,
    isStalePosition,
    isUnverifiedProvider,
    looksLikeIsin,
    netWorthComponents,
    operationTypesFor,
    periodRange,
    plColor,
    splitPositions,
    symbolRequired,
} from './investments';

await i18n.changeLanguage('it');

const nbsp = (s: string) => s.replace(/\u00a0/g, ' ');

const position = (over: Partial<InvestmentPosition> = {}): InvestmentPosition => ({
    assetId: 'a1', assetType: 'ETF', name: 'VWCE', isin: null, symbol: 'VWCE.DE', currency: 'EUR',
    quantity: 10, avgPrice: 100, costBasis: 1000, price: 110, priceCurrency: 'EUR', priceSource: 'YAHOO',
    priceAsOf: null, stale: false, marketValue: 1100, unrealizedPl: 100, unrealizedPlPercent: 10,
    realizedPl: 0, income: 0, couponRate: null, couponFrequency: null, maturityDate: null,
    ...over,
});

describe('splitPositions', () => {
    it('separa le posizioni chiuse (quantità 0) dalle aperte', () => {
        const { open, closed } = splitPositions([
            position({ assetId: 'open' }),
            position({ assetId: 'closed', quantity: 0, marketValue: null }),
        ]);
        expect(open.map(p => p.assetId)).toEqual(['open']);
        expect(closed.map(p => p.assetId)).toEqual(['closed']);
    });

    it('accetta null/undefined', () => {
        expect(splitPositions(null)).toEqual({ open: [], closed: [] });
        expect(splitPositions(undefined)).toEqual({ open: [], closed: [] });
    });
});

describe('formatAssetPrice', () => {
    it('null → "n/d", mai 0', () => {
        expect(formatAssetPrice(null, 'ETF', 'EUR')).toBe('n/d');
        expect(formatAssetPrice(undefined, 'BOND', 'EUR')).toBe('n/d');
    });

    it('per le obbligazioni è una percentuale del nominale, non una valuta', () => {
        const text = nbsp(formatAssetPrice(98.5, 'BOND', 'EUR'));
        expect(text).toBe('98,50%');
        expect(text).not.toContain('€');
    });

    it('per gli altri asset è una valuta (quella del prezzo)', () => {
        expect(nbsp(formatAssetPrice(1234.5, 'ETF', 'EUR'))).toBe('1.234,50 €');
        expect(formatAssetPrice(10, 'STOCK', 'USD')).toContain('USD');
    });
});

describe('formatAssetQuantity', () => {
    it('per le obbligazioni è il valore nominale in valuta', () => {
        expect(nbsp(formatAssetQuantity(10000, 'BOND', 'EUR'))).toBe('10.000,00 €');
    });

    it('per gli altri asset è un numero', () => {
        expect(formatAssetQuantity(12.5, 'ETF', 'EUR')).toBe('12,5');
    });

    it('null → "n/d"', () => {
        expect(formatAssetQuantity(null, 'ETF', 'EUR')).toBe('n/d');
    });
});

describe('isStalePosition', () => {
    it('è true solo se il backend lo dice esplicitamente', () => {
        expect(isStalePosition({ stale: true })).toBe(true);
        expect(isStalePosition({ stale: false })).toBe(false);
        expect(isStalePosition({} as { stale: boolean })).toBe(false);
    });
});

describe('plColor', () => {
    const semantic = { positive: 'green', negative: 'red' };
    it('verde se positivo, rosso se negativo', () => {
        expect(plColor(5, semantic)).toBe('green');
        expect(plColor(-5, semantic)).toBe('red');
    });
    it('nessun colore per zero e null', () => {
        expect(plColor(0, semantic)).toBeUndefined();
        expect(plColor(null, semantic)).toBeUndefined();
        expect(plColor(undefined, semantic)).toBeUndefined();
    });
});

describe('storici senza backfill', () => {
    const points = [
        { date: '2026-09-01', crypto: null, investments: null, total: 1000 },
        { date: '2026-09-02', crypto: null, investments: 500, total: 1500 },
        { date: '2026-09-03', crypto: 20, investments: 510, total: 1530 },
    ];

    it('firstAvailableDate restituisce il primo punto non null', () => {
        expect(firstAvailableDate(points, 'investments')).toBe('2026-09-02');
        expect(firstAvailableDate(points, 'crypto')).toBe('2026-09-03');
        expect(firstAvailableDate(points, 'total')).toBe('2026-09-01');
    });

    it('firstAvailableDate è null se la serie è sempre null o la lista è vuota', () => {
        expect(firstAvailableDate([{ date: '2026-09-01', crypto: null }], 'crypto')).toBeNull();
        expect(firstAvailableDate([], 'crypto' as never)).toBeNull();
        expect(firstAvailableDate(undefined, 'crypto' as never)).toBeNull();
    });

    it('hasLeadingGap distingue "storico parziale" da "completo" e da "assente"', () => {
        expect(hasLeadingGap(points, 'investments')).toBe(true);
        expect(hasLeadingGap(points, 'total')).toBe(false);
        expect(hasLeadingGap([{ date: '2026-09-01', crypto: null }], 'crypto')).toBe(false);
    });
});

describe('buildBarSegments', () => {
    it('normalizza sui soli valori positivi', () => {
        const segs = buildBarSegments([
            { key: 'a', value: 300 }, { key: 'b', value: 100 },
        ]);
        expect(segs.map(s => s.share)).toEqual([0.75, 0.25]);
    });

    it('scarta null e negativi (restano solo in legenda)', () => {
        const segs = buildBarSegments([
            { key: 'liquidity', value: -200 }, { key: 'crypto', value: null }, { key: 'investments', value: 100 },
        ]);
        expect(segs).toEqual([{ key: 'investments', value: 100, share: 1 }]);
    });

    it('nessun valore positivo → nessun segmento', () => {
        expect(buildBarSegments([{ key: 'a', value: null }, { key: 'b', value: 0 }])).toEqual([]);
        expect(buildBarSegments(undefined)).toEqual([]);
    });
});

describe('netWorthComponents', () => {
    it('conserva valori e percentuali null o negativi', () => {
        const nw = {
            liquidity: -50, liquidityPercent: -5, crypto: null, cryptoPercent: null,
            investments: 1050, investmentsPercent: 105,
        } as NetWorth;
        expect(netWorthComponents(nw)).toEqual([
            { key: 'liquidity', value: -50, percent: -5 },
            { key: 'crypto', value: null, percent: null },
            { key: 'investments', value: 1050, percent: 105 },
        ]);
    });
});

describe('ricerca asset', () => {
    it('lunghezza minima, con trim', () => {
        expect(canSearch('')).toBe(false);
        expect(canSearch(' a ')).toBe(false);
        expect(canSearch('vw')).toBe(true);
    });

    it('riconosce un ISIN', () => {
        expect(looksLikeIsin('IE00BK5BQT80')).toBe(true);
        expect(looksLikeIsin(' ie00bk5bqt80 ')).toBe(true);
        expect(looksLikeIsin('VWCE')).toBe(false);
        expect(looksLikeIsin('IE00BK5BQT8')).toBe(false);
    });

    it('i risultati OpenFIGI non sono verificati', () => {
        expect(isUnverifiedProvider('OPENFIGI')).toBe(true);
        expect(isUnverifiedProvider('openfigi')).toBe(true);
        expect(isUnverifiedProvider('YAHOO')).toBe(false);
        expect(isUnverifiedProvider(null)).toBe(false);
    });
});

describe('defaultPriceSource', () => {
    it('Yahoo con un ticker, manuale senza', () => {
        expect(defaultPriceSource('VWCE.DE')).toBe('YAHOO');
        expect(defaultPriceSource('')).toBe('MANUAL');
        expect(defaultPriceSource('   ')).toBe('MANUAL');
        expect(defaultPriceSource(undefined)).toBe('MANUAL');
    });
});

describe('buildAssetRequest', () => {
    it('creazione ETF da ricerca: ticker, niente valuta (la ricava il backend)', () => {
        expect(buildAssetRequest({
            assetType: 'ETF', name: '  Vanguard FTSE All-World ', symbol: 'VWCE.DE', currency: '',
            isin: 'ie00bk5bqt80', priceSource: 'YAHOO',
        }, 'create')).toEqual({
            assetType: 'ETF', name: 'Vanguard FTSE All-World', priceSource: 'YAHOO',
            symbol: 'VWCE.DE', isin: 'IE00BK5BQT80',
        });
    });

    it('creazione BTP manuale: valuta, prezzo manuale e campi cedola', () => {
        expect(buildAssetRequest({
            assetType: 'BOND', name: 'BTP 2030', currency: 'eur', priceSource: 'MANUAL', manualPrice: 98.5,
            couponRate: 3.5, couponFrequency: 'SEMIANNUAL', maturityDate: '2030-03-01',
        }, 'create')).toEqual({
            assetType: 'BOND', name: 'BTP 2030', priceSource: 'MANUAL', currency: 'EUR', manualPrice: 98.5,
            couponRate: 3.5, couponFrequency: 'SEMIANNUAL', maturityDate: '2030-03-01',
        });
    });

    it('i campi cedola non partono per i non-BOND', () => {
        const req = buildAssetRequest({
            assetType: 'ETF', name: 'X', symbol: 'X.DE', couponRate: 3, couponFrequency: 'ANNUAL', maturityDate: '2030-01-01',
        }, 'create');
        expect(req).not.toHaveProperty('couponRate');
        expect(req).not.toHaveProperty('couponFrequency');
        expect(req).not.toHaveProperty('maturityDate');
    });

    it('il prezzo manuale parte solo con fonte MANUAL', () => {
        expect(buildAssetRequest({ assetType: 'ETF', name: 'X', symbol: 'X.DE', priceSource: 'YAHOO', manualPrice: 10 }, 'create'))
            .not.toHaveProperty('manualPrice');
    });

    it('senza fonte esplicita usa il default (Yahoo con ticker, altrimenti manuale)', () => {
        expect(buildAssetRequest({ assetType: 'ETF', name: 'X', symbol: 'X.DE' }, 'create').priceSource).toBe('YAHOO');
        expect(buildAssetRequest({ assetType: 'OTHER', name: 'X', currency: 'EUR' }, 'create').priceSource).toBe('MANUAL');
    });

    it('modifica: niente valuta né prezzo manuale, isin e symbol sempre presenti (null se vuoti)', () => {
        const req = buildAssetRequest({
            assetType: 'BOND', name: 'BTP', currency: 'EUR', priceSource: 'MANUAL', manualPrice: 90, isin: '', symbol: '',
        }, 'edit');
        expect(req).toEqual({ assetType: 'BOND', name: 'BTP', priceSource: 'MANUAL', isin: null, symbol: null });
        expect(req).not.toHaveProperty('currency');
        expect(req).not.toHaveProperty('manualPrice');
    });
});

describe('buildOperationRequest', () => {
    it('BUY/SELL: quantità, prezzo e commissioni; niente importo', () => {
        expect(buildOperationRequest({
            type: 'BUY', operationDate: '2026-10-01', quantity: 10, price: 100, fees: 2.5, amount: 999, notes: '  ',
        })).toEqual({ type: 'BUY', operationDate: '2026-10-01', quantity: 10, price: 100, fees: 2.5 });
    });

    it('BOND: quantità = nominale e prezzo = % del nominale passano invariati', () => {
        expect(buildOperationRequest({ type: 'BUY', operationDate: '2026-10-01', quantity: 10000, price: 98.5 }))
            .toEqual({ type: 'BUY', operationDate: '2026-10-01', quantity: 10000, price: 98.5 });
    });

    it('DIVIDEND/COUPON: solo importo netto; i campi del gruppo BUY/SELL rimasti nel form non partono', () => {
        expect(buildOperationRequest({
            type: 'COUPON', operationDate: '2026-10-01', amount: 175, quantity: 10, price: 100, fees: 1, notes: 'cedola',
        })).toEqual({ type: 'COUPON', operationDate: '2026-10-01', amount: 175, notes: 'cedola' });
    });

    it('commissioni a 0 si inviano (0 è un valore, non assente)', () => {
        expect(buildOperationRequest({ type: 'SELL', operationDate: '2026-10-01', quantity: 1, price: 1, fees: 0 }).fees).toBe(0);
    });
});

describe('periodRange', () => {
    it('termina oggi, mai nel futuro', () => {
        const today = dayjs('2026-10-10');
        expect(periodRange(12, today)).toEqual({ startDate: '2025-10-10', endDate: '2026-10-10' });
        expect(periodRange(6, today)).toEqual({ startDate: '2026-04-10', endDate: '2026-10-10' });
    });
});

describe('operationTypesFor', () => {
    it('COUPON solo per le obbligazioni, DIVIDEND solo per gli altri', () => {
        expect(operationTypesFor('BOND')).toEqual(['BUY', 'SELL', 'COUPON']);
        expect(operationTypesFor('ETF')).toEqual(['BUY', 'SELL', 'DIVIDEND']);
        expect(operationTypesFor(undefined)).toEqual(['BUY', 'SELL', 'DIVIDEND']);
    });

    it('un\'operazione esistente di tipo "non suggerito" resta selezionabile', () => {
        expect(operationTypesFor('ETF', 'COUPON')).toContain('COUPON');
    });
});

describe('symbolRequired', () => {
    it('serve con fonti automatiche, non con quella manuale', () => {
        expect(symbolRequired('YAHOO')).toBe(true);
        expect(symbolRequired('TWELVE_DATA')).toBe(true);
        expect(symbolRequired('MANUAL')).toBe(false);
        expect(symbolRequired(undefined)).toBe(false);
    });
});

describe('isCurrencyUndeterminedError', () => {
    it('riconosce il 400 sulla valuta non ricavabile', () => {
        expect(isCurrencyUndeterminedError(400, 'Impossibile determinare la valuta dello strumento: indicala esplicitamente')).toBe(true);
        expect(isCurrencyUndeterminedError(400, 'Il simbolo è obbligatorio')).toBe(false);
        expect(isCurrencyUndeterminedError(409, 'valuta')).toBe(false);
        expect(isCurrencyUndeterminedError(undefined, undefined)).toBe(false);
    });
});
