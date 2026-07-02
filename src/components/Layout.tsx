// src/components/Layout.tsx
// Guscio di composizione dell'area autenticata.
// La logica di business è stata estratta in hook dedicati:
//   - useAccounts       → fetch account + saldo totale (React Query)
//   - useCategories     → fetch categorie (React Query)
//   - useAccountActions → CRUD account + transfer (useMutation)
//   - useAccountSync    → polling sincronizzazione GoCardless
//   - useGoCardlessLink → macchina a stati wizard GoCardless
//   - useConfirm        → dialog conferma delete
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { App, Button, Layout as AntLayout, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { AppSider } from './layout/AppSider';
import { AppHeader } from './layout/AppHeader';
import { BottomNavBar } from './layout/BottomNavBar';
import { useBreakpoints } from '../hooks/useBreakpoints';
import { applyPWAUpdate } from '../pwaRegister';
import { AccountModal } from './modals/AccountModal';
import { TransferModal } from './modals/TransferModal';
import { GoCardlessModal } from './modals/GoCardlessModal';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { useAccountActions } from '../hooks/useAccountActions';
import { useAccountSync } from '../hooks/useAccountSync';
import { useGoCardlessLink } from '../hooks/useGoCardlessLink';
import { useConfirm } from '../hooks/useConfirm';
import type { AppOutletContext } from '../types/outletContext';
import { RADIUS, SPACING } from '../theme/tokens';

const { Content } = AntLayout;

export const Layout = () => {
    const { t } = useTranslation();
    const { notification } = App.useApp();
    const [collapsed, setCollapsed] = useState(true);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [transactionRefreshKey] = useState(0);

    const { isMobile, isSmallMobile } = useBreakpoints();
    const { auth, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const confirm = useConfirm();

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    // --- Hook dati ---
    const { accounts, totalBalance, fetchAccounts, isLoading: loadingAccounts } = useAccounts();
    const { categories, fetchCategories } = useCategories();

    // --- Hook azioni CRUD ---
    const {
        isAccountModalOpen,
        editingAccount,
        isTransferModalOpen,
        handleOpenCreateAccountModal,
        handleOpenEditAccountModal,
        handleCancelAccountModal,
        handleOpenTransferModal,
        handleCancelTransferModal,
        onFinishAccount,
        isSavingAccount,
        deleteAccount,
        onFinishTransfer,
        isTransferring,
    } = useAccountActions();

    // --- Hook sync GoCardless ---
    const { syncingAccounts, handleSyncAllAccounts } = useAccountSync(accounts, fetchAccounts);

    // --- Hook wizard GoCardless ---
    const { state: gcState, actions: gcActions } = useGoCardlessLink();

    // Focus management: restore focus to toggle when drawer closes
    const menuToggleRef = useRef<HTMLButtonElement | null>(null);
    const prevCollapsedRef = useRef(collapsed);

    useEffect(() => {
        setSelectedKeys([location.pathname]);
    }, [location.pathname]);

    // Banner aggiornamento PWA
    useEffect(() => {
        const handler = () => {
            notification.info({
                message: t('pwa.updateAvailable'),
                description: t('pwa.updateDescription'),
                btn: (
                    <Button type="primary" size="small" onClick={() => applyPWAUpdate()}>
                        {t('pwa.updateNow')}
                    </Button>
                ),
                duration: 0,
                placement: 'bottomRight',
                key: 'pwa-update',
            });
        };
        window.addEventListener('pwa-update-available', handler);
        return () => window.removeEventListener('pwa-update-available', handler);
    }, [notification, t]);

    // Chiudi il drawer mobile con Escape
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isMobile && !collapsed) setCollapsed(true);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isMobile, collapsed]);

    // Ripristina il focus sul toggle quando il drawer si chiude
    useEffect(() => {
        if (isMobile && prevCollapsedRef.current === false && collapsed) {
            menuToggleRef.current?.focus();
        }
        prevCollapsedRef.current = collapsed;
    }, [collapsed, isMobile]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleOpenDeleteAccount = (account: import('../types/api').Account) => {
        if (isMobile) setCollapsed(true);
        confirm({
            title: t('accounts.deleteTitle'),
            content: `${t('accounts.deleteConfirm', { name: account.name })}\n${t('accounts.deleteConfirmWarning')}`,
            danger: true,
            okText: t('common.delete'),
            cancelText: t('common.cancel'),
            onOk: () => deleteAccount(account.id),
        });
    };

    if (!auth) {
        const emptyContext: AppOutletContext = {
            accounts: [],
            fetchAccounts: () => Promise.resolve([]),
            transactionRefreshKey: 0,
            categories: [],
            fetchCategories: () => {},
            handleOpenTransferModal: () => {},
            onOpenCreateAccount: () => {},
            onOpenGoCardless: () => {},
        };
        return <Outlet context={emptyContext} />;
    }

    const outletContext: AppOutletContext = {
        accounts,
        fetchAccounts,
        transactionRefreshKey,
        categories,
        fetchCategories,
        handleOpenTransferModal,
        onOpenCreateAccount: () => handleOpenCreateAccountModal(isMobile ? () => setCollapsed(true) : undefined),
        onOpenGoCardless: gcActions.open,
    };

    return (
        <>
            {/* Skip-to-content link — visibile solo al focus da tastiera */}
            <a
                href="#main"
                style={{
                    position: 'absolute',
                    top: -40,
                    left: 0,
                    padding: `${SPACING.xs}px ${SPACING.md}px`,
                    background: colorBgContainer,
                    zIndex: 9999,
                    borderRadius: `0 0 ${RADIUS.sm}px 0`,
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'top 0.1s',
                }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.top = '0'; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.top = '-40px'; }}
            >
                {t('common.skipToContent', { defaultValue: 'Salta al contenuto' })}
            </a>
            <AntLayout style={{ minHeight: '100vh' }}>
                <AppSider
                    collapsed={collapsed}
                    setCollapsed={setCollapsed}
                    isMobile={isMobile}
                    accounts={accounts}
                    loading={loadingAccounts}
                    totalBalance={totalBalance}
                    selectedKeys={selectedKeys}
                    onOpenCreateAccount={() => handleOpenCreateAccountModal(isMobile ? () => setCollapsed(true) : undefined)}
                    onOpenEditAccount={(account) => handleOpenEditAccountModal(account, isMobile ? () => setCollapsed(true) : undefined)}
                    onOpenDeleteAccount={handleOpenDeleteAccount}
                    onOpenGoCardless={(account) => {
                        gcActions.open(account);
                        if (isMobile) setCollapsed(true);
                    }}
                    onSyncAllAccounts={handleSyncAllAccounts}
                    syncingAccounts={syncingAccounts}
                />
                <AntLayout
                    className="site-layout"
                    style={{
                        marginLeft: isMobile ? 0 : (collapsed ? 0 : 300),
                        transition: 'all 0.2s',
                    }}
                >
                    <AppHeader
                        collapsed={collapsed}
                        setCollapsed={setCollapsed}
                        isMobile={isMobile}
                        onLogout={handleLogout}
                        toggleRef={menuToggleRef}
                    />
                    <Content
                        style={{
                            margin: isMobile ? `${SPACING.md}px ${SPACING.xs}px` : `${SPACING.lg}px ${SPACING.md}px`,
                            minHeight: 280,
                            overflow: 'auto',
                        }}
                    >
                        <main
                            id="main"
                            style={{
                                padding: isMobile ? SPACING.sm : SPACING.lg,
                                paddingBottom: isSmallMobile
                                    ? 'calc(72px + env(safe-area-inset-bottom, 0px))'
                                    : isMobile ? SPACING.sm : SPACING.lg,
                                minHeight: 280,
                                background: colorBgContainer,
                                borderRadius: borderRadiusLG,
                            }}
                        >
                            <Outlet context={outletContext} />
                        </main>
                    </Content>
                </AntLayout>
            </AntLayout>

            {isMobile && !collapsed && (
                <div
                    role="button"
                    tabIndex={0}
                    aria-label={t('common.closeMenu')}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.45)',
                        zIndex: 1000,
                    }}
                    onClick={() => setCollapsed(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setCollapsed(true);
                        }
                    }}
                />
            )}

            {isAccountModalOpen && (
                <AccountModal
                    open={isAccountModalOpen}
                    onCancel={handleCancelAccountModal}
                    onFinish={onFinishAccount}
                    editingAccount={editingAccount}
                    loading={isSavingAccount}
                />
            )}

            {isTransferModalOpen && (
                <TransferModal
                    open={isTransferModalOpen}
                    onCancel={handleCancelTransferModal}
                    onFinish={onFinishTransfer}
                    accounts={accounts}
                    loading={isTransferring}
                />
            )}

            {gcState.isOpen && (
                <GoCardlessModal
                    open={gcState.isOpen}
                    onCancel={gcActions.cancel}
                    account={gcState.linkingAccount}
                    currentStep={gcState.currentStep}
                    selectedCountry={gcState.selectedCountry}
                    banks={gcState.banks}
                    loadingBanks={gcState.loadingBanks}
                    selectedBank={gcState.selectedBank}
                    onCountrySelect={gcActions.handleCountrySelect}
                    onBankSelect={gcActions.handleBankSelect}
                    onConfirm={gcActions.handleConfirmBankLink}
                />
            )}

            {/* PWA Install Prompt */}
            <PWAInstallPrompt />

            <BottomNavBar />
        </>
    );
};
