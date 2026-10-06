// src/pages/gocardless/GoCardlessCallbackPage.tsx
import {useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate, useOutletContext, useParams} from 'react-router-dom';
import {App, Alert, Button, Card, Flex, Spin, Typography} from 'antd';
import {BankOutlined, ReloadOutlined, ArrowRightOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import * as api from '../../services/api';
import type {GoCardlessBankDetails, GoCardlessLinkedStatus} from '../../types/api';
import {SPACING} from '../../theme/tokens';
import type { AppOutletContext } from '../../types/outletContext';
import { BankAccountPicker } from '../../components/banking/BankAccountPicker';

const {Title, Text} = Typography;

export const GoCardlessCallbackPage = () => {
    const { t } = useTranslation();
    const { message, notification } = App.useApp();
    const {accountId} = useParams<{ accountId: string }>();
    const navigate = useNavigate();
    const { accounts, fetchAccounts, onOpenBankLink } = useOutletContext<AppOutletContext>();
    const [loading, setLoading] = useState(true);
    const [linkedStatus, setLinkedStatus] = useState<GoCardlessLinkedStatus | null>(null);
    const [bankAccounts, setBankAccounts] = useState<GoCardlessBankDetails[]>([]);
    const [pendingLink, setPendingLink] = useState<string | undefined>(undefined);
    const [statusReason, setStatusReason] = useState<string | undefined>(undefined);
    // Derivati dagli account già in cache React Query e passati dall'outlet context:
    // prima questa pagina rifaceva `api.getAccounts()` pur avendo il dato a disposizione.
    const localAccount = useMemo(
        () => accounts.find(a => a.id === accountId) ?? null,
        [accounts, accountId]
    );
    const accountCurrency = localAccount?.currency ?? 'EUR';
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);

    const [error, setError] = useState<string | null>(null);

    const tRef = useRef(t);
    useEffect(() => { tRef.current = t; });

    const apiNotification = notification;

    useEffect(() => {
        if (!accountId) {
            setError(tRef.current('gocardlessCallback.invalidAccountId'));
            setLoading(false);
            return;
        }

        const fetchBankAccounts = async () => {
            try {
                const bankAccountsRes = await api.getGoCardlessBankAccounts(accountId);
                const res = bankAccountsRes.data;
                setLinkedStatus(res.linkedStatus);
                setPendingLink(res.link);
                setStatusReason(res.reason);

                if (res.linkedStatus === 'linked') {
                    const accounts = res.accounts ?? [];
                    setBankAccounts(accounts);
                    if (accounts.length === 0) {
                        setError(tRef.current('gocardlessCallback.noAccounts'));
                    }
                }
            } catch (err) {
                console.error(err);
                setError(tRef.current('gocardlessCallback.loadError'));
            } finally {
                setLoading(false);
            }
        };

        fetchBankAccounts();
        // `t` deliberatamente fuori dalle dipendenze: un cambio lingua rieseguirebbe
        // l'intero effetto di lettura dello stato del collegamento senza motivo.
    }, [accountId]);

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
            await api.linkBankAccount('gocardless', accountId, {
                accountId: selectedAccountId
            });

            message.success(t('gocardlessCallback.linkSuccess'));

            await api.syncBankAccount('gocardless', accountId, {actualBalance: currentBalance});

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
            onOpenBankLink(localAccount);
        }
    };

    const handleContinuePending = () => {
        if (pendingLink) {
            window.location.href = pendingLink;
        } else {
            setError(tRef.current('gocardlessCallback.loadError'));
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
                        title={t('gocardlessCallback.errorTitle')}
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
                        title={t(titleKey)}
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
                        title={t('gocardlessCallback.pendingTitle')}
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
                        title={t('gocardlessCallback.unknownTitle')}
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
                        title={t('gocardlessCallback.selectAccountMessage')}
                        description={t('gocardlessCallback.selectAccountDescription')}
                        type="info"
                        showIcon
                        style={{marginBottom: SPACING.lg}}
                    />

                    <BankAccountPicker
                        items={bankAccounts.map(account => ({
                            id: account.account_id,
                            institutionName: account.institution.name,
                            accountName: account.name,
                            logo: account.institution.logo,
                        }))}
                        selectedId={selectedAccountId}
                        onSelect={handleSelectAccount}
                        currentBalance={currentBalance}
                        onBalanceChange={setCurrentBalance}
                        currency={accountCurrency}
                        bankUnknownLabel={t('gocardlessCallback.bankUnknown')}
                        accountNameLabel={t('gocardlessCallback.accountNameLabel')}
                        balanceWarningTitle={t('gocardlessCallback.balanceWarningTitle')}
                        balanceWarningDescription={t('gocardlessCallback.balanceWarningDescription')}
                        currentBalanceLabel={t('gocardlessCallback.currentBalanceLabel')}
                        currentBalanceHelp={t('gocardlessCallback.currentBalanceHelp')}
                        currentBalancePlaceholder={t('gocardlessCallback.currentBalancePlaceholder')}
                    />

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
