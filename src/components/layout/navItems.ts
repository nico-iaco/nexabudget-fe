/**
 * Definizione centralizzata delle voci di navigazione.
 * Usata sia da AppSider (tutte le voci) che da BottomNavBar (subset mobile).
 */

export interface NavItem {
    key: string;       // percorso route, usato come selectedKey
    labelKey: string;  // chiave i18n (nav.*)
    /** Solo le voci con showInBottomBar: true vengono mostrate nella bottom-bar mobile */
    showInBottomBar?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
    { key: '/dashboard',   labelKey: 'nav.dashboard',        showInBottomBar: true },
    { key: '/transactions', labelKey: 'nav.allTransactions',  showInBottomBar: true },
    { key: '/budgets',     labelKey: 'nav.budgets',           showInBottomBar: true },
    { key: '/crypto',      labelKey: 'nav.crypto',            showInBottomBar: false },
    { key: '/trash',       labelKey: 'nav.trash',             showInBottomBar: false },
    { key: '/audit-log',   labelKey: 'nav.auditLog',          showInBottomBar: false },
    { key: '/chat',        labelKey: 'nav.chat',              showInBottomBar: true },
    { key: '/settings',    labelKey: 'nav.settings',          showInBottomBar: true },
];
