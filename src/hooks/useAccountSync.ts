// src/hooks/useAccountSync.ts
// Polling sincronizzazione bancaria (GoCardless / Enable Banking) estratto da Layout.tsx (righe 148-181).
// Usa refetchInterval di React Query invece di setInterval manuale.
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import * as api from '../services/api';
import { queryKeys } from '../queryKeys';
import type { Account } from '../types/api';

const SYNC_POLL_INTERVAL_MS = 10_000;
const SYNC_POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minuti

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
        const poll = setInterval(() => {
            if (!document.hidden) fetchAccountsRef.current(true);
        }, SYNC_POLL_INTERVAL_MS);
        const timeout = setTimeout(() => clearInterval(poll), SYNC_POLL_TIMEOUT_MS);
        return () => {
            clearInterval(poll);
            clearTimeout(timeout);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSyncing]);

    // Notifica di completamento quando isSyncing passa da true a false
    const prevSyncingRef = useRef(isSyncing);
    useEffect(() => {
        if (prevSyncingRef.current && !isSyncing) {
            // Invalida anche le transazioni così si aggiornano automaticamente
            queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
            notification.success({
                message: t('transactions.syncSuccessTitle'),
                description: t('transactions.syncSuccessDescription'),
                placement: 'topRight',
                duration: 5,
            });
        }
        prevSyncingRef.current = isSyncing;
    }, [isSyncing, t, notification, queryClient]);

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
