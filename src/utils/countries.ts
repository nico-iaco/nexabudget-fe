// src/utils/countries.ts
// Paesi supportati dai provider di collegamento bancario. I nomi non sono più scritti a
// mano in italiano: Intl.DisplayNames li dà nella lingua dell'app.
import { i18n } from '../i18n';

const EUROPEAN_COUNTRY_CODES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
    'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'NO', 'IS',
] as const;

const countryName = (code: string, locale: string): string => {
    try {
        return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
        return code;
    }
};

/** Paesi supportati con il nome nella lingua corrente, in ordine alfabetico. */
export const getEuropeanCountries = (): { code: string; name: string }[] => {
    const locale = i18n.language === 'en' ? 'en' : 'it';
    return EUROPEAN_COUNTRY_CODES
        .map(code => ({ code, name: countryName(code, locale) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale));
};
