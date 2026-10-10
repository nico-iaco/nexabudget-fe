/**
 * Definizione centralizzata delle voci di navigazione.
 * Usata sia da AppSider (tutte le voci) che da BottomNavBar (subset mobile).
 */

export interface NavItem {
    key: string;       // percorso route, usato come selectedKey
    labelKey: string;  // chiave i18n (nav.*)
    /** Solo le voci con showInBottomBar: true vengono mostrate nella bottom-bar mobile */
    showInBottomBar?: boolean;
    /** Etichetta breve per la bottom-bar, dove ogni voce ha ~75px (default: labelKey) */
    bottomBarLabelKey?: string;
}

export const NAV_ITEMS: NavItem[] = [
    { key: '/dashboard',   labelKey: 'nav.dashboard',        showInBottomBar: true },
    { key: '/transactions', labelKey: 'nav.allTransactions',  showInBottomBar: true, bottomBarLabelKey: 'nav.transactions' },
    { key: '/budgets',     labelKey: 'nav.budgets',           showInBottomBar: true },
    { key: '/crypto',      labelKey: 'nav.crypto',            showInBottomBar: false },
    { key: '/investments', labelKey: 'nav.investments',       showInBottomBar: false },
    { key: '/trash',       labelKey: 'nav.trash',             showInBottomBar: false },
    { key: '/audit-log',   labelKey: 'nav.auditLog',          showInBottomBar: false },
    { key: '/chat',        labelKey: 'nav.chat',              showInBottomBar: true },
    { key: '/settings',    labelKey: 'nav.settings',          showInBottomBar: true },
];
