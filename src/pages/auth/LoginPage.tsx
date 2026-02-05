// src/pages/auth/LoginPage.tsx
import {LockOutlined, UserOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Form, Input, Layout, Typography} from 'antd';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useNavigate} from 'react-router-dom';
import {useAuth} from '../../contexts/AuthContext';
import * as api from '../../services/api';
import type {LoginRequest} from '../../types/api';

const { Title } = Typography;
const { Content } = Layout;

export const LoginPage = () => {
    const { t } = useTranslation();
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
            setError(t('auth.invalidCredentials'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '24px 16px'
            }}>
                <Card style={{
                    width: '100%',
                    maxWidth: 400,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                        <img src="/pwa-192x192.png" alt={t('app.name')} style={{ width: '64px', height: '64px' }} />
                    </div>
                    <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>{t('auth.loginTitle')}</Title>
                    {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
                    <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: t('auth.usernameRequired') }]}
                        >
                            <Input prefix={<UserOutlined />} placeholder={t('auth.username')} />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: t('auth.passwordRequired') }]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
                                {t('auth.loginButton')}
                            </Button>
                        </Form.Item>
                    </Form>
                    <div style={{ textAlign: 'center' }}>
                        {t('auth.noAccount')} <Link to="/register">{t('auth.signUpNow')}</Link>
                    </div>
                </Card>
            </Content>
        </Layout>
    );
};
