// src/pages/auth/RegisterPage.tsx
import { LockOutlined, UserOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Form, Input, Card, Typography, Alert, Layout } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../../services/api';
import type { UserRequest } from '../../types/api';

const { Title } = Typography;
const { Content } = Layout;

export const RegisterPage = () => {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values: UserRequest) => {
        setLoading(true);
        setError(null);
        try {
            await api.register(values);
            navigate('/login'); // Reindirizza al login dopo la registrazione
        } catch (err) {
            setError('Errore durante la registrazione. L\'utente potrebbe già esistere.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
                <Card style={{ width: '100%', maxWidth: 400 }}>
                    <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>Registrati</Title>
                    {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
                    <Form name="register" onFinish={onFinish} autoComplete="off" size="large">
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: 'Inserisci un username!' }]}
                        >
                            <Input prefix={<UserOutlined />} placeholder="Username" />
                        </Form.Item>
                        <Form.Item
                            name="email"
                            rules={[{ required: true, message: 'Inserisci la tua email!', type: 'email' }]}
                        >
                            <Input prefix={<MailOutlined />} placeholder="Email" />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Inserisci una password!' }]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
                                Registrati
                            </Button>
                        </Form.Item>
                    </Form>
                    <div style={{ textAlign: 'center' }}>
                        Hai già un account? <Link to="/login">Accedi</Link>
                    </div>
                </Card>
            </Content>
        </Layout>
    );
};
