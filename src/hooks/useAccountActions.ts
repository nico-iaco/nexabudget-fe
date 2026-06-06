// src/hooks/useAccountActions.ts
// Mutazioni CRUD account e transfer estratte da Layout.tsx.
// Usa useMutation di React Query: isPending alimenta il loading dei modali (Fase E).
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import * as api from '../services/api';
import { queryKeys } from '../queryKeys';
import type { Account, AccountRequest } from '../types/api';
import type { TransferFormValues } from '../components/modals/TransferModal';

/**
 * Gestisce tutte le azioni CRUD sugli account e il trasferimento tra conti.
 * Restituisce stati dei modali, handler e `isPending` per il feedback dei form.
 */
export const useAccountActions = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // --- Stato modali ---
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    // --- Invalidazione account ---
    const invalidateAccounts = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
        queryClient.invalidateQueries({ queryKey: queryKeys.totalBalance });
    };

    // --- Mutazione crea/modifica account ---
    const saveAccountMutation = useMutation({
        mutationFn: async (values: AccountRequest) => {
            if (editingAccount) {
                return api.updateAccount(editingAccount.id, values);
            }
            return api.createAccount(values);
        },
        onSuccess: () => {
            message.success(
                editingAccount ? t('accounts.updatedSuccess') : t('accounts.createdSuccess')
            );
            setIsAccountModalOpen(false);
            setEditingAccount(null);
            invalidateAccounts();
        },
        onError: (error) => {
            message.error(t('accounts.saveError'));
            console.error(error);
        },
    });

    // --- Mutazione elimina account ---
    const deleteAccountMutation = useMutation({
        mutationFn: (accountId: string) => api.deleteAccount(accountId),
        onSuccess: () => {
            message.success(t('accounts.deletedSuccess'));
            invalidateAccounts();
            navigate('/transactions');
        },
        onError: (error) => {
            message.error(t('accounts.deleteError'));
            console.error(error);
        },
    });

    // --- Mutazione trasferimento ---
    const transferMutation = useMutation({
        mutationFn: (values: TransferFormValues) => {
            const transferData = {
                ...values,
                transferDate: values.transferDate
                    ? values.transferDate.format('YYYY-MM-DD')
                    : dayjs().format('YYYY-MM-DD'),
            };
            return api.createTransfer(transferData);
        },
        onSuccess: () => {
            message.success(t('transfers.createdSuccess'));
            setIsTransferModalOpen(false);
            invalidateAccounts();
            queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
        },
        onError: (error) => {
            message.error(t('transfers.createError'));
            console.error(error);
        },
    });

    // --- Handler apertura modali ---
    const handleOpenCreateAccountModal = (closeMobile?: () => void) => {
        setEditingAccount(null);
        setIsAccountModalOpen(true);
        closeMobile?.();
    };

    const handleOpenEditAccountModal = (account: Account, closeMobile?: () => void) => {
        setEditingAccount(account);
        setIsAccountModalOpen(true);
        closeMobile?.();
    };

    const handleCancelAccountModal = () => {
        setIsAccountModalOpen(false);
        setEditingAccount(null);
    };

    const handleOpenTransferModal = () => setIsTransferModalOpen(true);
    const handleCancelTransferModal = () => setIsTransferModalOpen(false);

    return {
        // Stato modali
        isAccountModalOpen,
        editingAccount,
        isTransferModalOpen,

        // Handler modali
        handleOpenCreateAccountModal,
        handleOpenEditAccountModal,
        handleCancelAccountModal,
        handleOpenTransferModal,
        handleCancelTransferModal,

        // Azioni con loading state
        onFinishAccount: saveAccountMutation.mutate,
        isSavingAccount: saveAccountMutation.isPending,

        deleteAccount: deleteAccountMutation.mutate,
        isDeletingAccount: deleteAccountMutation.isPending,

        onFinishTransfer: transferMutation.mutate,
        isTransferring: transferMutation.isPending,
    };
};
