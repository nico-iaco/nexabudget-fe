import type React from 'react';
import { Button, Dropdown, Flex, Layout, Menu, Spin, Statistic, Tooltip, Typography, theme } from 'antd';
import {
    BankOutlined,
    ContainerOutlined,
    DeleteOutlined,
    DisconnectOutlined,
    EditOutlined,
    EllipsisOutlined,
    ExclamationCircleFilled,
    FundOutlined,
    HistoryOutlined,
    LineChartOutlined,
    LinkOutlined,
    MenuFoldOutlined,
    PieChartOutlined,
    PlusOutlined,
    ReloadOutlined,
    RestOutlined,
    RobotOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    SyncOutlined,
    TransactionOutlined,
    WalletOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Account } from '../../types/api';
import { getCurrencySymbol } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { FONT_SIZE, SIDER_BG, SIDER_TEXT_PRIMARY, SIDER_TEXT_SECONDARY, SPACING } from '../../theme/tokens';
import { NAV_ITEMS } from './navItems';

const { Sider } = Layout;
const { Title, Text } = Typography;

/** Mappa chiave-route → icona per il menu di navigazione principale */
const NAV_ICON_MAP: Record<string, React.ReactNode> = {
    '/dashboard':    <PieChartOutlined />,
    '/transactions': <TransactionOutlined />,
    '/budgets':      <ContainerOutlined />,
    '/crypto':       <FundOutlined />,
    '/trash':        <RestOutlined />,
    '/audit-log':    <HistoryOutlined />,
    '/chat':         <RobotOutlined />,
    '/settings':     <SettingOutlined />,
};

// Definisce l'ordine di priorità per i tipi di account
const ACCOUNT_TYPE_ORDER: Record<Account['type'], number> = {
    CONTO_CORRENTE: 0,
    RISPARMIO: 1,
    INVESTIMENTO: 2,
    CONTANTI: 3,
};

// Funzione helper per ordinare gli account per tipo e poi alfabeticamente
const sortAccounts = (accounts: Account[]): Account[] => {
    return [...accounts].sort((a, b) => {
        // Prima ordina per tipo
        const typeComparison = ACCOUNT_TYPE_ORDER[a.type] - ACCOUNT_TYPE_ORDER[b.type];
        if (typeComparison !== 0) {
            return typeComparison;
        }
        // Poi ordina alfabeticamente per nome (case-insensitive, locale italiana)
        return a.name.localeCompare(b.name, 'it-IT', { sensitivity: 'base' });
    });
};

interface AppSiderProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    isMobile: boolean;
    accounts: Account[];
    loading: boolean;
    totalBalance: number;
    selectedKeys: string[];
    onOpenCreateAccount: () => void;
    onOpenEditAccount: (account: Account) => void;
    onOpenDeleteAccount: (account: Account) => void;
    onOpenGoCardless: (account: Account) => void;
    onSyncAllAccounts: () => void;
    syncingAccounts: boolean;
}

export const AppSider = ({
    collapsed,
    setCollapsed,
    isMobile,
    accounts,
    loading,
    totalBalance,
    selectedKeys,
    onOpenCreateAccount,
    onOpenEditAccount,
    onOpenDeleteAccount,
    onOpenGoCardless,
    onSyncAllAccounts,
    syncingAccounts
}: AppSiderProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { auth } = useAuth();
    const { preferences } = usePreferences();
    const { token } = theme.useToken();

    // In light mode il sider usa il colore di sfondo del layout (chiaro); in dark rimane scuro.
    const isDark = preferences.theme === 'dark';
    const siderMenuTheme = isDark ? 'dark' : 'light';
    const siderBg = isDark ? SIDER_BG : token.colorBgContainer;
    const siderTextPrimary = isDark ? SIDER_TEXT_PRIMARY : token.colorText;
    const siderTextSecondary = isDark ? SIDER_TEXT_SECONDARY : token.colorTextSecondary;

    const handleMenuClick = useCallback((path: string) => {
        const targetPath = selectedKeys.includes(path) ? '/transactions' : path;
        navigate(targetPath);
        if (isMobile) {
            setCollapsed(true);
        }
    }, [selectedKeys, navigate, isMobile, setCollapsed]);

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

    const accountMenuItems = useMemo(() => {
        const sortedAccounts = sortAccounts(accounts);

        return sortedAccounts.map(acc => {
            const path = `/accounts/${acc.id}/transactions`;
            const isConnectedToGoCardless = acc.linkedToExternal;
            const isCheckingAccount = acc.type === 'CONTO_CORRENTE';

            const dropdownItems = [
                ...(isCheckingAccount ? [{
                    key: 'gocardless',
                    icon: isConnectedToGoCardless ? <DisconnectOutlined /> : <LinkOutlined />,
                    label: isConnectedToGoCardless ? t('accounts.disconnectGoCardless') : t('accounts.connectGoCardless'),
                    onClick: () => { if (!isConnectedToGoCardless) onOpenGoCardless(acc); },
                }] : []),
                ...(isConnectedToGoCardless && acc.requiresReauth ? [{
                    key: 'renewConnection',
                    icon: <ReloadOutlined />,
                    label: t('accounts.renewConnection'),
                    onClick: () => onOpenGoCardless(acc),
                }] : []),
                {
                    key: 'edit',
                    icon: <EditOutlined />,
                    label: t('common.edit'),
                    onClick: () => onOpenEditAccount(acc),
                },
                {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    label: t('common.delete'),
                    danger: true,
                    onClick: () => onOpenDeleteAccount(acc),
                },
            ];

            return {
                key: path,
                icon: getAccountIcon(acc.type),
                label: (
                    <Flex justify="space-between" align="center" gap="small">
                        <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                            <Flex align="center" gap={4} style={{ minWidth: 0 }}>
                                <Text style={{
                                    color: siderTextPrimary,
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {acc.name}
                                </Text>
                                {acc.requiresReauth && (
                                    <Tooltip title={t('accounts.requiresReauthTooltip')}>
                                        <ExclamationCircleFilled style={{ color: token.colorError, flexShrink: 0 }} />
                                    </Tooltip>
                                )}
                            </Flex>
                            <Text style={{
                                fontSize: '0.85em',
                                color: acc.requiresReauth ? token.colorError : siderTextSecondary
                            }}>
                                {acc.requiresReauth ? t('accounts.requiresReauthBadge') : `${acc.actualBalance.toFixed(2)} ${getCurrencySymbol(acc.currency)}`}
                            </Text>
                        </Flex>
                        <Dropdown
                            menu={{ items: dropdownItems }}
                            trigger={['click']}
                            placement="bottomRight"
                        >
                            <Button
                                type="text"
                                size="small"
                                icon={<EllipsisOutlined style={{ color: siderTextSecondary }} />}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={t('common.actions')}
                            />
                        </Dropdown>
                    </Flex>
                ),
                onClick: () => handleMenuClick(path),
            };
        });
    }, [accounts, onOpenGoCardless, onOpenEditAccount, onOpenDeleteAccount, handleMenuClick, t, token, siderTextPrimary, siderTextSecondary]);

    // Calcola se ci sono conti correnti collegati a GoCardless
    const hasSyncableAccounts = useMemo(() => {
        return accounts.some(acc => acc.type === 'CONTO_CORRENTE' && acc.linkedToExternal);
    }, [accounts]);

    return (
        <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            width={isMobile ? '100%' : 300}
            breakpoint="lg"
            collapsedWidth={0}
            onBreakpoint={broken => {
                setCollapsed(broken);
            }}
            onCollapse={(isCollapsed) => setCollapsed(isCollapsed)}
            style={{
                position: 'fixed',
                height: '100vh',
                left: 0,
                top: 0,
                bottom: 0,
                // On desktop the sider is part of the layout, so it must stay below modals.
                // On mobile it acts as an overlay drawer and needs a higher stacking context.
                zIndex: isMobile ? 1001 : 900,
                overflowY: 'auto',
                background: siderBg,
                ...(isMobile ? { width: '100%' } : {})
            }}
        >
            {isMobile && !collapsed && (
                <Flex justify="space-between" align="center" style={{ padding: `${SPACING.md}px`, background: siderBg }}>
                    <Title level={4} style={{ color: siderTextPrimary, margin: 0 }}>{t('common.menu')}</Title>
                    <Button
                        type="text"
                        icon={<MenuFoldOutlined style={{ color: siderTextPrimary, fontSize: `${FONT_SIZE.xxxl}px` }} />}
                        onClick={() => setCollapsed(true)}
                        size="large"
                    />
                </Flex>
            )}
            {!isMobile && (
                <div style={{ height: '32px', margin: `${SPACING.md}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/pwa-192x192.png" alt={t('app.name')} width="32" height="32" style={{ height: '32px', width: '32px' }} />
                    <Title level={4} style={{ color: siderTextPrimary, margin: '0 0 0 10px', fontSize: `${FONT_SIZE.xxl}px` }}>{t('app.name')}</Title>
                </div>
            )}
            <Menu
                theme={siderMenuTheme}
                mode="inline"
                selectedKeys={selectedKeys}
                items={NAV_ITEMS.map(item => ({
                    key: item.key,
                    icon: NAV_ICON_MAP[item.key],
                    label: t(item.labelKey),
                    onClick: () => {
                        navigate(item.key);
                        if (isMobile) setCollapsed(true);
                    }
                }))}
            />
            <Flex vertical style={{ padding: `0 ${SPACING.xs}px` }}>
                <Flex justify="space-between" align="center" style={{ padding: `${SPACING.md}px ${SPACING.md}px ${SPACING.xs}px` }}>
                    <Title level={5} style={{ color: siderTextSecondary, margin: 0 }}>{t('nav.accounts')}</Title>
                    <Flex gap="small">
                        {hasSyncableAccounts && (
                            <Button
                                icon={<SyncOutlined spin={syncingAccounts} />}
                                size="small"
                                onClick={onSyncAllAccounts}
                                disabled={syncingAccounts}
                                title={t('gocardless.syncAllTitle')}
                            />
                        )}
                        <Button icon={<PlusOutlined />} size="small" onClick={onOpenCreateAccount} aria-label={t('accounts.newAccount')} />
                    </Flex>
                </Flex>
                <div style={{ padding: `0 ${SPACING.md}px ${SPACING.md}px` }}>
                    <Statistic
                        title={<Text style={{ color: siderTextSecondary }}>{t('accounts.totalBalance')}</Text>}
                        value={totalBalance}
                        precision={2}
                        valueStyle={{ color: siderTextPrimary }}
                        suffix={getCurrencySymbol(auth?.defaultCurrency || 'EUR')}
                    />
                </div>
            </Flex>
            {loading ? <Spin style={{ padding: '20px' }} /> :
                <Menu theme={siderMenuTheme} mode="inline" selectedKeys={selectedKeys} items={accountMenuItems} />}
        </Sider>
    );
};

