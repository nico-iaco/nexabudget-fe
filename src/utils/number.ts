/**
 * Parser condiviso per `InputNumber` che accetta la virgola come separatore
 * decimale (tastiere italiane), deduplicando la stessa lambda copiata in 6 form.
 *
 * A runtime restituisce la stringa normalizzata: rc-input-number la converte
 * internamente, perché accetta `string | number`. I tipi di AntD dichiarano
 * però il parser come `(displayValue) => T`, dove `T` è il tipo numerico del
 * componente, da cui il cast.
 *
 * Usare sempre con il generico pinnato — `<InputNumber<number> …>` — altrimenti
 * TypeScript inferisce `T` dal literal passato a `min`/`max` (es. `min={0}` →
 * `T = 0`) e i valori numerici delle altre prop non combaciano.
 */
export const commaDecimalParser = (value: string | undefined): number =>
    normalizeDecimal(value ?? '') as unknown as number;

/**
 * Variante per `InputNumber` in `stringMode` (quantità crypto con 8 decimali, dove un
 * number perderebbe precisione): stessa normalizzazione, valore stringa.
 */
export const decimalStringParser = (value: string | undefined): string => normalizeDecimal(value ?? '');

/**
 * Riconosce anche il separatore delle migliaia: prima "1.234,56" diventava "1.234.56",
 * non valido, e InputNumber teneva l'ultimo valore valido (1,234 → circa 1 €).
 *  - con punto e virgola insieme, il decimale è l'ultimo dei due ("1.234,56", "1,234.56");
 *  - con sole virgole, l'ultima è il decimale ("12,5", "1,234,5");
 *  - con soli punti: uno è il decimale (InputNumber mostra il valore così, "1234.56"),
 *    più di uno sono migliaia ("1.234.567").
 */
const normalizeDecimal = (raw: string): string => {
    const s = raw.replace(/[\s'\u00a0]/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
        const decimalIdx = Math.max(lastComma, lastDot);
        const integer = s.slice(0, decimalIdx).replace(/[.,]/g, '');
        return `${integer}.${s.slice(decimalIdx + 1)}`;
    }
    if (lastComma !== -1) {
        return `${s.slice(0, lastComma).replace(/,/g, '')}.${s.slice(lastComma + 1)}`;
    }
    if (s.indexOf('.') !== lastDot) return s.replace(/\./g, '');
    return s;
};
