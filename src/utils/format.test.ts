import { describe, expect, it } from 'vitest';
import { i18n } from '../i18n';
import { formatMoney, formatMoneyOrNA, formatPercentOrNA, notAvailable } from './format';

// Il locale segue i18n: si fissa l'italiano, lingua di default dell'app.
await i18n.changeLanguage('it');

describe('formatMoneyOrNA', () => {
    it('mostra "n/d" per null, undefined e NaN: null non è zero', () => {
        expect(formatMoneyOrNA(null, 'EUR')).toBe('n/d');
        expect(formatMoneyOrNA(undefined, 'EUR')).toBe('n/d');
        expect(formatMoneyOrNA(Number.NaN, 'EUR')).toBe('n/d');
        expect(notAvailable()).toBe('n/d');
    });

    it('un vero zero resta "0,00 €"', () => {
        expect(formatMoneyOrNA(0, 'EUR')).toBe(formatMoney(0, 'EUR'));
        expect(formatMoneyOrNA(0, 'EUR')).not.toBe('n/d');
    });

    it('formatta all\'italiana, con segno se richiesto', () => {
        expect(formatMoneyOrNA(1234.56, 'EUR').replace(/\u00a0/g, ' ')).toBe('1.234,56 €');
        expect(formatMoneyOrNA(1234.56, 'EUR', { signed: true })).toMatch(/^\+/);
        expect(formatMoneyOrNA(-10, 'EUR', { signed: true })).toMatch(/^[-−]/);
    });
});

describe('formatPercentOrNA', () => {
    it('mostra "n/d" per null e undefined', () => {
        expect(formatPercentOrNA(null)).toBe('n/d');
        expect(formatPercentOrNA(undefined)).toBe('n/d');
    });

    it('gestisce percentuali negative e zero', () => {
        expect(formatPercentOrNA(-12.5, 1).replace(/\u00a0/g, ' ')).toMatch(/12,5 ?%/);
        expect(formatPercentOrNA(0, 1)).not.toBe('n/d');
    });
});
