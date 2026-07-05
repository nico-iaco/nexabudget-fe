// src/pages/gocardless/GoCardlessCallbackPage.tsx
import {useEffect, useState} from 'react';
import {useNavigate, useOutletContext, useParams} from 'react-router-dom';
import {App, Alert, Button, Card, Flex, Form, InputNumber, List, Spin, theme, Typography} from 'antd';
import {BankOutlined, ReloadOutlined, ArrowRightOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import * as api from '../../services/api';
import type {Account, GoCardlessBankDetails, GoCardlessLinkedStatus} from '../../types/api';
import {FONT_SIZE, RADIUS, SPACING} from '../../theme/tokens';
import {getCurrencySymbol} from '../../utils/currency';
import type { AppOutletContext } from '../../types/outletContext';

const {Title, Text} = Typography;

export const GoCardlessCallbackPage = () => {
    const { t } = useTranslation();
    const { message, notification } = App.useApp();
    const {accountId} = useParams<{ accountId: string }>();
    const navigate = useNavigate();
    const { fetchAccounts, onOpenGoCardless } = useOutletContext<AppOutletContext>();
    const [loading, setLoading] = useState(true);
    const [linkedStatus, setLinkedStatus] = useState<GoCardlessLinkedStatus | null>(null);
    const [bankAccounts, setBankAccounts] = useState<GoCardlessBankDetails[]>([]);
    const [pendingLink, setPendingLink] = useState<string | undefined>(undefined);
    const [statusReason, setStatusReason] = useState<string | undefined>(undefined);
    const [localAccount, setLocalAccount] = useState<Account | null>(null);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);
    const [accountCurrency, setAccountCurrency] = useState<string>('EUR');

    const [error, setError] = useState<string | null>(null);

    const apiNotification = notification;
    const {token} = theme.useToken();

    useEffect(() => {
        if (!accountId) {
            setError(t('gocardlessCallback.invalidAccountId'));
            setLoading(false);
            return;
        }

        const fetchBankAccounts = async () => {
            try {
                const [bankAccountsRes, accountsRes] = await Promise.all([
                    api.getGoCardlessBankAccounts(accountId),
                    api.getAccounts(),
                ]);
                const res = bankAccountsRes.data;
                setLinkedStatus(res.linkedStatus);
                setPendingLink(res.link);
                setStatusReason(res.reason);

                const found = accountsRes.data.find((a) => a.id === accountId) ?? null;
                if (found) {
                    setLocalAccount(found);
                    setAccountCurrency(found.currency);
                }

                if (res.linkedStatus === 'linked') {
                    const accounts = res.accounts ?? [];
                    setBankAccounts(accounts);
                    if (accounts.length === 0) {
                        setError(t('gocardlessCallback.noAccounts'));
                    }
                }
            } catch (err) {
                console.error(err);
                setError(t('gocardlessCallback.loadError'));
            } finally {
                setLoading(false);
            }
        };

        fetchBankAccounts();
    }, [accountId, t]);

    const handleSelectAccount = (bankAccountId: string) => {
        setSelectedAccountId(bankAccountId);
    };

    const handleConfirmSelection = async () => {
        if (!selectedAccountId || !accountId) {
            message.error(t('gocardlessCallback.selectAccount'));
            return;
        }

        setLoading(true);

        try {
            await api.linkGoCardlessBankAccount(accountId, {
                accountId: selectedAccountId
            });

            message.success(t('gocardlessCallback.linkSuccess'));

            await api.syncGoCardlessBankAccount(accountId, {actualBalance: currentBalance});

            apiNotification.info({
                message: t('gocardlessCallback.syncStartedTitle'),
                description: t('gocardlessCallback.syncStartedDescription'),
                placement: 'bottomRight',
                duration: 5,
            });

            await fetchAccounts();
            navigate(`/accounts/${accountId}/transactions`);
        } catch (err) {
            console.error(err);
            apiNotification.error({
                message: t('gocardlessCallback.syncErrorTitle'),
                description: t('gocardlessCallback.syncErrorDescription'),
                placement: 'bottomRight',
                duration: 5,
            })
            setLoading(false);
        }
    };

    const handleReconnect = () => {
        if (localAccount) {
            onOpenGoCardless(localAccount);
        }
    };

    const handleContinuePending = () => {
        if (pendingLink) {
            window.location.href = pendingLink;
        } else {
            setError(t('gocardlessCallback.loadError'));
        }
    };

    if (loading) {
        return (
            <Flex
                justify="center"
                align="center"
                style={{minHeight: '100vh'}}
                vertical
                gap="large"
            >
                <Spin size="large"/>
                <Text>
                    {bankAccounts.length > 0
                        ? t('gocardlessCallback.loadingLinking')
                        : t('gocardlessCallback.loadingAccounts')}
                </Text>
            </Flex>
        );
    }

    if (error) {
        return (
            <Flex
                justify="center"
                align="center"
                style={{minHeight: '100vh', padding: SPACING.lg}}
            >
                <Card style={{maxWidth: 600, width: '100%'}}>
                    <Alert
                        message={t('gocardlessCallback.errorTitle')}
                        description={error}
                        type="error"
                        showIcon
                    />
                    <Button
                        type="primary"
                        onClick={() => navigate('/transactions')}
                        style={{marginTop: SPACING.md}}
                        block
                    >
                        {t('gocardlessCallback.backToTransactions')}
                    </Button>
                </Card>
            </Flex>
        );
    }

    // --- Stati che richiedono ri-autenticazione ---
    if (linkedStatus === 'expired' || linkedStatus === 'rejected' || linkedStatus === 'suspended') {
        const titleKey = `gocardlessCallback.${linkedStatus}Title` as const;
        const descKey = `gocardlessCallback.${linkedStatus}Description` as const;
        return (
            <Flex justify="center" align="center" style={{minHeight: '100vh', padding: SPACING.lg}}>
                <Card style={{maxWidth: 600, width: '100%'}}>
                    <Alert
                        message={t(titleKey)}
                        description={t(descKey)}
                        type="warning"
                        showIcon
                        style={{marginBottom: SPACING.md}}
                    />
                    {statusReason && (
                        <Text type="secondary" style={{display: 'block', marginBottom: SPACING.md}}>
                            {statusReason}
                        </Text>
                    )}
                    <Flex gap="small">
                        <Button onClick={() => navigate('/transactions')} style={{flex: 1}}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            onClick={handleReconnect}
                            disabled={!localAccount}
                            style={{flex: 1}}
                        >
                            {t('gocardlessCallback.reconnectButton')}
                        </Button>
                    </Flex>
                </Card>
            </Flex>
        );
    }

    // --- Stato pending: autenticazione avviata ma non completata ---
    if (linkedStatus === 'pending') {
        return (
            <Flex justify="center" align="center" style={{minHeight: '100vh', padding: SPACING.lg}}>
                <Card style={{maxWidth: 600, width: '100%'}}>
                    <Alert
                        message={t('gocardlessCallback.pendingTitle')}
                        description={t('gocardlessCallback.pendingDescription')}
                        type="info"
                        showIcon
                        style={{marginBottom: SPACING.md}}
                    />
                    <Flex gap="small">
                        <Button onClick={() => navigate('/transactions')} style={{flex: 1}}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="primary"
                            icon={<ArrowRightOutlined />}
                            onClick={handleContinuePending}
                            style={{flex: 1}}
                        >
                            {t('gocardlessCallback.continueAuthButton')}
                        </Button>
                    </Flex>
                </Card>
            </Flex>
        );
    }

    // --- Stato unknown / non riconosciuto ---
    if (linkedStatus === 'unknown' || (linkedStatus !== 'linked' && linkedStatus !== null)) {
        return (
            <Flex justify="center" align="center" style={{minHeight: '100vh', padding: SPACING.lg}}>
                <Card style={{maxWidth: 600, width: '100%'}}>
                    <Alert
                        message={t('gocardlessCallback.unknownTitle')}
                        description={statusReason ?? t('gocardlessCallback.unknownDescription')}
                        type="error"
                        showIcon
                    />
                    <Button
                        type="primary"
                        onClick={() => navigate('/transactions')}
                        style={{marginTop: SPACING.md}}
                        block
                    >
                        {t('gocardlessCallback.backToTransactions')}
                    </Button>
                </Card>
            </Flex>
        );
    }

    // --- Stato linked: selezione conto ---
    return (
        <Flex justify="center" align="center" style={{minHeight: '100vh', padding: SPACING.lg}}>
                <Card
                    style={{maxWidth: 800, width: '100%'}}
                    title={
                        <Flex align="center" gap="small">
                            <BankOutlined/>
                            <Title level={3} style={{margin: 0}}>
                                {t('gocardlessCallback.selectAccountTitle')}
                            </Title>
                        </Flex>
                    }
                >
                    <Alert
                        message={t('gocardlessCallback.selectAccountMessage')}
                        description={t('gocardlessCallback.selectAccountDescription')}
                        type="info"
                        showIcon
                        style={{marginBottom: SPACING.lg}}
                    />

                    <List
                        dataSource={bankAccounts}
                        renderItem={(account) => (
                            <List.Item
                                onClick={() => handleSelectAccount(account.account_id)}
                                style={{
                                    cursor: 'pointer',
                                    padding: SPACING.md,
                                    border: selectedAccountId === account.account_id
                                        ? `2px solid ${token.colorPrimary}`
                                        : `1px solid ${token.colorBorder}`,
                                    borderRadius: RADIUS.lg,
                                    marginBottom: SPACING.sm,
                                    backgroundColor: selectedAccountId === account.account_id
                                        ? token.controlItemBgActive
                                        : token.colorBgContainer,
                                    transition: 'all 0.3s'
                                }}
                            >
                                <Flex gap="middle" align="center" style={{width: '100%'}}>
                                    {account.institution.logo && (
                                        <img
                                            src={account.institution.logo}
                                            alt={account.institution.name}
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                objectFit: 'contain',
                                                borderRadius: RADIUS.lg
                                            }}
                                        />
                                    )}
                                    <Flex vertical gap="small" style={{flex: 1}}>
                                        <Text strong style={{fontSize: FONT_SIZE.xl}}>
                                            {account.institution.name || t('gocardlessCallback.bankUnknown')}
                                        </Text>
                                        {account.name && (
                                            <Text type="secondary">
                                                {t('gocardlessCallback.accountNameLabel')}: {account.name}
                                            </Text>
                                        )}
                                    </Flex>
                                    <BankOutlined style={{fontSize: FONT_SIZE.display, color: token.colorPrimary}}/>
                                </Flex>
                            </List.Item>
                        )}
                    />

                    {selectedAccountId && (
                        <>
                            <Alert
                                message={t('gocardlessCallback.balanceWarningTitle')}
                                description={t('gocardlessCallback.balanceWarningDescription')}
                                type="warning"
                                showIcon
                                style={{marginTop: SPACING.lg, marginBottom: SPACING.md}}
                            />
                            <Form.Item
                                label={t('gocardlessCallback.currentBalanceLabel')}
                                help={t('gocardlessCallback.currentBalanceHelp')}
                            >
                                <InputNumber
                                    style={{width: '100%'}}
                                    value={currentBalance}
                                    onChange={(value) => setCurrentBalance(value)}
                                    placeholder={t('gocardlessCallback.currentBalancePlaceholder')}
                                    addonAfter={getCurrencySymbol(accountCurrency)}
                                    precision={2}
                                    parser={(value) => value?.replace(',', '.') as any}
                                />
                            </Form.Item>
                        </>
                    )}

                    <Flex gap="small" style={{marginTop: SPACING.lg}}>
                        <Button onClick={() => navigate('/transactions')} style={{flex: 1}}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleConfirmSelection}
                            disabled={!selectedAccountId}
                            style={{flex: 1}}
                        >
                            {t('gocardlessCallback.confirmSelection')}
                        </Button>
                    </Flex>
                </Card>
        </Flex>
    );
};
