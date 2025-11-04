// src/pages/gocardless/GoCardlessCallbackPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Spin, List, Button, message, Alert, Flex } from 'antd';
import { CheckCircleOutlined, BankOutlined } from '@ant-design/icons';
import * as api from '../../services/api';
import type { GoCardlessBankDetails } from '../../types/api';

const { Title, Text } = Typography;

export const GoCardlessCallbackPage = () => {
    const { accountId } = useParams<{ accountId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<GoCardlessBankDetails[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!accountId) {
            setError('ID conto non valido');
            setLoading(false);
            return;
        }

        const fetchBankAccounts = async () => {
            try {
                const response = await api.getGoCardlessBankAccounts(parseInt(accountId));
                setBankAccounts(response.data);

                if (response.data.length === 0) {
                    setError('Nessun conto bancario disponibile per la sincronizzazione');
                }
            } catch (err) {
                console.error(err);
                setError('Errore durante il caricamento dei conti bancari');
            } finally {
                setLoading(false);
            }
        };

        fetchBankAccounts();
    }, [accountId]);

    const handleSelectAccount = (bankAccountId: string) => {
        setSelectedAccountId(bankAccountId);
    };

    const handleConfirmSelection = async () => {
        if (!selectedAccountId || !accountId) return;

        setLoading(true);

        try {
            await api.linkGoCardlessBankAccount(parseInt(accountId), {
                accountId: selectedAccountId
            });

            message.success('Conto bancario collegato con successo!');

            // 2. Sincronizza le transazioni
            message.loading('Importazione transazioni in corso...', 0);

            await api.syncGoCardlessBankAccount(parseInt(accountId));

            message.destroy();
            message.success('Transazioni importate con successo!');

            // 3. Reindirizza alla pagina delle transazioni del conto
            navigate(`/accounts/${accountId}/transactions`);
        } catch (err) {
            console.error(err);
            message.destroy();
            message.error('Errore durante il collegamento o la sincronizzazione del conto bancario');
            setLoading(false);
        }
    };


    if (loading) {
        return (
            <Flex
                justify="center"
                align="center"
                style={{ minHeight: '100vh' }}
                vertical
                gap="large"
            >
                <Spin size="large" />
                <Text>
                    {bankAccounts.length > 0
                        ? 'Collegamento e importazione transazioni in corso...'
                        : 'Caricamento conti bancari...'}
                </Text>
            </Flex>
        );
    }


    if (error) {
        return (
            <Flex
                justify="center"
                align="center"
                style={{ minHeight: '100vh', padding: '24px' }}
            >
                <Card style={{ maxWidth: 600, width: '100%' }}>
                    <Alert
                        message="Errore"
                        description={error}
                        type="error"
                        showIcon
                    />
                    <Button
                        type="primary"
                        onClick={() => navigate('/transactions')}
                        style={{ marginTop: 16 }}
                        block
                    >
                        Torna alle Transazioni
                    </Button>
                </Card>
            </Flex>
        );
    }

    return (
        <Flex
            justify="center"
            align="center"
            style={{ minHeight: '100vh', padding: '24px' }}
        >
            <Card
                style={{ maxWidth: 800, width: '100%' }}
                title={
                    <Flex align="center" gap="small">
                        <BankOutlined />
                        <Title level={3} style={{ margin: 0 }}>
                            Seleziona il Conto da Sincronizzare
                        </Title>
                    </Flex>
                }
            >
                <Alert
                    message="Seleziona un conto bancario"
                    description="Scegli quale conto bancario vuoi collegare al tuo conto locale. Potrai sincronizzare automaticamente le transazioni."
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
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
                            <List.Item.Meta
                                avatar={
                                    account.institution.logo ? (
                                        <img
                                            src={account.institution.logo}
                                            alt={account.institution.name}
                                            style={{ width: 48, height: 48, borderRadius: '4px' }}
                                        />
                                    ) : (
                                        <BankOutlined style={{ fontSize: 48 }} />
                                    )
                                }
                                title={
                                    <Flex align="center" gap="small">
                                        <Text strong>{account.name}</Text>
                                        {selectedAccountId === account.account_id && (
                                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                        )}
                                    </Flex>
                                }
                                description={
                                    <Flex vertical gap="small">
                                        <Text type="secondary">{account.institution.name}</Text>
                                        <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                            {account.institution.bic}
                                        </Text>
                                    </Flex>
                                }
                            />
                        </List.Item>
                    )}
                />

                <Flex gap="small" style={{ marginTop: 24 }}>
                    <Button
                        onClick={() => navigate('/transactions')}
                        style={{ flex: 1 }}
                    >
                        Annulla
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleConfirmSelection}
                        disabled={!selectedAccountId}
                        style={{ flex: 1 }}
                    >
                        Conferma Selezione
                    </Button>
                </Flex>
            </Card>
        </Flex>
    );
};
