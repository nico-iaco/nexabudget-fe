import {App, Card, Divider, Flex, Form, Input, Typography, theme} from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { SafeSelect } from '../../components/common/SafeSelect';
import {useTranslation} from 'react-i18next';
import {usePreferences} from '../../contexts/PreferencesContext';
import {useAuth} from '../../contexts/AuthContext';
import {updateUserProfile} from '../../services/api';
import {useState} from 'react';
import {ApiKeysCard} from './ApiKeysCard';
import {CategoriesCard} from './CategoriesCard';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PageHeader } from '../../components/common/PageHeader';
import { SPACING } from '../../theme/tokens';

const { Text } = Typography;

export const SettingsPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    usePageTitle(t('settings.title'));
    const { preferences, setLanguage, setTheme, setServerSettings } = usePreferences();
    const { auth, updateUser } = useAuth();
    const [updatingParams, setUpdatingParams] = useState(false);
    const { token } = theme.useToken();

    const handleUpdateCurrency = async (newCurrency: string) => {
        try {
            setUpdatingParams(true);
            const { data } = await updateUserProfile({ defaultCurrency: newCurrency });
            updateUser(data);
            message.success(t('settings.profileUpdateSuccess'));
        } catch (error) {
            message.error(t('settings.profileUpdateError'));
        } finally {
            setUpdatingParams(false);
        }
    };

    return (
        <div style={{ maxWidth: 720, marginInline: 'auto' }}>
            <PageHeader title={t('settings.title')} />

            <Card title={t('settings.profileTitle')} style={{ marginBottom: SPACING.md }}>
                <Form layout="vertical">
                    <Form.Item label={t('settings.username')}>
                        <Input value={auth?.username} disabled />
                    </Form.Item>
                    <Form.Item label={t('settings.email')}>
                        <Input value={auth?.email} disabled />
                    </Form.Item>
                    <Form.Item label={t('settings.defaultCurrency')}>
                        <SafeSelect
                            value={auth?.defaultCurrency || 'EUR'}
                            onChange={(v) => handleUpdateCurrency(v as string)}
                            disabled={updatingParams}
                            options={[
                                { value: 'EUR', label: 'EUR (€)' },
                                { value: 'USD', label: 'USD ($)' },
                                { value: 'GBP', label: 'GBP (£)' },
                                { value: 'CHF', label: 'CHF' },
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Card>

            <Card title={t('settings.appearanceTitle')} style={{ marginBottom: SPACING.md }}>
                <Flex gap={SPACING.sm}>
                    {([
                        { value: 'light' as const, label: t('settings.themeLight'), swatchBg: '#fff', swatchBorder: '#ecedf0' },
                        { value: 'dark' as const, label: t('settings.themeDark'), swatchBg: '#1a1d29', swatchBorder: '#1a1d29' },
                    ]).map(opt => {
                        const selected = preferences.theme === opt.value;
                        return (
                            <div
                                key={opt.value}
                                role="radio"
                                aria-checked={selected}
                                tabIndex={0}
                                onClick={() => setTheme(opt.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setTheme(opt.value); }}
                                style={{
                                    flex: 1,
                                    cursor: 'pointer',
                                    borderRadius: 11,
                                    padding: 10,
                                    textAlign: 'center',
                                    border: `2px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
                                    background: selected ? token.colorPrimaryBg : 'transparent',
                                }}
                            >
                                <div style={{
                                    width: '100%',
                                    height: 40,
                                    borderRadius: 7,
                                    marginBottom: 8,
                                    background: opt.swatchBg,
                                    border: `1px solid ${opt.swatchBorder}`,
                                }} />
                                <Flex align="center" justify="center" gap={4}>
                                    {selected && <CheckCircleFilled style={{ color: token.colorPrimary, fontSize: 12 }} />}
                                    <Typography.Text strong={selected} style={{ color: selected ? token.colorPrimary : token.colorTextSecondary, fontSize: 13 }}>
                                        {opt.label}
                                    </Typography.Text>
                                </Flex>
                            </div>
                        );
                    })}
                </Flex>
            </Card>

            <Card title={t('settings.languageTitle')} style={{ marginBottom: SPACING.md }}>
                <Form layout="vertical">
                    <Form.Item label={t('settings.language')}>
                        <SafeSelect
                            value={preferences.language}
                            onChange={(v) => setLanguage(v as Parameters<typeof setLanguage>[0])}
                            options={[
                                { value: 'it', label: t('settings.languageIt') },
                                { value: 'en', label: t('settings.languageEn') }
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Card>

            <ApiKeysCard />

            <CategoriesCard />

            <Card title={t('settings.serverTitle')}>
                <Text type="secondary">{t('settings.serverPlaceholder')}</Text>
                <Divider style={{ margin: `${SPACING.md}px 0` }} />
                <Form
                    layout="vertical"
                    initialValues={{
                        baseUrl: preferences.server.baseUrl,
                        timeoutMs: preferences.server.timeoutMs
                    }}
                    onValuesChange={(_, values) => setServerSettings(values)}
                >
                    <Form.Item label={t('settings.serverBaseUrl')} name="baseUrl">
                        <Input placeholder="https://api.example.com" disabled />
                    </Form.Item>
                    <Form.Item label={t('settings.serverTimeout')} name="timeoutMs">
                        <Input placeholder={t('settings.serverTimeoutPlaceholder')} disabled />
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};
