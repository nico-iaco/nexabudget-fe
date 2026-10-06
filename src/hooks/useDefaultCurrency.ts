import { useAuth } from '../contexts/AuthContext';

/**
 * Valuta di riferimento dell'utente (impostazioni → valuta di base), in cui il backend
 * restituisce gli aggregati di dashboard, report e budget. Da passare a `formatMoney`.
 */
export const useDefaultCurrency = (): string => {
    const { auth } = useAuth();
    return auth?.defaultCurrency || 'EUR';
};
