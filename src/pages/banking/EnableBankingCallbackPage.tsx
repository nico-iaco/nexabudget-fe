// src/pages/banking/EnableBankingCallbackPage.tsx
// Pagina di ritorno del flusso Enable Banking. A differenza di GoCardless, il redirect_url
// registrato lato backend è UNICO e STATICO per tutta l'app: questa route riceve `code` e `state`
// (state = localAccountId che ha avviato il collegamento) come query string, sempre.
import {useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate, useOutletContext, useSearchParams} from 'react-router-dom';
import {App, Alert, Button, Card, Flex, Spin, Typography} from 'antd';
import {BankOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import * as api from '../../services/api';
import type {NormalizedBankAccount} from '../../types/api';
import {SPACING} from '../../theme/tokens';
import type {AppOutletContext} from '../../types/outletContext';
import {BankAccountPicker} from '../../components/banking/BankAccountPicker';

const {Title, Text} = Typography;

export const EnableBankingCallbackPage = () => {
    const {t} = useTranslation();
    const {message, notification} = App.useApp();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const {accounts, fetchAccounts, onOpenBankLink} = useOutletContext<AppOutletContext>();

    const code = searchParams.get('code');
    const localAccountId = searchParams.get('state');

    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<NormalizedBankAccount[]>([]);
    // Derivati dagli account già in cache React Query e passati dall'outlet context:
    // prima questa pagina rifaceva `api.getAccounts()` pur avendo il dato a disposizione.
    const localAccount = useMemo(
        () => accounts.find(a => a.id === localAccountId) ?? null,
        [accounts, localAccountId]
    );
    const accountCurrency = localAccount?.currency ?? 'EUR';
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const tRef = useRef(t);
    useEffect(() => { tRef.current = t; });

    const apiNotification = notification;

    useEffect(() => {
        if (!localAccountId) {
            setError(tRef.current('enableBankingCallback.invalidState'));
            setLoading(false);
            return;
        }
        if (!code) {
            setError(tRef.current('enableBankingCallback.invalidCode'));
            setLoading(false);
            return;
        }

        const completeSession = async () => {
            try {
                const sessionRes = await api.completeBankSession('enable-banking', localAccountId, {code});

                const accounts = sessionRes.data.accounts ?? [];
                setBankAccounts(accounts);
                if (accounts.length === 0) {
                    setError(tRef.current('enableBankingCallback.noAccounts'));
                }
            } catch (err) {
                console.error(err);
                setError(tRef.current('enableBankingCallback.sessionError'));
            } finally {
                setLoading(false);
            }
        };

        completeSession();
        // `t` deliberatamente fuori dalle dipendenze: il `code` di Enable Banking è
        // monouso, e includendolo un cambio lingua rieseguiva l'effetto ri-postando
        // lo stesso code (richiesta duplicata e rifiuto lato backend).
    }, [localAccountId, code]);

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
                        title={t('enableBankingCallback.errorTitle')}
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
                    title={t('enableBankingCallback.selectAccountMessage')}
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
