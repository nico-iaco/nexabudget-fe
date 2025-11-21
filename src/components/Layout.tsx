// src/components/Layout.tsx
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout as AntLayout, message, Modal, theme } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../services/api';
import type { Account, AccountRequest, Category, GoCardlessBank, TransferRequest } from '../types/api';
import dayjs from 'dayjs';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { AppSider } from './layout/AppSider';
import { AppHeader } from './layout/AppHeader';
import { AccountModal } from './modals/AccountModal';
import { TransferModal, type TransferFormValues } from './modals/TransferModal';
import { GoCardlessModal } from './modals/GoCardlessModal';

const { Content } = AntLayout;

export const Layout = () => {
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
                message.success('Conto aggiornato con successo');
            } else {
                await api.createAccount(values);
                message.success('Conto creato con successo');
            }
            setIsAccountModalOpen(false);
            fetchAccounts();
        } catch (error) {
            message.error('Errore durante il salvataggio del conto');
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
            message.success('Conto eliminato con successo');
            fetchAccounts();
            navigate('/transactions');
        } catch (error) {
            message.error('Errore durante l\'eliminazione del conto');
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
            message.success('Trasferimento creato con successo');
            setIsTransferModalOpen(false);
            fetchAccounts();
            triggerTransactionRefresh();
        } catch (error) {
            message.error('Errore durante la creazione del trasferimento');
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
            message.error('Errore nel caricamento delle banche');
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
            message.error('Errore durante la generazione del link di collegamento');
            console.error(error);
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
                title={`Elimina Conto`}
                open={isDeleteModalOpen}
                onOk={handleConfirmDelete}
                onCancel={handleCancelDeleteModal}
                okText="Elimina"
                cancelText="Annulla"
                okButtonProps={{ danger: true }}
            >
                <p>Sei sicuro di voler eliminare il conto "{deletingAccount?.name}"?</p>
                <p>Questa azione è irreversibile e cancellerà anche tutte le transazioni associate.</p>
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

