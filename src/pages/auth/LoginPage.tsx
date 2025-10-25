// src/pages/auth/LoginPage.tsx
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, Card, Typography, Alert, Layout } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as api from '../../services/api';
import type { LoginRequest } from '../../types/api';

const { Title } = Typography;
const { Content } = Layout;

export const LoginPage = () => {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const onFinish = async (values: LoginRequest) => {
        setLoading(true);
        setError(null);
        try {
            const loginResponse = await api.login(values);
            login(loginResponse.data);
            navigate('/');
        } catch (err) {
            setError('Credenziali non valide. Riprova.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
                <Card style={{ width: '100%', maxWidth: 400 }}>
                    <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>Login</Title>
                    {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
                    <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: 'Inserisci il tuo username!' }]}
                        >
                            <Input prefix={<UserOutlined />} placeholder="Username" />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Inserisci la tua password!' }]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
                                Accedi
                            </Button>
                        </Form.Item>
                    </Form>
                    <div style={{ textAlign: 'center' }}>
                        Non hai un account? <Link to="/register">Registrati ora!</Link>
                    </div>
                </Card>
            </Content>
        </Layout>
    );
};
