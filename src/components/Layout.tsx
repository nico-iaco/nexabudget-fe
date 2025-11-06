// src/components/Layout.tsx
import {useEffect, useMemo, useState} from 'react';
import {Outlet, useLocation, useNavigate} from 'react-router-dom';
import {
    Button,
    DatePicker,
    Flex,
    Form,
    Input,
    InputNumber,
    Layout as AntLayout,
    Menu,
    message,
    Modal,
    Select,
    Space,
    Spin,
    Statistic,
    Steps,
    theme,
    Typography
} from 'antd';
import {
    DeleteOutlined,
    DisconnectOutlined,
    EditOutlined,
    LinkOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    PieChartOutlined,
    PlusOutlined,
    TransactionOutlined,
    WalletOutlined
} from '@ant-design/icons';
import {useAuth} from '../contexts/AuthContext';
import * as api from '../services/api';
import type {Account, AccountRequest, Category, GoCardlessBank, TransferRequest} from '../types/api';
import dayjs, {type Dayjs} from 'dayjs';
import {europeanCountries} from '../utils/countries';

const {Header, Sider, Content} = AntLayout;
const {Title, Text} = Typography;
const {Option} = Select;

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

    // GoCardless states
    const [isGoCardlessModalOpen, setIsGoCardlessModalOpen] = useState(false);
    const [linkingAccount, setLinkingAccount] = useState<Account | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [banks, setBanks] = useState<GoCardlessBank[]>([]);
    const [loadingBanks, setLoadingBanks] = useState(false);
    const [selectedBank, setSelectedBank] = useState<string | null>(null);

    const {auth, logout} = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [accountForm] = Form.useForm<AccountRequest>();
    const [transferForm] = Form.useForm<TransferFormValues>();

    const {
        token: {colorBgContainer, borderRadiusLG},
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
        transferForm.resetFields();
        transferForm.setFieldsValue({transferDate: dayjs()});
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

    const handleMenuClick = (path: string) => {
        const targetPath = selectedKeys.includes(path) ? '/transactions' : path;
        navigate(targetPath);
        if (isMobile) {
            setCollapsed(true);
        }
    };

    const totalBalance = useMemo(() => {
        return accounts.reduce((sum, account) => sum + account.actualBalance, 0);
    }, [accounts]);

    const accountMenuItems = accounts.map(acc => {
        const path = `/accounts/${acc.id}/transactions`;
        const isConnectedToGoCardless = acc.linkedToExternal;
        const isCheckingAccount = acc.type === 'CONTO_CORRENTE';

        return {
            key: path,
            icon: <WalletOutlined/>,
            label: (
                <Flex justify="space-between" align="center">
                    <span style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>{acc.name}</span>
                    <Text style={{
                        fontSize: '0.9em',
                        marginLeft: 8,
                        color: 'rgba(255, 255, 255, 0.85)'
                    }}>{acc.actualBalance.toFixed(2)}€</Text>
                    <Space style={{marginLeft: 16}}>
                        {isCheckingAccount && (
                            isConnectedToGoCardless ? (
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<DisconnectOutlined style={{color: 'rgba(255, 255, 255, 0.85)'}}/>}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // TODO: implementare handleDisconnectGoCardless(acc)
                                        message.info('Funzione di scollegamento da implementare');
                                    }}
                                />
                            ) : (
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<LinkOutlined style={{color: 'rgba(255, 255, 255, 0.85)'}}/>}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenGoCardlessModal(acc);
                                    }}
                                />
                            )
                        )}
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined style={{color: 'rgba(255, 255, 255, 0.85)'}}/>}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditAccountModal(acc);
                            }}
                        />
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined/>}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDeleteModal(acc);
                            }}
                        />
                    </Space>
                </Flex>
            ),
            onClick: () => handleMenuClick(path),
        };
    });


    if (!auth) {
        return <Outlet context={{
            accounts: [], fetchAccounts: () => {
            }, transactionRefreshKey: 0, categories: [], fetchCategories: () => {
            }, handleOpenTransferModal: () => {
            }
        }}/>;
    }

    return (
        <>
            <AntLayout style={{minHeight: '100vh'}}>
                <Sider
                    trigger={null}
                    collapsible
                    collapsed={collapsed}
                    width={300}
                    breakpoint="lg"
                    collapsedWidth={0}
                    onBreakpoint={broken => {
                        setIsMobile(broken);
                        setCollapsed(broken);
                    }}
                    onCollapse={(isCollapsed) => setCollapsed(isCollapsed)}
                    style={isMobile ? {position: 'fixed', zIndex: 1001, height: '100vh'} : {}}
                >
                    <div className="demo-logo-vertical" style={{height: '32px', margin: '16px'}}/>
                    <Menu
                        theme="dark"
                        mode="inline"
                        selectedKeys={selectedKeys}
                        items={[
                            {
                                key: '/dashboard',
                                icon: <PieChartOutlined/>,
                                label: 'Dashboard',
                                onClick: () => navigate('/dashboard')
                            },
                            {
                                key: '/transactions',
                                icon: <TransactionOutlined/>,
                                label: 'Tutte le Transazioni',
                                onClick: () => navigate('/transactions')
                            },
                        ]}
                    />
                    <Flex vertical style={{padding: '0 8px'}}>
                        <Flex justify="space-between" align="center" style={{padding: '16px 16px 8px'}}>
                            <Title level={5} style={{color: 'rgba(255, 255, 255, 0.65)', margin: 0}}>Conti</Title>
                            <Button icon={<PlusOutlined/>} size="small" onClick={handleOpenCreateAccountModal}/>
                        </Flex>
                        <div style={{padding: '0 16px 16px'}}>
                            <Statistic
                                title={<Text style={{color: 'rgba(255, 255, 255, 0.45)'}}>Bilancio Totale</Text>}
                                value={totalBalance}
                                precision={2}
                                valueStyle={{color: '#fff'}}
                                suffix="€"
                            />
                        </div>
                    </Flex>
                    {loading ? <Spin style={{padding: '20px'}}/> :
                        <Menu theme="dark" mode="inline" selectedKeys={selectedKeys} items={accountMenuItems}/>}
                </Sider>
                <AntLayout className="site-layout">
                    <Header style={{
                        padding: '0 16px',
                        background: colorBgContainer,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <Button
                            type="text"
                            icon={collapsed ? <MenuUnfoldOutlined/> : <MenuFoldOutlined/>}
                            onClick={() => setCollapsed(!collapsed)}
                            style={{fontSize: '16px', width: 64, height: 64}}
                        />
                        <div style={{flex: 1}}/>
                        <Button type="primary" icon={<LogoutOutlined/>} onClick={handleLogout}>
                            {!isMobile && 'Logout'}
                        </Button>
                    </Header>
                    <Content
                        style={{
                            margin: '24px 16px',
                            padding: 24,
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
                        }}/>
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

            <Modal title={editingAccount ? "Modifica Conto" : "Nuovo Conto"} open={isAccountModalOpen}
                   onCancel={handleCancelAccountModal} footer={null}>
                <Form form={accountForm} layout="vertical" onFinish={onFinishAccount} style={{marginTop: 24}}
                      initialValues={{currency: 'EUR'}}>
                    <Form.Item name="name" label="Nome Conto"
                               rules={[{required: true, message: 'Inserisci il nome del conto'}]}>
                        <Input placeholder="Es. Conto Principale"/>
                    </Form.Item>
                    <Form.Item name="type" label="Tipo di Conto"
                               rules={[{required: true, message: 'Seleziona il tipo di conto'}]}>
                        <Select placeholder="Seleziona un tipo">
                            <Option value="CONTO_CORRENTE">Conto Corrente</Option>
                            <Option value="RISPARMIO">Risparmio</Option>
                            <Option value="INVESTIMENTO">Investimento</Option>
                            <Option value="CONTANTI">Contanti</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="starterBalance" label="Saldo Iniziale" initialValue={0}
                               rules={[{required: true, message: 'Inserisci il saldo iniziale'}]}>
                        <InputNumber style={{width: '100%'}} min={0} addonAfter="€" disabled={!!editingAccount}/>
                    </Form.Item>
                    <Form.Item name="currency" label="Valuta"
                               rules={[{required: true, message: 'Inserisci la valuta'}]}>
                        <Input placeholder="Es. EUR"/>
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
                okButtonProps={{danger: true}}
            >
                <p>Sei sicuro di voler eliminare il conto "{deletingAccount?.name}"?</p>
                <p>Questa azione è irreversibile e cancellerà anche tutte le transazioni associate.</p>
            </Modal>

            <Modal title="Nuovo Trasferimento" open={isTransferModalOpen} onCancel={handleCancelTransferModal}
                   footer={null}>
                <Form form={transferForm} layout="vertical" onFinish={onFinishTransfer} style={{marginTop: 24}}
                      initialValues={{transferDate: dayjs()}}>
                    <Form.Item
                        name="sourceAccountId"
                        label="Conto di Origine"
                        rules={[{required: true, message: 'Seleziona il conto di origine'}]}
                    >
                        <Select placeholder="Da quale conto?">
                            {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="destinationAccountId"
                        label="Conto di Destinazione"
                        rules={[
                            {required: true, message: 'Seleziona il conto di destinazione'},
                            ({getFieldValue}) => ({
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
                    <Form.Item name="amount" label="Importo"
                               rules={[{required: true, message: 'Inserisci l\'importo'}]}>
                        <InputNumber style={{width: '100%'}} min={0.01} addonAfter="€"/>
                    </Form.Item>
                    <Form.Item name="transferDate" label="Data del Trasferimento"
                               rules={[{required: true, message: 'Seleziona la data'}]}>
                        <DatePicker style={{width: '100%'}}/>
                    </Form.Item>
                    <Form.Item name="description" label="Descrizione"
                               rules={[{required: true, message: 'Inserisci una descrizione'}]}>
                        <Input placeholder="Es. Giroconto"/>
                    </Form.Item>
                    <Form.Item name="notes" label="Note">
                        <Input.TextArea placeholder="Note aggiuntive (opzionale)"/>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>Esegui Trasferimento</Button>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modale GoCardless */}
            <Modal
                title={`Collega "${linkingAccount?.name}" a GoCardless`}
                open={isGoCardlessModalOpen}
                onCancel={handleCancelGoCardlessModal}
                footer={[
                    <Button key="back" onClick={handleCancelGoCardlessModal}>Annulla</Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={handleConfirmBankLink}
                        disabled={!selectedBank}
                    >
                        Collega Banca
                    </Button>,
                ]}
                width={700}
            >
                <Steps
                    current={currentStep}
                    style={{marginBottom: 24}}
                    items={[
                        {title: 'Seleziona Nazione'},
                        {title: 'Seleziona Banca'},
                    ]}
                />

                {currentStep === 0 && (
                    <Form layout="vertical">
                        <Form.Item label="Seleziona la tua nazione">
                            <Select
                                showSearch
                                placeholder="Seleziona una nazione"
                                onChange={handleCountrySelect}
                                value={selectedCountry}
                                loading={loadingBanks}
                                filterOption={(input, option) =>
                                    (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            >
                                {europeanCountries.map(country => (
                                    <Option key={country.code} value={country.code} label={country.name}>
                                        {country.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Form>
                )}

                {currentStep === 1 && (
                    <Form layout="vertical">
                        <Form.Item label="Seleziona la tua banca">
                            {loadingBanks ? (
                                <Spin/>
                            ) : (
                                <Select
                                    showSearch
                                    placeholder="Seleziona una banca"
                                    onChange={handleBankSelect}
                                    value={selectedBank}
                                    filterOption={(input, option) =>
                                        (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                >
                                    {banks.map(bank => (
                                        <Option key={bank.id} value={bank.id} label={bank.name}>
                                            <Flex align="center" gap="small">
                                                {bank.logo && (
                                                    <img
                                                        src={bank.logo}
                                                        alt={bank.name}
                                                        style={{width: 24, height: 24, objectFit: 'contain'}}
                                                    />
                                                )}
                                                <span>{bank.name}</span>
                                            </Flex>
                                        </Option>
                                    ))}
                                </Select>
                            )}
                        </Form.Item>
                    </Form>
                )}
            </Modal>
        </>
    );
};
