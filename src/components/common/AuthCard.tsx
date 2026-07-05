import type { ReactNode } from 'react';
import { Card, Layout, Typography } from 'antd';
import { usePreferences } from '../../contexts/PreferencesContext';
import { AUTH_BG_DARK, AUTH_BG_LIGHT, FONT_HEADING, SPACING } from '../../theme/tokens';
import { AppLogo } from './AppLogo';

const { Content } = Layout;
const { Title, Text } = Typography;

interface AuthCardProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
}

/** Shell condiviso da LoginPage e RegisterPage: sfondo sfumato + card centrata con logo a marchio. */
export const AuthCard = ({ title, subtitle, children }: AuthCardProps) => {
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';

    return (
        <Layout style={{ minHeight: '100vh', background: isDark ? AUTH_BG_DARK : AUTH_BG_LIGHT }}>
            <Content style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: `${SPACING.lg}px ${SPACING.md}px`
            }}>
                <Card style={{
                    width: '100%',
                    maxWidth: 400,
                    boxShadow: '0 8px 24px rgba(20,20,40,0.08)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: SPACING.md }}>
                        <AppLogo size={52} radius={14} />
                    </div>
                    <Title level={2} style={{ textAlign: 'center', marginBottom: 4, fontFamily: FONT_HEADING }}>{title}</Title>
                    {subtitle && (
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: SPACING.lg }}>
                            {subtitle}
                        </Text>
                    )}
                    {children}
                </Card>
            </Content>
        </Layout>
    );
};
