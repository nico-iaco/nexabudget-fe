// src/components/Layout.tsx
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    Layout as AntLayout,
    Menu,
    Button,
    theme,
    Spin,
    Typography,
    Flex,
    Modal,
    Form,
    Input,
    Select,
    InputNumber,
    Space,
    message,
    DatePicker
} from 'antd';
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    LogoutOutlined,
    WalletOutlined,
    SwapOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../services/api';
import type { Account, AccountRequest, Category, TransferRequest } from '../types/api';
import dayjs, { type Dayjs } from 'dayjs';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;
const { Option } = Select;

interface TransferFormValues {
    sourceAccountId: number;
    destinationAccountId: number;
    amount: number;
    description: string;
    transferDate?: Dayjs | null;
    notes?: string;
}

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
    const { auth, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [accountForm] = Form.useForm<AccountRequest>();
    const [transferForm] = Form.useForm<TransferFormValues>();

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
        accountForm.resetFields();
        setIsAccountModalOpen(true);
    };

    const handleOpenEditAccountModal = (account: Account) => {
        setEditingAccount(account);
        accountForm.setFieldsValue(account);
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
            } else {
                await api.createAccount(values);
            }
            setIsAccountModalOpen(false);
            fetchAccounts();
            triggerTransactionRefresh();
        } catch (error) {
            console.error("Failed to save account", error);
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
            setIsDeleteModalOpen(false);
            fetchAccounts();
            if (location.pathname.startsWith(`/accounts/${deletingAccount.id}`)) {
                navigate('/transactions');
            } else {
                triggerTransactionRefresh();
            }
        } catch (error) {
            console.error("Failed to delete account", error);
        } finally {
            setDeletingAccount(null);
        }
    };

    const handleOpenTransferModal = () => {
        transferForm.resetFields();
        transferForm.setFieldsValue({ transferDate: dayjs() });
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
            setIsTransferModalOpen(false);
            fetchAccounts();
            triggerTransactionRefresh();
            message.success('Trasferimento creato con successo!');
        } catch (error) {
            console.error("Failed to create transfer", error);
            message.error('Errore durante la creazione del trasferimento.');
        }
    };

    const handleMenuClick = (path: string) => {
        const targetPath = selectedKeys.includes(path) ? '/transactions' : path;
        navigate(targetPath);
        if (isMobile) {
            setCollapsed(true);
        }
    };

    const accountMenuItems = accounts.map(acc => {
        const path = `/accounts/${acc.id}/transactions`;
        return {
            key: path,
            icon: <WalletOutlined />,
            label: (
                <Flex justify="space-between" align="center">
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {acc.name}
                    </span>
                    <Space>
                        <Button type="text" size="small" icon={<EditOutlined style={{ color: 'rgba(255, 255, 255, 0.85)' }} />} onClick={(e) => { e.stopPropagation(); handleOpenEditAccountModal(acc); }} />
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal(acc); }} />
                    </Space>
                </Flex>
            ),
            onClick: () => handleMenuClick(path),
        };
    });

    if (!auth) {
        return <Outlet context={{ accounts: [], fetchAccounts: () => {}, transactionRefreshKey: 0, categories: [], fetchCategories: () => {}, handleOpenTransferModal: () => {} }} />;
    }

    return (
        <>
            <AntLayout style={{ minHeight: '100vh' }}>
                <Sider
                    trigger={null}
                    collapsible
                    collapsed={collapsed}
                    width={250}
                    breakpoint="lg"
                    collapsedWidth={0}
                    onBreakpoint={broken => {
                        setIsMobile(broken);
                        setCollapsed(broken);
                    }}
                    onCollapse={(isCollapsed) => setCollapsed(isCollapsed)}
                    style={isMobile ? { position: 'fixed', zIndex: 1001, height: '100vh' } : {}}
                >
                    <div className="demo-logo-vertical" style={{height: '32px', margin: '16px'}} />
                    <Menu
                        theme="dark"
                        mode="inline"
                        selectedKeys={selectedKeys}
                        items={[
                            {
                                key: '/transactions',
                                icon: <SwapOutlined />,
                                label: 'Tutte le Transazioni',
                                onClick: () => handleMenuClick('/transactions'),
                            },
                        ]}
                    />
                    <Flex vertical style={{padding: '0 8px'}}>
                        <Title level={5} style={{ color: 'rgba(255, 255, 255, 0.65)', padding: '16px' }}>Conti</Title>
                        <Space direction="vertical" style={{width: '100%', padding: '0 8px 16px'}}>
                            <Button type="primary" icon={<PlusOutlined />} block onClick={handleOpenCreateAccountModal}>
                                Nuovo Conto
                            </Button>
                        </Space>
                    </Flex>
                    {loading ? <Spin style={{padding: '20px'}}/> : <Menu theme="dark" mode="inline" selectedKeys={selectedKeys} items={accountMenuItems} />}
                </Sider>
                <AntLayout className="site-layout">
                    <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button
                            type="text"
                            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setCollapsed(!collapsed)}
                            style={{ fontSize: '16px', width: 64, height: 64 }}
                        />
                        <div style={{flex: 1}} />
                        <Button type="primary" icon={<LogoutOutlined />} onClick={handleLogout}>
                            Logout
                        </Button>
                    </Header>
                    <Content
                        style={{
                            margin: '24px 16px',
                            padding: 24,
                            minHeight: 280,
                            background: colorBgContainer,
                            borderRadius: borderRadiusLG,
                        }}
                    >
                        <Outlet context={{ accounts, fetchAccounts, transactionRefreshKey, categories, fetchCategories, handleOpenTransferModal }} />
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

            <Modal title={editingAccount ? "Modifica Conto" : "Nuovo Conto"} open={isAccountModalOpen} onCancel={handleCancelAccountModal} footer={null}>
                <Form form={accountForm} layout="vertical" onFinish={onFinishAccount} style={{marginTop: 24}} initialValues={{ currency: 'EUR' }}>
                    <Form.Item name="name" label="Nome Conto" rules={[{ required: true, message: 'Inserisci il nome del conto' }]}>
                        <Input placeholder="Es. Conto Principale" />
                    </Form.Item>
                    <Form.Item name="type" label="Tipo di Conto" rules={[{ required: true, message: 'Seleziona il tipo di conto' }]}>
                        <Select placeholder="Seleziona un tipo">
                            <Option value="CONTO_CORRENTE">Conto Corrente</Option>
                            <Option value="RISPARMIO">Risparmio</Option>
                            <Option value="INVESTIMENTO">Investimento</Option>
                            <Option value="CONTANTI">Contanti</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="starterBalance" label="Saldo Iniziale" initialValue={0} rules={[{ required: true, message: 'Inserisci il saldo iniziale' }]}>
                        <InputNumber style={{ width: '100%' }} min={0} addonAfter="€" disabled={!!editingAccount} />
                    </Form.Item>
                    <Form.Item name="currency" label="Valuta" rules={[{ required: true, message: 'Inserisci la valuta' }]}>
                        <Input placeholder="Es. EUR" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>Salva Conto</Button>
                    </Form.Item>
                </Form>
            </Modal>

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

            {/* Modale per il Trasferimento */}
            <Modal title="Nuovo Trasferimento" open={isTransferModalOpen} onCancel={handleCancelTransferModal} footer={null}>
                <Form form={transferForm} layout="vertical" onFinish={onFinishTransfer} style={{ marginTop: 24 }} initialValues={{ transferDate: dayjs() }}>
                    <Form.Item
                        name="sourceAccountId"
                        label="Conto di Origine"
                        rules={[{ required: true, message: 'Seleziona il conto di origine' }]}
                    >
                        <Select placeholder="Da quale conto?">
                            {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="destinationAccountId"
                        label="Conto di Destinazione"
                        rules={[
                            { required: true, message: 'Seleziona il conto di destinazione' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('sourceAccountId') !== value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Il conto di destinazione deve essere diverso da quello di origine.'));
                                },
                            }),
                        ]}
                    >
                        <Select placeholder="A quale conto?">
                            {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="amount" label="Importo" rules={[{ required: true, message: 'Inserisci l\'importo' }]}>
                        <InputNumber style={{ width: '100%' }} min={0.01} addonAfter="€" />
                    </Form.Item>
                    <Form.Item name="transferDate" label="Data del Trasferimento" rules={[{ required: true, message: 'Seleziona la data' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="description" label="Descrizione" rules={[{ required: true, message: 'Inserisci una descrizione' }]}>
                        <Input placeholder="Es. Giroconto" />
                    </Form.Item>
                    <Form.Item name="notes" label="Note">
                        <Input.TextArea placeholder="Note aggiuntive (opzionale)" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>Esegui Trasferimento</Button>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};
