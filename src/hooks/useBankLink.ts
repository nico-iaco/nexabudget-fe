// src/hooks/useBankLink.ts
// Macchina a stati del wizard di collegamento bancario multi-provider (GoCardless / Enable Banking).
// Estende il precedente useGoCardlessLink con un primo step di scelta provider.
import { useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import * as api from '../services/api';
import type { Account, BankInstitutionDto, BankProvider } from '../types/api';

interface BankLinkState {
    isOpen: boolean;
    linkingAccount: Account | null;
    currentStep: number;
    selectedProvider: BankProvider | null;
    selectedCountry: string | null;
    banks: BankInstitutionDto[];
    loadingBanks: boolean;
    selectedBank: string | null;
}

const INITIAL_STATE: BankLinkState = {
    isOpen: false,
    linkingAccount: null,
    currentStep: 0,
    selectedProvider: null,
    selectedCountry: null,
    banks: [],
    loadingBanks: false,
    selectedBank: null,
};

/**
 * Gestisce il flusso di collegamento bancario multi-provider (GoCardless / Enable Banking).
 * Restituisce `{ state, actions }` pronti per essere consumati da BankLinkModal e Layout.
 */
export const useBankLink = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [state, setState] = useState<BankLinkState>(INITIAL_STATE);

    const open = (account: Account) => {
        // Se l'account è già collegato a un provider (es. rinnovo collegamento scaduto),
        // pre-seleziona quel provider e salta lo step di scelta.
        const presetProvider: BankProvider | null = account.provider
            ? api.providerSlug(account.provider)
            : null;
        setState({
            isOpen: true,
            linkingAccount: account,
            currentStep: presetProvider ? 1 : 0,
            selectedProvider: presetProvider,
            selectedCountry: null,
            banks: [],
            loadingBanks: false,
            selectedBank: null,
        });
    };

    const cancel = () => {
        setState(INITIAL_STATE);
    };

    const handleProviderSelect = (provider: BankProvider) => {
        setState(s => ({ ...s, selectedProvider: provider, currentStep: 1 }));
    };

    const handleCountrySelect = async (countryCode: string) => {
        const { selectedProvider } = state;
        if (!selectedProvider) return;
        setState(s => ({ ...s, selectedCountry: countryCode, loadingBanks: true }));
        try {
            const response = await api.getBankList(selectedProvider, countryCode);
            setState(s => ({ ...s, banks: response.data, currentStep: 2, loadingBanks: false }));
        } catch (error) {
            message.error(t('bankLink.loadBanksError'));
            console.error(error);
            setState(s => ({ ...s, loadingBanks: false }));
        }
    };

    const handleBankSelect = (bankId: string) => {
        setState(s => ({ ...s, selectedBank: bankId }));
    };

    const handleConfirmBankLink = async () => {
        const { selectedProvider, selectedBank, linkingAccount } = state;
        if (!selectedProvider || !selectedBank || !linkingAccount) return;
        try {
            const response = await api.getBankLink(selectedProvider, {
                institutionId: selectedBank,
                localAccountId: linkingAccount.id,
            });
            window.location.href = response.data.redirectUrl;
            cancel();
        } catch (error) {
            message.error(t('bankLink.linkError'));
            console.error(error);
        }
    };

    return {
        state,
        actions: {
            open,
            cancel,
            handleProviderSelect,
            handleCountrySelect,
            handleBankSelect,
            handleConfirmBankLink,
        },
    };
};
