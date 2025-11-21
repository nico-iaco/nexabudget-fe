// src/pages/auth/RegisterPage.tsx
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Layout, Typography } from 'antd';
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
            navigate('/login');
        } catch (err) {
            setError('Registration error. User may already exist.');
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
                        <img src="/pwa-192x192.png" alt="NexaBudget Logo" style={{ width: '64px', height: '64px' }} />
                    </div>
                    <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>Sign Up</Title>
                    {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
                    <Form name="register" onFinish={onFinish} autoComplete="off" size="large">
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: 'Please enter a username!' }]}
                        >
                            <Input prefix={<UserOutlined />} placeholder="Username" />
                        </Form.Item>
                        <Form.Item
                            name="email"
                            rules={[{ required: true, message: 'Please enter your email!', type: 'email' }]}
                        >
                            <Input prefix={<MailOutlined />} placeholder="Email" />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Please enter a password!' }]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
                                Sign Up
                            </Button>
                        </Form.Item>
                    </Form>
                    <div style={{ textAlign: 'center' }}>
                        Already have an account? <Link to="/login">Sign In</Link>
                    </div>
                </Card>
            </Content>
        </Layout>
    );
};
