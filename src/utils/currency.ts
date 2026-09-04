// Cache per codice valuta: `Intl.NumberFormat` + `formatToParts` è una delle chiamate
// più costose della piattaforma, e questa funzione veniva invocata per riga di tabella e
// per voce di menu, a ogni render. I simboli valuta non cambiano a runtime.
const symbolCache = new Map<string, string>();

export const getCurrencySymbol = (currency: string): string => {
    const cached = symbolCache.get(currency);
    if (cached !== undefined) return cached;

    let symbol: string;
    try {
        symbol = Intl.NumberFormat('it-IT', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 })
            .formatToParts(0)
            .find(p => p.type === 'currency')?.value ?? currency;
    } catch {
        symbol = currency;
    }

    symbolCache.set(currency, symbol);
    return symbol;
};
