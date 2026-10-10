// src/hooks/useBankLink.ts
// Macchina a stati del wizard di collegamento bancario multi-provider (GoCardless / Enable Banking).
// Estende il precedente useGoCardlessLink con un primo step di scelta provider.
import { useCallback, useRef, useState } from 'react';
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
    /** Richiesta del link in corso: blocca il doppio click che creava più requisition/sessioni. */
    linking: boolean;
    /** Rinnovo di un collegamento attivo: il provider è fissato e lo step 0 non è raggiungibile. */
    providerLocked: boolean;
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
    linking: false,
    providerLocked: false,
};

/**
 * Gestisce il flusso di collegamento bancario multi-provider (GoCardless / Enable Banking).
 * Restituisce `{ state, actions }` pronti per essere consumati da BankLinkModal e Layout.
 */
export const useBankLink = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [state, setState] = useState<BankLinkState>(INITIAL_STATE);
    // Ultima richiesta dell'elenco banche: cambiando paese in fretta, o chiudendo e
    // riaprendo il wizard, una risposta tardiva non deve sovrascrivere lo stato attuale.
    const banksRequestRef = useRef(0);

    // useCallback: `open` viene esposto nell'outlet context di Layout, che va memoizzato.
    const open = useCallback((account: Account) => {
        banksRequestRef.current += 1;
        // Solo il rinnovo di un collegamento attivo (es. consenso scaduto) pre-seleziona il
        // provider e salta lo step di scelta. `provider` da solo non basta: il backend lo
        // conserva anche su conti scollegati o con un collegamento mai completato, e per
        // quelli lo step 0 spariva impedendo di scegliere un provider diverso.
        const presetProvider: BankProvider | null = account.linkedToExternal && account.provider
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
            linking: false,
            // Con requiresReauth il provider resta preselezionato ma si può tornare allo
            // step 0: il backend azzera il vecchio collegamento se si sceglie un provider
            // diverso, quindi "rifare" il collegamento altrove è un percorso valido.
            providerLocked: presetProvider !== null && !account.requiresReauth,
        });
    }, []);

    const cancel = useCallback(() => {
        banksRequestRef.current += 1;
        setState(INITIAL_STATE);
    }, []);

    // Torna allo step precedente azzerando le scelte successive (paese → banche → banca).
    const back = () => {
        banksRequestRef.current += 1;
        setState(s => {
            const minStep = s.providerLocked ? 1 : 0;
            if (s.currentStep <= minStep) return s;
            const currentStep = s.currentStep - 1;
            return {
                ...s,
                currentStep,
                selectedProvider: currentStep === 0 ? null : s.selectedProvider,
                selectedCountry: currentStep <= 1 ? null : s.selectedCountry,
                banks: currentStep <= 1 ? [] : s.banks,
                selectedBank: null,
                // La richiesta in volo viene scartata: senza questo lo spinner restava acceso.
                loadingBanks: false,
            };
        });
    };

    const handleProviderSelect = (provider: BankProvider) => {
        setState(s => ({ ...s, selectedProvider: provider, currentStep: 1 }));
    };

    const handleCountrySelect = async (countryCode: string) => {
        const { selectedProvider } = state;
        if (!selectedProvider) return;
        const requestId = ++banksRequestRef.current;
        setState(s => ({ ...s, selectedCountry: countryCode, loadingBanks: true }));
        try {
            const response = await api.getBankList(selectedProvider, countryCode);
            if (requestId !== banksRequestRef.current) return;
            setState(s => ({ ...s, banks: response.data, currentStep: 2, loadingBanks: false }));
        } catch (error) {
            if (requestId !== banksRequestRef.current) return;
            message.error(t('bankLink.loadBanksError'));
            console.error(error);
            setState(s => ({ ...s, loadingBanks: false }));
        }
    };

    const handleBankSelect = (bankId: string) => {
        setState(s => ({ ...s, selectedBank: bankId }));
    };

    const handleConfirmBankLink = async () => {
        const { selectedProvider, selectedBank, linkingAccount, linking } = state;
        if (!selectedProvider || !selectedBank || !linkingAccount || linking) return;
        setState(s => ({ ...s, linking: true }));
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
            setState(s => ({ ...s, linking: false }));
        }
    };

    return {
        state,
        actions: {
            open,
            cancel,
            back,
            handleProviderSelect,
            handleCountrySelect,
            handleBankSelect,
            handleConfirmBankLink,
        },
    };
};
