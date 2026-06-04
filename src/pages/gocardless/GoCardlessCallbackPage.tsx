// src/pages/gocardless/GoCardlessCallbackPage.tsx
import {useEffect, useState} from 'react';
import {useNavigate, useOutletContext, useParams} from 'react-router-dom';
import {App, Alert, Button, Card, Flex, Form, InputNumber, List, Spin, theme, Typography} from 'antd';
import {BankOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import * as api from '../../services/api';
import type {Account, GoCardlessBankDetails} from '../../types/api';
import {COLOR_ACCENT} from '../../theme/tokens';
import {getCurrencySymbol} from '../../utils/currency';

interface OutletContextType {
    accounts: Account[];
    fetchAccounts: (background?: boolean) => Promise<Account[]>;
}

const {Title, Text} = Typography;

export const GoCardlessCallbackPage = () => {
    const { t } = useTranslation();
    const { message, notification } = App.useApp();
    const {accountId} = useParams<{ accountId: string }>();
    const navigate = useNavigate();
    const { fetchAccounts } = useOutletContext<OutletContextType>();
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<GoCardlessBankDetails[]>([]);
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
                setBankAccounts(bankAccountsRes.data);
                const localAccount = accountsRes.data.find((a) => a.id === accountId);
                if (localAccount) {
                    setAccountCurrency(localAccount.currency);
                }

                if (bankAccountsRes.data.length === 0) {
                    setError(t('gocardlessCallback.noAccounts'));
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
                style={{minHeight: '100vh', padding: '24px'}}
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
                        style={{marginTop: 16}}
                        block
                    >
                        {t('gocardlessCallback.backToTransactions')}
                    </Button>
                </Card>
            </Flex>
        );
    }

    return (
        <Flex justify="center" align="center" style={{minHeight: '100vh', padding: '24px'}}>
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
                        style={{marginBottom: 24}}
                    />

                    <List
                        dataSource={bankAccounts}
                        renderItem={(account) => (
                            <List.Item
                                onClick={() => handleSelectAccount(account.account_id)}
                                style={{
                                    cursor: 'pointer',
                                    padding: '16px',
                                    border: selectedAccountId === account.account_id
                                        ? `2px solid ${COLOR_ACCENT}`
                                        : `1px solid ${token.colorBorder}`,
                                    borderRadius: '8px',
                                    marginBottom: '12px',
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
                                                borderRadius: '8px'
                                            }}
                                        />
                                    )}
                                    <Flex vertical gap="small" style={{flex: 1}}>
                                        <Text strong style={{fontSize: '16px'}}>
                                            {account.institution.name || t('gocardlessCallback.bankUnknown')}
                                        </Text>
                                        {account.name && (
                                            <Text type="secondary">
                                                {t('gocardlessCallback.accountNameLabel')}: {account.name}
                                            </Text>
                                        )}
                                    </Flex>
                                    <BankOutlined style={{fontSize: '24px', color: COLOR_ACCENT}}/>
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
                                style={{marginTop: 24, marginBottom: 16}}
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

                    <Flex gap="small" style={{marginTop: 24}}>
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
