// src/hooks/useAccountSync.ts
// Polling sincronizzazione bancaria (GoCardless / Enable Banking) estratto da Layout.tsx (righe 148-181).
// Usa refetchInterval di React Query invece di setInterval manuale.
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import * as api from '../services/api';
import { invalidateDerivedData, queryKeys } from '../queryKeys';
import type { Account } from '../types/api';

const SYNC_POLL_INTERVAL_MS = 10_000;
const SYNC_POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minuti
// Dopo il timeout il polling rallenta invece di fermarsi: fermandosi, `isSyncing` restava
// true, l'effetto non ripartiva più e la fine della sync non veniva mai notificata.
const SYNC_POLL_SLOW_INTERVAL_MS = 60_000;

/**
 * Gestisce il polling di sincronizzazione bancaria e la notifica di completamento.
 * Avviato automaticamente quando uno degli account ha `synchronizing = true`.
 *
 * @param accounts - Lista account corrente (da useAccounts)
 * @param fetchAccounts - Callback per aggiornare la lista (da useAccounts)
 */
export const useAccountSync = (
    accounts: Account[],
    fetchAccounts: (background?: boolean) => Promise<Account[]>
) => {
    const { t } = useTranslation();
    const { notification, message } = App.useApp();
    const queryClient = useQueryClient();
    const [syncingAccounts, setSyncingAccounts] = useState(false);

    const isSyncing = accounts.some(acc => acc.synchronizing);
    const fetchAccountsRef = useRef(fetchAccounts);
    useEffect(() => { fetchAccountsRef.current = fetchAccounts; });

    // Polling quando almeno un account è in stato synchronizing
    useEffect(() => {
        if (!isSyncing) return;
        const tick = () => {
            if (!document.hidden) fetchAccountsRef.current(true);
        };
        let poll = setInterval(tick, SYNC_POLL_INTERVAL_MS);
        const timeout = setTimeout(() => {
            clearInterval(poll);
            poll = setInterval(tick, SYNC_POLL_SLOW_INTERVAL_MS);
        }, SYNC_POLL_TIMEOUT_MS);
        return () => {
            clearInterval(poll);
            clearTimeout(timeout);
        };
    }, [isSyncing]);

    // Notifica di completamento quando isSyncing passa da true a false. L'esito si legge
    // dai conti che stavano sincronizzando: prima compariva "sync completata" anche
    // quando la sync finiva con il collegamento scaduto, o il conto era stato eliminato.
    const prevSyncingIdsRef = useRef<string[]>([]);
    // Conti finiti mentre altri erano ancora in sync: si accumulano fino alla fine di
    // tutti, altrimenti l'esito (es. riautenticazione) dei primi andava perso.
    const finishedIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const syncingIds = accounts.filter(acc => acc.synchronizing).map(acc => acc.id);
        prevSyncingIdsRef.current
            .filter(id => !syncingIds.includes(id))
            .forEach(id => finishedIdsRef.current.add(id));
        prevSyncingIdsRef.current = syncingIds;
        if (finishedIdsRef.current.size === 0 || syncingIds.length > 0) return;

        const finishedIds = finishedIdsRef.current;
        finishedIdsRef.current = new Set();
        const finished = accounts.filter(acc => finishedIds.has(acc.id));
        if (finished.length === 0) return; // conti eliminati durante la sync

        // Invalida transazioni e dati derivati: la sync importa nuovi movimenti.
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
        invalidateDerivedData(queryClient);
        const needsReauth = finished.filter(acc => acc.requiresReauth);
        if (needsReauth.length > 0) {
            notification.warning({
                title: t('transactions.syncErrorTitle'),
                description: `${needsReauth.map(acc => acc.name).join(', ')}: ${t('accounts.requiresReauthTooltip')}`,
                placement: 'topRight',
                duration: 8,
            });
        } else {
            notification.success({
                title: t('transactions.syncSuccessTitle'),
                description: t('transactions.syncSuccessDescription'),
                placement: 'topRight',
                duration: 5,
            });
        }
    }, [accounts, t, notification, queryClient]);

    const handleSyncAllAccounts = async () => {
        const syncableAccounts = accounts.filter(
            acc => acc.type === 'CONTO_CORRENTE' && acc.linkedToExternal
        );
        if (syncableAccounts.length === 0) {
            message.info(t('bankLink.noAccountsToSync'));
            return;
        }
        setSyncingAccounts(true);
        try {
            const syncPromises = syncableAccounts.map(account =>
                api.syncBankAccount(api.providerSlug(account.provider), account.id, { actualBalance: null })
                    .then(() => ({ success: true, accountName: account.name }))
                    .catch(error => ({ success: false, accountName: account.name, error }))
            );
            const results = await Promise.all(syncPromises);
            const successCount = results.filter(r => r.success).length;
            const failureCount = results.filter(r => !r.success).length;

            if (failureCount === 0) {
                message.success(t('bankLink.syncSuccessAll', { count: successCount }));
            } else if (successCount === 0) {
                message.error(t('bankLink.syncErrorAll', { count: failureCount }));
            } else {
                message.warning(t('bankLink.syncPartial', { successCount, failureCount }));
            }
            await fetchAccountsRef.current();
        } catch (error) {
            message.error(t('bankLink.syncError'));
            console.error(error);
        } finally {
            setSyncingAccounts(false);
        }
    };

    return { syncingAccounts, handleSyncAllAccounts, isSyncing };
};
