// src/pages/gocardless/GoCardlessCallbackPage.tsx
import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Alert, Button, Card, Flex, Form, InputNumber, List, message, notification, Spin, Typography} from 'antd';
import {BankOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import * as api from '../../services/api';
import type {GoCardlessBankDetails} from '../../types/api';

const {Title, Text} = Typography;

export const GoCardlessCallbackPage = () => {
    const { t } = useTranslation();
    const {accountId} = useParams<{ accountId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<GoCardlessBankDetails[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);

    const [error, setError] = useState<string | null>(null);

    const [apiNotification, contextHolder] = notification.useNotification();

    useEffect(() => {
        if (!accountId) {
            setError(t('gocardlessCallback.invalidAccountId'));
            setLoading(false);
            return;
        }

        const fetchBankAccounts = async () => {
            try {
                const response = await api.getGoCardlessBankAccounts(accountId);
                setBankAccounts(response.data);

                if (response.data.length === 0) {
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
        if (!selectedAccountId || !accountId || currentBalance === null) {
            message.error(t('gocardlessCallback.selectAccountAndBalance'));
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
        <>
            {contextHolder}
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
                                        ? '2px solid #1890ff'
                                        : '1px solid #d9d9d9',
                                    borderRadius: '8px',
                                    marginBottom: '12px',
                                    backgroundColor: selectedAccountId === account.account_id
                                        ? '#e6f7ff'
                                        : 'white',
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
                                    <BankOutlined style={{fontSize: '24px', color: '#1890ff'}}/>
                                </Flex>
                            </List.Item>


                        )}
                    />

                    {selectedAccountId && (
                        <Form.Item
                            label={t('gocardlessCallback.currentBalanceLabel')}
                            style={{marginTop: 24}}
                            help={t('gocardlessCallback.currentBalanceHelp')}
                        >
                            <InputNumber
                                style={{width: '100%'}}
                                value={currentBalance}
                                onChange={(value) => setCurrentBalance(value)}
                                placeholder={t('gocardlessCallback.currentBalancePlaceholder')}
                                addonAfter="€"
                                precision={2}
                            />
                        </Form.Item>
                    )}

                    <Flex gap="small" style={{marginTop: 24}}>
                        <Button onClick={() => navigate('/transactions')} style={{flex: 1}}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleConfirmSelection}
                            disabled={!selectedAccountId || currentBalance === null}
                            style={{flex: 1}}
                        >
                            {t('gocardlessCallback.confirmSelection')}
                        </Button>
                    </Flex>
                </Card>
            </Flex></>
    );
};
