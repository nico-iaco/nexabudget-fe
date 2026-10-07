// src/utils/apiError.ts
//
// Lettura uniforme degli errori del backend. Il body di errore è sempre
// `{ status, message, timestamp, errors? }`: `message` è in italiano e mostrabile
// all'utente, `errors` contiene gli errori di validazione per campo.
// Prima ogni catch mostrava un generico "errore del server" anche quando il backend
// spiegava il motivo (409 nome duplicato, categoria in uso, conto nel cestino, …).
import axios from 'axios';
import type { FormInstance } from 'antd';

export interface ApiErrorBody {
    status: number;
    message: string;
    timestamp: string;
    errors?: unknown;
}

const body = (error: unknown): Partial<ApiErrorBody> | undefined => {
    if (!axios.isAxiosError(error)) return undefined;
    const data = error.response?.data;
    return data && typeof data === 'object' ? (data as Partial<ApiErrorBody>) : undefined;
};

/** Status HTTP della risposta d'errore, se c'è stata una risposta. */
export const getApiErrorStatus = (error: unknown): number | undefined =>
    axios.isAxiosError(error) ? error.response?.status : undefined;

/**
 * `message` del backend per gli errori 4xx (400, 404, 409, …). Per i 5xx e gli errori
 * di rete restituisce undefined: lì il chiamante mostra il suo messaggio generico.
 */
export const getApiErrorMessage = (error: unknown): string | undefined => {
    const status = getApiErrorStatus(error);
    if (status === undefined || status < 400 || status >= 500) return undefined;
    const message = body(error)?.message;
    return typeof message === 'string' && message.trim() ? message : undefined;
};

/** Messaggio del backend se presente, altrimenti il fallback (già tradotto). */
export const apiErrorText = (error: unknown, fallback: string): string =>
    getApiErrorMessage(error) ?? fallback;

/**
 * Errori di validazione per campo. Il formato di `errors` non è tipizzato dal backend:
 * si accettano sia una mappa `{ campo: messaggio }` sia una lista `[{ field, message }]`.
 */
export const getApiFieldErrors = (error: unknown): Record<string, string> => {
    const errors = body(error)?.errors;
    const result: Record<string, string> = {};
    if (Array.isArray(errors)) {
        for (const e of errors) {
            const { field, message } = (e ?? {}) as { field?: unknown; message?: unknown };
            if (typeof field === 'string' && typeof message === 'string') result[field] = message;
        }
    } else if (errors && typeof errors === 'object') {
        for (const [field, message] of Object.entries(errors)) {
            if (typeof message === 'string') result[field] = message;
        }
    }
    return result;
};

/**
 * Riporta gli errori del backend sui campi del form. I campi in `errors` che il form non
 * ha vengono ignorati; se nessuno combacia e c'è `fallbackField`, il `message` generale
 * finisce su quel campo (es. 409 "nome già esistente" → campo nome).
 * Restituisce true se almeno un campo è stato marcato: il chiamante può evitare il toast.
 */
export const applyApiFieldErrors = (
    form: FormInstance,
    error: unknown,
    fallbackField?: string,
): boolean => {
    const registered = new Set(Object.keys(form.getFieldsValue()));
    const fields = Object.entries(getApiFieldErrors(error))
        .filter(([name]) => registered.has(name))
        .map(([name, message]) => ({ name, errors: [message] }));
    if (fields.length === 0 && fallbackField) {
        const message = getApiErrorMessage(error);
        if (message) fields.push({ name: fallbackField, errors: [message] });
    }
    if (fields.length > 0) form.setFields(fields);
    return fields.length > 0;
};
