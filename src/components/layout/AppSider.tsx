
import {
    Button,
    Flex,
    Layout,
    Menu,
    Spin,
    Statistic,
    Typography
} from 'antd';
import {
    BankOutlined,
    DeleteOutlined,
    DisconnectOutlined,
    EditOutlined,
    FundOutlined,
    LineChartOutlined,
    LinkOutlined,
    MenuFoldOutlined,
    PieChartOutlined,
    PlusOutlined,
    SafetyCertificateOutlined,
    TransactionOutlined,
    WalletOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Account } from '../../types/api';

const { Sider } = Layout;
const { Title, Text } = Typography;

interface AppSiderProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    isMobile: boolean;
    setIsMobile: (isMobile: boolean) => void;
    accounts: Account[];
    loading: boolean;
    totalBalance: number;
    selectedKeys: string[];
    onOpenCreateAccount: () => void;
    onOpenEditAccount: (account: Account) => void;
    onOpenDeleteAccount: (account: Account) => void;
    onOpenGoCardless: (account: Account) => void;
}

export const AppSider = ({
    collapsed,
    setCollapsed,
    isMobile,
    setIsMobile,
    accounts,
    loading,
    totalBalance,
    selectedKeys,
    onOpenCreateAccount,
    onOpenEditAccount,
    onOpenDeleteAccount,
    onOpenGoCardless
}: AppSiderProps) => {
    const navigate = useNavigate();

    const handleMenuClick = (path: string) => {
        const targetPath = selectedKeys.includes(path) ? '/transactions' : path;
        navigate(targetPath);
        if (isMobile) {
            setCollapsed(true);
        }
    };

    const getAccountIcon = (type: Account['type']) => {
        switch (type) {
            case 'CONTO_CORRENTE':
                return <BankOutlined />;
            case 'RISPARMIO':
                return <SafetyCertificateOutlined />;
            case 'INVESTIMENTO':
                return <LineChartOutlined />;
            case 'CONTANTI':
            default:
                return <WalletOutlined />;
        }
    };

    const accountMenuItems = accounts.map(acc => {
        const path = `/accounts/${acc.id}/transactions`;
        const isConnectedToGoCardless = acc.linkedToExternal;
        const isCheckingAccount = acc.type === 'CONTO_CORRENTE';

        return {
            key: path,
            icon: getAccountIcon(acc.type),
            label: (
                <Flex justify="space-between" align="center" wrap="wrap" gap="small">
                    <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{
                            color: 'rgba(255, 255, 255, 0.85)',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {acc.name}
                        </Text>
                        <Text style={{
                            fontSize: '0.85em',
                            color: 'rgba(255, 255, 255, 0.65)'
                        }}>
                            {acc.actualBalance.toFixed(2)}€
                        </Text>
                    </Flex>
                    <SpaceButtons
                        isCheckingAccount={isCheckingAccount}
                        isConnectedToGoCardless={isConnectedToGoCardless}
                        onDisconnect={(e) => {
                            e.stopPropagation();
                            // message.info('Disconnect feature coming soon'); // Handled in parent or here? 
                            // Let's keep logic simple here
                        }}
                        onConnect={(e) => {
                            e.stopPropagation();
                            onOpenGoCardless(acc);
                        }}
                        onEdit={(e) => {
                            e.stopPropagation();
                            onOpenEditAccount(acc);
                        }}
                        onDelete={(e) => {
                            e.stopPropagation();
                            onOpenDeleteAccount(acc);
                        }}
                    />
                </Flex>
            ),
            onClick: () => handleMenuClick(path),
        };
    });

    return (
        <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            width={isMobile ? '100%' : 300}
            breakpoint="lg"
            collapsedWidth={0}
            onBreakpoint={broken => {
                setIsMobile(broken);
                setCollapsed(broken);
            }}
            onCollapse={(isCollapsed) => setCollapsed(isCollapsed)}
            style={isMobile ? { position: 'fixed', zIndex: 1001, height: '100vh', width: '100%' } : {}}
        >
            {isMobile && !collapsed && (
                <Flex justify="space-between" align="center" style={{ padding: '16px', background: '#001529' }}>
                    <Title level={4} style={{ color: '#fff', margin: 0 }}>Menu</Title>
                    <Button
                        type="text"
                        icon={<MenuFoldOutlined style={{ color: '#fff', fontSize: '20px' }} />}
                        onClick={() => setCollapsed(true)}
                        size="large"
                    />
                </Flex>
            )}
            {!isMobile && (
                <div style={{ height: '32px', margin: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/pwa-192x192.png" alt="NexaBudget" style={{ height: '32px', width: '32px' }} />
                    <Title level={4} style={{ color: 'white', margin: '0 0 0 10px', fontSize: '18px' }}>NexaBudget</Title>
                </div>
            )}
            <Menu
                theme="dark"
                mode="inline"
                selectedKeys={selectedKeys}
                items={[
                    {
                        key: '/dashboard',
                        icon: <PieChartOutlined />,
                        label: 'Dashboard',
                        onClick: () => {
                            navigate('/dashboard');
                            if (isMobile) setCollapsed(true);
                        }
                    },
                    {
                        key: '/transactions',
                        icon: <TransactionOutlined />,
                        label: 'All Transactions',
                        onClick: () => {
                            navigate('/transactions');
                            if (isMobile) setCollapsed(true);
                        }
                    },
                    {
                        key: '/crypto',
                        icon: <FundOutlined />,
                        label: 'Crypto Assets',
                        onClick: () => {
                            navigate('/crypto');
                            if (isMobile) setCollapsed(true);
                        }
                    },
                ]}
            />
            <Flex vertical style={{ padding: '0 8px' }}>
                <Flex justify="space-between" align="center" style={{ padding: '16px 16px 8px' }}>
                    <Title level={5} style={{ color: 'rgba(255, 255, 255, 0.65)', margin: 0 }}>Accounts</Title>
                    <Button icon={<PlusOutlined />} size="small" onClick={onOpenCreateAccount} />
                </Flex>
                <div style={{ padding: '0 16px 16px' }}>
                    <Statistic
                        title={<Text style={{ color: 'rgba(255, 255, 255, 0.45)' }}>Total Balance</Text>}
                        value={totalBalance}
                        precision={2}
                        valueStyle={{ color: '#fff' }}
                        suffix="€"
                    />
                </div>
            </Flex>
            {loading ? <Spin style={{ padding: '20px' }} /> :
                <Menu theme="dark" mode="inline" selectedKeys={selectedKeys} items={accountMenuItems} />}
        </Sider>
    );
};

// Helper component for buttons to keep JSX clean
const SpaceButtons = ({
    isCheckingAccount,
    isConnectedToGoCardless,
    onDisconnect,
    onConnect,
    onEdit,
    onDelete
}: {
    isCheckingAccount: boolean;
    isConnectedToGoCardless?: boolean;
    onDisconnect: (e: React.MouseEvent) => void;
    onConnect: (e: React.MouseEvent) => void;
    onEdit: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
}) => (
    <Flex gap="small" style={{ marginLeft: 8 }}>
        {isCheckingAccount && (
            isConnectedToGoCardless ? (
                <Button
                    type="text"
                    size="small"
                    icon={<DisconnectOutlined style={{ color: 'rgba(255, 255, 255, 0.85)' }} />}
                    onClick={onDisconnect}
                />
            ) : (
                <Button
                    type="text"
                    size="small"
                    icon={<LinkOutlined style={{ color: 'rgba(255, 255, 255, 0.85)' }} />}
                    onClick={onConnect}
                />
            )
        )}
        <Button
            type="text"
            size="small"
            icon={<EditOutlined style={{ color: 'rgba(255, 255, 255, 0.85)' }} />}
            onClick={onEdit}
        />
        <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={onDelete}
        />
    </Flex>
);
