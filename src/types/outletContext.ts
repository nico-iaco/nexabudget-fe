// src/types/outletContext.ts
// Tipo condiviso dell'Outlet context passato da Layout alle pagine figlie.
// Sostituisce le 5 definizioni locali di OutletContextType sparse nei consumer.
import type { Account, Category } from './api';

export interface AppOutletContext {
    /** Lista account dell'utente (aggiornata da React Query in Layout) */
    accounts: Account[];
    /** Forza un refetch degli account (wrapper su queryClient.invalidateQueries) */
    fetchAccounts: (background?: boolean) => Promise<Account[]>;
    /**
     * Chiave numerica incrementata dopo ogni mutazione su transazioni.
     * @deprecated Usare queryClient.invalidateQueries sul queryKey delle transazioni.
     * Mantenuto per retrocompatibilità con TransactionsPage durante la migrazione.
     */
    transactionRefreshKey: number;
    /** Lista categorie dell'utente */
    categories: Category[];
    /** Forza un refetch delle categorie */
    fetchCategories: () => void;
    /** Apre il modale di trasferimento tra conti */
    handleOpenTransferModal: () => void;
    /** Apre il modale di creazione conto */
    onOpenCreateAccount: () => void;
    /** Apre il wizard di collegamento bancario (GoCardless / Enable Banking) per collegare/rinnovare la connessione di un account */
    onOpenBankLink: (account: Account) => void;
}
