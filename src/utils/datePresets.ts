// src/utils/datePresets.ts
// Preset di intervalli di date condivisi da Dashboard, analisi AI, report e transazioni.
// Prima ogni pagina aveva i suoi: "Ultimi 6 mesi" copriva 7 mesi sulla dashboard e 6 nei
// report, e "Ultimo anno" 13 mesi.
import dayjs, { type Dayjs } from 'dayjs';

export type DateRangeValue = [Dayjs, Dayjs];

export interface RangePreset {
    key: 'last7Days' | 'thisMonth' | 'previousMonth' | 'last3Months' | 'last6Months' | 'last12Months';
    label: string;
    value: DateRangeValue;
}

/** Gli ultimi `n` mesi di calendario, mese corrente incluso: `lastMonthsRange(6)` = 6 mesi. */
export const lastMonthsRange = (n: number): DateRangeValue => [
    dayjs().subtract(n - 1, 'month').startOf('month'),
    dayjs().endOf('month'),
];

/**
 * Preset calcolati al momento della chiamata (le date dipendono da "oggi").
 * `keys` filtra e ordina i preset da mostrare.
 */
export const getRangePresets = (
    t: (key: string) => string,
    keys: RangePreset['key'][] = ['thisMonth', 'previousMonth', 'last3Months', 'last6Months', 'last12Months'],
): RangePreset[] => {
    const previous = dayjs().subtract(1, 'month');
    const all: Record<RangePreset['key'], DateRangeValue> = {
        last7Days: [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')],
        thisMonth: lastMonthsRange(1),
        previousMonth: [previous.startOf('month'), previous.endOf('month')],
        last3Months: lastMonthsRange(3),
        last6Months: lastMonthsRange(6),
        last12Months: lastMonthsRange(12),
    };
    return keys.map(key => ({ key, label: t(`presets.${key}`), value: all[key] }));
};
