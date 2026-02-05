// src/components/Layout.tsx
import {useEffect, useMemo, useState} from 'react';
import {Outlet, useLocation, useNavigate} from 'react-router-dom';
import {Layout as AntLayout, message, Modal, theme} from 'antd';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../contexts/AuthContext';
import * as api from '../services/api';
import type {Account, AccountRequest, Category, GoCardlessBank, TransferRequest} from '../types/api';
import dayjs from 'dayjs';
import {PWAInstallPrompt} from './PWAInstallPrompt';
import {AppSider} from './layout/AppSider';
import {AppHeader} from './layout/AppHeader';
import {AccountModal} from './modals/AccountModal';
import {type TransferFormValues, TransferModal} from './modals/TransferModal';
import {GoCardlessModal} from './modals/GoCardlessModal';

const { Content } = AntLayout;

export const Layout = () => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
    const [accounts, setAccounts] = useState<Account[]>([]);
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

    const { auth, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    const triggerTransactionRefresh = () => {
        setTransactionRefreshKey(prev => prev + 1);
    };

    useEffect(() => {
        setSelectedKeys([location.pathname]);
    }, [location.pathname]);

    const fetchAccounts = () => {
        if (auth) {
            setLoading(true);
            api.getAccounts()
                .then(response => setAccounts(response.data))
                .catch(console.error)
                .finally(() => setLoading(false));
        } else {
            setAccounts([]);
        }
    };

    const fetchCategories = () => {
        if (auth) {
            api.getCategories()
                .then(response => setCategories(response.data))
                .catch(console.error);
        } else {
            setCategories([]);
        }
    };

    useEffect(() => {
        fetchAccounts();
        fetchCategories();
    }, [auth]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleOpenCreateAccountModal = () => {
        setEditingAccount(null);
        setIsAccountModalOpen(true);
    };

    const handleOpenEditAccountModal = (account: Account) => {
        setEditingAccount(account);
        setIsAccountModalOpen(true);
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

    const totalBalance = useMemo(() => {
        return accounts.reduce((sum, account) => sum + account.actualBalance, 0);
    }, [accounts]);


    if (!auth) {
        return <Outlet context={{
            accounts: [], fetchAccounts: () => {
            }, transactionRefreshKey: 0, categories: [], fetchCategories: () => {
            }, handleOpenTransferModal: () => {
            }
        }} />;
    }

    return (
        <>
            <AntLayout style={{ minHeight: '100vh' }}>
                <AppSider
                    collapsed={collapsed}
                    setCollapsed={setCollapsed}
                    isMobile={isMobile}
                    setIsMobile={setIsMobile}
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
                <AntLayout className="site-layout">
                    <AppHeader
                        collapsed={collapsed}
                        setCollapsed={setCollapsed}
                        isMobile={isMobile}
                        onLogout={handleLogout}
                    />
                    <Content
                        style={{
                            margin: isMobile ? '16px 8px' : '24px 16px',
                            padding: isMobile ? 12 : 24,
                            minHeight: 280,
                            background: colorBgContainer,
                            borderRadius: borderRadiusLG,
                            overflow: 'auto'
                        }}
                    >
                        <Outlet context={{
                            accounts,
                            fetchAccounts,
                            transactionRefreshKey,
                            categories,
                            fetchCategories,
                            handleOpenTransferModal
                        }} />
                    </Content>
                </AntLayout>
            </AntLayout>

            {isMobile && !collapsed && (
                <div
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
                />
            )}

            <AccountModal
                open={isAccountModalOpen}
                onCancel={handleCancelAccountModal}
                onFinish={onFinishAccount}
                editingAccount={editingAccount}
            />

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
                <p>{t('accounts.deleteConfirmWarning')}</p>
            </Modal>

            <TransferModal
                open={isTransferModalOpen}
                onCancel={handleCancelTransferModal}
                onFinish={onFinishTransfer}
                accounts={accounts}
            />

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

            {/* PWA Install Prompt */}
            <PWAInstallPrompt />
        </>
    );
};

