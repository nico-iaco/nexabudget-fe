import {App, Card, Divider, Form, Input, Radio, Space, Typography} from 'antd';
import { SafeSelect } from '../../components/SafeSelect';
import {useTranslation} from 'react-i18next';
import {usePreferences} from '../../contexts/PreferencesContext';
import {useAuth} from '../../contexts/AuthContext';
import {updateUserProfile} from '../../services/api';
import {useState} from 'react';
import {ApiKeysCard} from './ApiKeysCard';
import {CategoriesCard} from './CategoriesCard';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PageHeader } from '../../components/PageHeader';
import { SPACING } from '../../theme/tokens';

const { Text } = Typography;

export const SettingsPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    usePageTitle(t('settings.title'));
    const { preferences, setLanguage, setTheme, setServerSettings } = usePreferences();
    const { auth, updateUser } = useAuth();
    const [updatingParams, setUpdatingParams] = useState(false);

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
                <Form layout="vertical">
                    <Form.Item label={t('settings.theme')}>
                        <Radio.Group
                            value={preferences.theme}
                            onChange={(e) => setTheme(e.target.value)}
                        >
                            <Space direction="vertical">
                                <Radio value="light">{t('settings.themeLight')}</Radio>
                                <Radio value="dark">{t('settings.themeDark')}</Radio>
                            </Space>
                        </Radio.Group>
                    </Form.Item>
                </Form>
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
                <Divider style={{ margin: '16px 0' }} />
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
