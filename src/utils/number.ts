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
    (value?.replace(',', '.') ?? '') as unknown as number;
