export const getCurrencySymbol = (currency: string): string => {
    try {
        return Intl.NumberFormat('it-IT', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 })
            .formatToParts(0)
            .find(p => p.type === 'currency')?.value ?? currency;
    } catch {
        return currency;
    }
};
