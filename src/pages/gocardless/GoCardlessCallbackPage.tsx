// src/pages/gocardless/GoCardlessCallbackPage.tsx
import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Alert, Button, Card, Flex, Form, InputNumber, List, message, Spin, Typography} from 'antd';
import {BankOutlined} from '@ant-design/icons';
import * as api from '../../services/api';
import type {GoCardlessBankDetails} from '../../types/api';

const {Title, Text} = Typography;

export const GoCardlessCallbackPage = () => {
    const {accountId} = useParams<{ accountId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<GoCardlessBankDetails[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!accountId) {
            setError('ID conto non valido');
            setLoading(false);
            return;
        }

        const fetchBankAccounts = async () => {
            try {
                const response = await api.getGoCardlessBankAccounts(accountId);
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
        if (!selectedAccountId || !accountId || currentBalance === null) {
            message.error('Seleziona un conto e inserisci il bilancio corrente');
            return;
        }

        setLoading(true);

        try {
            await api.linkGoCardlessBankAccount(accountId, {
                accountId: selectedAccountId
            });

            message.success('Conto bancario collegato con successo!');
            message.loading('Importazione transazioni in corso...', 0);

            await api.syncGoCardlessBankAccount(accountId, {actualBalance: currentBalance});

            message.destroy();
            message.success('Transazioni importate con successo!');
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
                style={{minHeight: '100vh'}}
                vertical
                gap="large"
            >
                <Spin size="large"/>
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
                style={{minHeight: '100vh', padding: '24px'}}
            >
                <Card style={{maxWidth: 600, width: '100%'}}>
                    <Alert
                        message="Errore"
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
                        Torna alle Transazioni
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
                            Seleziona il Conto da Sincronizzare
                        </Title>
                    </Flex>
                }
            >
                <Alert
                    message="Seleziona un conto bancario"
                    description="Scegli quale conto bancario vuoi collegare e inserisci il bilancio corrente per allineare correttamente le transazioni."
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
                            <Flex gap="middle" align="center" style={{ width: '100%' }}>
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
                                <Flex vertical gap="small" style={{ flex: 1 }}>
                                    <Text strong style={{ fontSize: '16px' }}>
                                        {account.institution.name || 'Banca Sconosciuta'}
                                    </Text>
                                    {account.name && (
                                        <Text type="secondary">
                                            Nome: {account.name}
                                        </Text>
                                    )}
                                </Flex>
                                <BankOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                            </Flex>
                        </List.Item>


                    )}
                />

                {selectedAccountId && (
                    <Form.Item
                        label="Bilancio Corrente"
                        style={{marginTop: 24}}
                        help="Inserisci il bilancio attuale del conto bancario per allineare correttamente le transazioni"
                    >
                        <InputNumber
                            style={{width: '100%'}}
                            value={currentBalance}
                            onChange={(value) => setCurrentBalance(value)}
                            placeholder="Es: 1000.00"
                            addonAfter="€"
                            precision={2}
                        />
                    </Form.Item>
                )}

                <Flex gap="small" style={{marginTop: 24}}>
                    <Button onClick={() => navigate('/transactions')} style={{flex: 1}}>
                        Annulla
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleConfirmSelection}
                        disabled={!selectedAccountId || currentBalance === null}
                        style={{flex: 1}}
                    >
                        Conferma Selezione
                    </Button>
                </Flex>
            </Card>
        </Flex>
    );
};
