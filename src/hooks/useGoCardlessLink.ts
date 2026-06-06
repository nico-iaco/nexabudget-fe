// src/hooks/useGoCardlessLink.ts
// Macchina a stati del wizard GoCardless estratta da Layout.tsx.
// Incapsula i 7 stati (righe 39-46 di Layout) + 5 handler.
import { useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import * as api from '../services/api';
import type { Account, GoCardlessBank } from '../types/api';

interface GoCardlessLinkState {
    isOpen: boolean;
    linkingAccount: Account | null;
    currentStep: number;
    selectedCountry: string | null;
    banks: GoCardlessBank[];
    loadingBanks: boolean;
    selectedBank: string | null;
}

const INITIAL_STATE: GoCardlessLinkState = {
    isOpen: false,
    linkingAccount: null,
    currentStep: 0,
    selectedCountry: null,
    banks: [],
    loadingBanks: false,
    selectedBank: null,
};

/**
 * Gestisce il flusso di collegamento bancario GoCardless.
 * Restituisce `{ state, actions }` pronti per essere consumati da GoCardlessModal e Layout.
 */
export const useGoCardlessLink = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [state, setState] = useState<GoCardlessLinkState>(INITIAL_STATE);

    const open = (account: Account) => {
        setState({
            isOpen: true,
            linkingAccount: account,
            currentStep: 0,
            selectedCountry: null,
            banks: [],
            loadingBanks: false,
            selectedBank: null,
        });
    };

    const cancel = () => {
        setState(INITIAL_STATE);
    };

    const handleCountrySelect = async (countryCode: string) => {
        setState(s => ({ ...s, selectedCountry: countryCode, loadingBanks: true }));
        try {
            const response = await api.getGoCardlessBankList(countryCode);
            setState(s => ({ ...s, banks: response.data, currentStep: 1, loadingBanks: false }));
        } catch (error) {
            message.error(t('gocardless.loadBanksError'));
            console.error(error);
            setState(s => ({ ...s, loadingBanks: false }));
        }
    };

    const handleBankSelect = (bankId: string) => {
        setState(s => ({ ...s, selectedBank: bankId }));
    };

    const handleConfirmBankLink = async () => {
        const { selectedBank, linkingAccount } = state;
        if (!selectedBank || !linkingAccount) return;
        try {
            const response = await api.getGoCardlessBankLink({
                institutionId: selectedBank,
                localAccountId: linkingAccount.id,
            });
            window.location.href = response.data;
            cancel();
        } catch (error) {
            message.error(t('gocardless.linkError'));
            console.error(error);
        }
    };

    return {
        state,
        actions: {
            open,
            cancel,
            handleCountrySelect,
            handleBankSelect,
            handleConfirmBankLink,
        },
    };
};
