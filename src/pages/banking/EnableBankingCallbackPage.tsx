// src/pages/banking/EnableBankingCallbackPage.tsx
// Pagina di ritorno del flusso Enable Banking. A differenza di GoCardless, il redirect_url
// registrato lato backend è UNICO e STATICO per tutta l'app: questa route riceve `code` e `state`
// (state = localAccountId che ha avviato il collegamento) come query string, sempre.
import {useEffect, useState} from 'react';
import {useNavigate, useOutletContext, useSearchParams} from 'react-router-dom';
import {App, Alert, Button, Card, Flex, Spin, Typography} from 'antd';
import {BankOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import * as api from '../../services/api';
import type {Account, NormalizedBankAccount} from '../../types/api';
import {SPACING} from '../../theme/tokens';
import type {AppOutletContext} from '../../types/outletContext';
import {BankAccountPicker} from '../../components/banking/BankAccountPicker';

const {Title, Text} = Typography;

export const EnableBankingCallbackPage = () => {
    const {t} = useTranslation();
    const {message, notification} = App.useApp();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const {fetchAccounts, onOpenBankLink} = useOutletContext<AppOutletContext>();

    const code = searchParams.get('code');
    const localAccountId = searchParams.get('state');

    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<NormalizedBankAccount[]>([]);
    const [localAccount, setLocalAccount] = useState<Account | null>(null);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);
    const [accountCurrency, setAccountCurrency] = useState<string>('EUR');
    const [error, setError] = useState<string | null>(null);

    const apiNotification = notification;

    useEffect(() => {
        if (!localAccountId) {
            setError(t('enableBankingCallback.invalidState'));
            setLoading(false);
            return;
        }
        if (!code) {
            setError(t('enableBankingCallback.invalidCode'));
            setLoading(false);
            return;
        }

        const completeSession = async () => {
            try {
                const [sessionRes, accountsRes] = await Promise.all([
                    api.completeBankSession('enable-banking', localAccountId, {code}),
                    api.getAccounts(),
                ]);

                const found = accountsRes.data.find((a) => a.id === localAccountId) ?? null;
                if (found) {
                    setLocalAccount(found);
                    setAccountCurrency(found.currency);
                }

                const accounts = sessionRes.data.accounts ?? [];
                setBankAccounts(accounts);
                if (accounts.length === 0) {
                    setError(t('enableBankingCallback.noAccounts'));
                }
            } catch (err) {
                console.error(err);
                setError(t('enableBankingCallback.sessionError'));
            } finally {
                setLoading(false);
            }
        };

        completeSession();
    }, [localAccountId, code, t]);

    const handleSelectAccount = (providerAccountId: string) => {
        setSelectedAccountId(providerAccountId);
    };

    const handleConfirmSelection = async () => {
        if (!selectedAccountId || !localAccountId) {
            message.error(t('enableBankingCallback.selectAccount'));
            return;
        }

        setLoading(true);

        try {
            await api.linkBankAccount('enable-banking', localAccountId, {
                accountId: selectedAccountId,
            });

            message.success(t('enableBankingCallback.linkSuccess'));

            await api.syncBankAccount('enable-banking', localAccountId, {actualBalance: currentBalance});

            apiNotification.info({
                message: t('enableBankingCallback.syncStartedTitle'),
                description: t('enableBankingCallback.syncStartedDescription'),
                placement: 'bottomRight',
                duration: 5,
            });

            await fetchAccounts();
            navigate(`/accounts/${localAccountId}/transactions`);
        } catch (err) {
            console.error(err);
            apiNotification.error({
                message: t('enableBankingCallback.syncErrorTitle'),
                description: t('enableBankingCallback.syncErrorDescription'),
                placement: 'bottomRight',
                duration: 5,
            });
            setLoading(false);
        }
    };

    const handleRetry = () => {
        if (localAccount) {
            onOpenBankLink(localAccount);
        }
    };

    if (loading) {
        return (
            <Flex justify="center" align="center" style={{minHeight: '100vh'}} vertical gap="large">
                <Spin size="large"/>
                <Text>
                    {bankAccounts.length > 0
                        ? t('enableBankingCallback.loadingLinking')
                        : t('enableBankingCallback.loadingAccounts')}
                </Text>
            </Flex>
        );
    }

    if (error) {
        return (
            <Flex justify="center" align="center" style={{minHeight: '100vh', padding: SPACING.lg}}>
                <Card style={{maxWidth: 600, width: '100%'}}>
                    <Alert
                        message={t('enableBankingCallback.errorTitle')}
                        description={error}
                        type="error"
                        showIcon
                        style={{marginBottom: SPACING.md}}
                    />
                    <Flex gap="small">
                        <Button onClick={() => navigate('/transactions')} style={{flex: 1}}>
                            {t('enableBankingCallback.backToTransactions')}
                        </Button>
                        {localAccount && (
                            <Button type="primary" onClick={handleRetry} style={{flex: 1}}>
                                {t('enableBankingCallback.retryButton')}
                            </Button>
                        )}
                    </Flex>
                </Card>
            </Flex>
        );
    }

    return (
        <Flex justify="center" align="center" style={{minHeight: '100vh', padding: SPACING.lg}}>
            <Card
                style={{maxWidth: 800, width: '100%'}}
                title={
                    <Flex align="center" gap="small">
                        <BankOutlined/>
                        <Title level={3} style={{margin: 0}}>
                            {t('enableBankingCallback.selectAccountTitle')}
                        </Title>
                    </Flex>
                }
            >
                <Alert
                    message={t('enableBankingCallback.selectAccountMessage')}
                    description={t('enableBankingCallback.selectAccountDescription')}
                    type="info"
                    showIcon
                    style={{marginBottom: SPACING.lg}}
                />

                <BankAccountPicker
                    items={bankAccounts.map(account => ({
                        id: account.providerAccountId,
                        institutionName: account.institutionName,
                        accountName: account.name,
                    }))}
                    selectedId={selectedAccountId}
                    onSelect={handleSelectAccount}
                    currentBalance={currentBalance}
                    onBalanceChange={setCurrentBalance}
                    currency={accountCurrency}
                    bankUnknownLabel={t('enableBankingCallback.bankUnknown')}
                    accountNameLabel={t('enableBankingCallback.accountNameLabel')}
                    balanceWarningTitle={t('enableBankingCallback.balanceWarningTitle')}
                    balanceWarningDescription={t('enableBankingCallback.balanceWarningDescription')}
                    currentBalanceLabel={t('enableBankingCallback.currentBalanceLabel')}
                    currentBalanceHelp={t('enableBankingCallback.currentBalanceHelp')}
                    currentBalancePlaceholder={t('enableBankingCallback.currentBalancePlaceholder')}
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
                        {t('enableBankingCallback.confirmSelection')}
                    </Button>
                </Flex>
            </Card>
        </Flex>
    );
};
