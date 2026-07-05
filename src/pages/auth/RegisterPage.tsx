// src/pages/auth/RegisterPage.tsx
import {LockOutlined, MailOutlined, UserOutlined} from '@ant-design/icons';
import {Alert, Button, Form, Input} from 'antd';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useNavigate} from 'react-router-dom';
import * as api from '../../services/api';
import type {UserRequest} from '../../types/api';
import {SPACING} from '../../theme/tokens';
import {AuthCard} from '../../components/common/AuthCard';

export const RegisterPage = () => {
    const { t } = useTranslation();
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
            setError(t('auth.registrationError'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthCard title={t('auth.signUp')} subtitle={t('app.name')}>
            {error && <Alert message={error} type="error" showIcon style={{ marginBottom: SPACING.lg }} />}
            <Form name="register" onFinish={onFinish} autoComplete="off" size="large">
                <Form.Item
                    name="username"
                    rules={[{ required: true, message: t('auth.usernameRequired') }]}
                >
                    <Input prefix={<UserOutlined />} placeholder={t('auth.username')} aria-label={t('auth.username')} />
                </Form.Item>
                <Form.Item
                    name="email"
                    rules={[{ required: true, message: t('auth.emailRequired'), type: 'email' }]}
                >
                    <Input prefix={<MailOutlined />} placeholder={t('auth.email')} aria-label={t('auth.email')} />
                </Form.Item>
                <Form.Item
                    name="password"
                    rules={[{ required: true, message: t('auth.passwordRequired') }]}
                >
                    <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} aria-label={t('auth.password')} />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
                        {t('auth.registerButton')}
                    </Button>
                </Form.Item>
            </Form>
            <div style={{ textAlign: 'center' }}>
                {t('auth.haveAccount')} <Link to="/login">{t('auth.signInNow')}</Link>
            </div>
        </AuthCard>
    );
};
