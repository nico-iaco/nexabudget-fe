import {Card, Divider, Form, Input, Radio, Select, Space, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {usePreferences} from '../../contexts/PreferencesContext';

const { Title, Text } = Typography;

export const SettingsPage = () => {
    const { t } = useTranslation();
    const { preferences, setLanguage, setTheme, setServerSettings } = usePreferences();

    return (
        <div style={{ maxWidth: 720 }}>
            <Title level={2} style={{ marginTop: 0 }}>{t('settings.title')}</Title>

            <Card title={t('settings.appearanceTitle')} style={{ marginBottom: 16 }}>
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

            <Card title={t('settings.languageTitle')} style={{ marginBottom: 16 }}>
                <Form layout="vertical">
                    <Form.Item label={t('settings.language')}>
                        <Select
                            value={preferences.language}
                            onChange={(value) => setLanguage(value)}
                            options={[
                                { value: 'it', label: t('settings.languageIt') },
                                { value: 'en', label: t('settings.languageEn') }
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Card>

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
