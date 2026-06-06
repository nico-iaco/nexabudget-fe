// src/components/Layout.tsx
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { App, Button, Layout as AntLayout, Modal, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../services/api';
import type { Account, AccountRequest, Category, GoCardlessBank, TransferRequest } from '../types/api';
import dayjs from 'dayjs';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { AppSider } from './layout/AppSider';
import { AppHeader } from './layout/AppHeader';
import { BottomNavBar } from './layout/BottomNavBar';
import { useBreakpoints } from '../hooks/useBreakpoints';
import { applyPWAUpdate } from '../pwaRegister';
import { AccountModal } from './modals/AccountModal';
import { type TransferFormValues, TransferModal } from './modals/TransferModal';
import { GoCardlessModal } from './modals/GoCardlessModal';

const { Content } = AntLayout;

export const Layout = () => {
    const { t } = useTranslation();
    const { notification, message } = App.useApp();
    const [collapsed, setCollapsed] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [totalBalance, setTotalBalance] = useState<number>(0);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    // GoCardless states
    const [isGoCardlessModalOpen, setIsGoCardlessModalOpen] = useState(false);
    const [linkingAccount, setLinkingAccount] = useState<Account | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [banks, setBanks] = useState<GoCardlessBank[]>([]);
    const [loadingBanks, setLoadingBanks] = useState(false);
    const [selectedBank, setSelectedBank] = useState<string | null>(null);
    const [syncingAccounts, setSyncingAccounts] = useState(false);

    const { isMobile, isSmallMobile } = useBreakpoints();
    const { auth, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const {
        token: { colorBgContainer, borderRadiusLG, colorTextSecondary },
    } = theme.useToken();

    // Focus management: restore focus to toggle when drawer closes
    const menuToggleRef = useRef<HTMLButtonElement | null>(null);
    const prevCollapsedRef = useRef(collapsed);

    const triggerTransactionRefresh = () => {
        setTransactionRefreshKey(prev => prev + 1);
    };

    useEffect(() => {
        setSelectedKeys([location.pathname]);
    }, [location.pathname]);

    const fetchAccounts = (background = false) => {
        if (auth) {
            if (!background) setLoading(true);
            return Promise.all([api.getAccounts(), api.getTotalPreferredBalance()])
                .then(([acctResponse, balanceResponse]) => {
                    setAccounts(acctResponse.data);
                    setTotalBalance(balanceResponse.data);
                    return acctResponse.data;
                })
                .catch(error => {
                    console.error(error);
                    throw error;
                })
                .finally(() => {
                    if (!background) setLoading(false);
                });
        } else {
            setAccounts([]);
            setTotalBalance(0);
            return Promise.resolve([]);
        }
    };

    const fetchCategories = () => {
        if (auth) {
            api.getCategories()
                .then(response => setCategories(Array.isArray(response.data) ? response.data : []))
                .catch(console.error);
        } else {
            setCategories([]);
        }
    };

    useEffect(() => {
        fetchAccounts();
        fetchCategories();
    }, [auth]);

    // Banner aggiornamento PWA — sostituisce window.confirm con una notifica AntD
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

    // Polling per aggiornare lo stato di sincronizzazione.
    // Dipende solo da isSyncing (boolean), non dall'intero array accounts,
    // così l'interval non riparte ad ogni refetch.
    const isSyncing = accounts.some(acc => acc.synchronizing);
    const fetchAccountsRef = useRef(fetchAccounts);
    useEffect(() => { fetchAccountsRef.current = fetchAccounts; });

    useEffect(() => {
        if (!isSyncing) return;
        const id = setInterval(() => {
            if (!document.hidden) fetchAccountsRef.current(true);
        }, 10000);
        return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSyncing]);

    // Rileva la fine della sincronizzazione (quando isSyncing passa da true a false)
    const prevSyncingRef = useRef(isSyncing);
    useEffect(() => {
        if (prevSyncingRef.current && !isSyncing) {
            triggerTransactionRefresh();
            notification.success({
                message: t('transactions.syncSuccessTitle'),
                description: t('transactions.syncSuccessDescription'),
                placement: 'topRight',
                duration: 5,
            });
        }
        prevSyncingRef.current = isSyncing;
    }, [isSyncing, t, notification]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleOpenCreateAccountModal = () => {
        setEditingAccount(null);
        setIsAccountModalOpen(true);
        if (isMobile) setCollapsed(true);
    };

    const handleOpenEditAccountModal = (account: Account) => {
        setEditingAccount(account);
        setIsAccountModalOpen(true);
        if (isMobile) setCollapsed(true);
    };

    const handleCancelAccountModal = () => {
        setIsAccountModalOpen(false);
        setEditingAccount(null);
    };

    const onFinishAccount = async (values: AccountRequest) => {
        try {
            if (editingAccount) {
                await api.updateAccount(editingAccount.id, values);
                message.success(t('accounts.updatedSuccess'));
            } else {
                await api.createAccount(values);
                message.success(t('accounts.createdSuccess'));
            }
            setIsAccountModalOpen(false);
            fetchAccounts();
        } catch (error) {
            message.error(t('accounts.saveError'));
            console.error(error);
        }
    };

    const handleOpenDeleteModal = (account: Account) => {
        setDeletingAccount(account);
        setIsDeleteModalOpen(true);
        if (isMobile) setCollapsed(true);
    };

    const handleCancelDeleteModal = () => {
        setDeletingAccount(null);
        setIsDeleteModalOpen(false);
    };

    const handleConfirmDelete = async () => {
        if (!deletingAccount) return;
        try {
            await api.deleteAccount(deletingAccount.id);
            message.success(t('accounts.deletedSuccess'));
            fetchAccounts();
            navigate('/transactions');
        } catch (error) {
            message.error(t('accounts.deleteError'));
            console.error(error);
        } finally {
            handleCancelDeleteModal();
        }
    };

    const handleOpenTransferModal = () => {
        setIsTransferModalOpen(true);
    };

    const handleCancelTransferModal = () => {
        setIsTransferModalOpen(false);
    };

    const onFinishTransfer = async (values: TransferFormValues) => {
        const transferData: TransferRequest = {
            ...values,
            transferDate: values.transferDate ? values.transferDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        };
        try {
            await api.createTransfer(transferData);
            message.success(t('transfers.createdSuccess'));
            setIsTransferModalOpen(false);
            fetchAccounts();
            triggerTransactionRefresh();
        } catch (error) {
            message.error(t('transfers.createError'));
            console.error(error);
        }
    };

    // GoCardless handlers
    const handleOpenGoCardlessModal = (account: Account) => {
        setLinkingAccount(account);
        setCurrentStep(0);
        setSelectedCountry(null);
        setBanks([]);
        setSelectedBank(null);
        setIsGoCardlessModalOpen(true);
        if (isMobile) setCollapsed(true);
    };

    const handleCancelGoCardlessModal = () => {
        setIsGoCardlessModalOpen(false);
        setLinkingAccount(null);
        setCurrentStep(0);
        setSelectedCountry(null);
        setBanks([]);
        setSelectedBank(null);
    };

    const handleCountrySelect = async (countryCode: string) => {
        setSelectedCountry(countryCode);
        setLoadingBanks(true);
        try {
            const response = await api.getGoCardlessBankList(countryCode);
            setBanks(response.data);
            setCurrentStep(1);
        } catch (error) {
            message.error(t('gocardless.loadBanksError'));
            console.error(error);
        } finally {
            setLoadingBanks(false);
        }
    };

    const handleBankSelect = (bankId: string) => {
        setSelectedBank(bankId);
    };

    const handleConfirmBankLink = async () => {
        if (!selectedBank || !linkingAccount) return;

        try {
            const response = await api.getGoCardlessBankLink({
                institutionId: selectedBank,
                localAccountId: linkingAccount.id
            });

            // Redirect al link fornito da GoCardless
            window.location.href = response.data;

            handleCancelGoCardlessModal();
        } catch (error) {
            message.error(t('gocardless.linkError'));
            console.error(error);
        }
    };

    const handleSyncAllAccounts = async () => {
        // Filtra solo i conti correnti collegati a GoCardless
        const syncableAccounts = accounts.filter(
            acc => acc.type === 'CONTO_CORRENTE' && acc.linkedToExternal
        );

        if (syncableAccounts.length === 0) {
            message.info(t('gocardless.noAccountsToSync'));
            return;
        }

        setSyncingAccounts(true);

        try {
            // Sincronizza tutti i conti in parallelo
            const syncPromises = syncableAccounts.map(account =>
                api.syncGoCardlessBankAccount(account.id, { actualBalance: null })
                    .then(() => ({ success: true, accountName: account.name }))
                    .catch(error => ({ success: false, accountName: account.name, error }))
            );

            const results = await Promise.all(syncPromises);

            // Conta successi e fallimenti
            const successCount = results.filter(r => r.success).length;
            const failureCount = results.filter(r => !r.success).length;

            if (failureCount === 0) {
                message.success(t('gocardless.syncSuccessAll', { count: successCount }));
            } else if (successCount === 0) {
                message.error(t('gocardless.syncErrorAll', { count: failureCount }));
            } else {
                message.warning(t('gocardless.syncPartial', { successCount, failureCount }));
            }

            // Aggiorna gli account e le transazioni anche in caso di errori parziali
            fetchAccounts();
            triggerTransactionRefresh();
        } catch (error) {
            message.error(t('gocardless.syncError'));
            console.error(error);
        } finally {
            setSyncingAccounts(false);
        }
    };


    if (!auth) {
        return <Outlet context={{
            accounts: [],
            fetchAccounts: () => Promise.resolve([]),
            transactionRefreshKey: 0,
            categories: [],
            fetchCategories: () => {},
            handleOpenTransferModal: () => {},
            onOpenCreateAccount: () => {},
        }} />;
    }

    return (
        <>
            {/* Skip-to-content link — visibile solo al focus da tastiera */}
            <a
                href="#main"
                style={{
                    position: 'absolute',
                    top: -40,
                    left: 0,
                    padding: '8px 16px',
                    background: colorBgContainer,
                    zIndex: 9999,
                    borderRadius: '0 0 4px 0',
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
                    loading={loading}
                    totalBalance={totalBalance}
                    selectedKeys={selectedKeys}
                    onOpenCreateAccount={handleOpenCreateAccountModal}
                    onOpenEditAccount={handleOpenEditAccountModal}
                    onOpenDeleteAccount={handleOpenDeleteModal}
                    onOpenGoCardless={handleOpenGoCardlessModal}
                    onSyncAllAccounts={handleSyncAllAccounts}
                    syncingAccounts={syncingAccounts}
                />
                <AntLayout
                    className="site-layout"
                    style={{
                        marginLeft: isMobile ? 0 : (collapsed ? 0 : 300),
                        transition: 'all 0.2s'
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
                            margin: isMobile ? '16px 8px' : '24px 16px',
                            minHeight: 280,
                            overflow: 'auto',
                        }}
                    >
                        <main
                            id="main"
                            style={{
                                padding: isMobile ? 12 : 24,
                                paddingBottom: isSmallMobile ? 'calc(72px + env(safe-area-inset-bottom, 0px))' : (isMobile ? 12 : 24),
                                minHeight: 280,
                                background: colorBgContainer,
                                borderRadius: borderRadiusLG,
                            }}
                        >
                            <Outlet context={{
                                accounts,
                                fetchAccounts,
                                transactionRefreshKey,
                                categories,
                                fetchCategories,
                                handleOpenTransferModal,
                                onOpenCreateAccount: handleOpenCreateAccountModal,
                            }} />
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
                />
            )}

            {isDeleteModalOpen && (
                <Modal
                    title={t('accounts.deleteTitle')}
                    open={isDeleteModalOpen}
                    onOk={handleConfirmDelete}
                    onCancel={handleCancelDeleteModal}
                    okText={t('common.delete')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true }}
                >
                    <p>{t('accounts.deleteConfirm', { name: deletingAccount?.name ?? '' })}</p>
                    <p style={{ color: colorTextSecondary }}>{t('accounts.deleteConfirmWarning')}</p>
                </Modal>
            )}

            {isTransferModalOpen && (
                <TransferModal
                    open={isTransferModalOpen}
                    onCancel={handleCancelTransferModal}
                    onFinish={onFinishTransfer}
                    accounts={accounts}
                />
            )}

            {isGoCardlessModalOpen && (
                <GoCardlessModal
                    open={isGoCardlessModalOpen}
                    onCancel={handleCancelGoCardlessModal}
                    account={linkingAccount}
                    currentStep={currentStep}
                    selectedCountry={selectedCountry}
                    banks={banks}
                    loadingBanks={loadingBanks}
                    selectedBank={selectedBank}
                    onCountrySelect={handleCountrySelect}
                    onBankSelect={handleBankSelect}
                    onConfirm={handleConfirmBankLink}
                />
            )}

            {/* PWA Install Prompt */}
            <PWAInstallPrompt />

            <BottomNavBar />
        </>
    );
};

