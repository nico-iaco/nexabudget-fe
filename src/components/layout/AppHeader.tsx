import { type RefObject } from 'react';
import {Avatar, Button, Flex, Layout, theme, Typography} from 'antd';
import {LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { FONT_HEADING, FONT_SIZE, SHADOW, SPACING } from '../../theme/tokens';

const { Header } = Layout;
const { Title } = Typography;

interface AppHeaderProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    isMobile: boolean;
    onLogout: () => void;
    toggleRef?: RefObject<HTMLButtonElement | null>;
}

export const AppHeader = ({ collapsed, setCollapsed, isMobile, onLogout, toggleRef }: AppHeaderProps) => {
    const { t } = useTranslation();
    const { auth } = useAuth();
    const {
        token: { colorBgContainer, colorPrimary, colorPrimaryActive },
    } = theme.useToken();
    const initials = (auth?.username || '?').slice(0, 2).toUpperCase();

    // Il titolo della pagina vive solo nel PageHeader di ogni pagina (heading
    // grande nel corpo) — l'header globale mostra il brand per evitare di
    // ripetere lo stesso testo due volte (in piccolo qui, in grande sotto).

    return (
        <Header style={{
            padding: isMobile ? `0 ${SPACING.sm}px` : `0 ${SPACING.md}px`,
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            boxShadow: SHADOW.header
        }}>
            <Button
                ref={toggleRef}
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: `${FONT_SIZE.xl}px`, width: 64, height: 64 }}
                aria-label={t('common.menu')}
                aria-expanded={!collapsed}
            />
            <Title level={1} style={{ margin: 0, fontSize: isMobile ? `${FONT_SIZE.xxxl}px` : `${FONT_SIZE.display}px` }}>
                {/* Gradient applicato allo span interno per evitare conflitti con gli stili AntD di Typography.Title */}
                <span
                    style={{
                        fontFamily: FONT_HEADING,
                        fontWeight: 800,
                        color: colorPrimary,
                        background: `linear-gradient(135deg, ${colorPrimary} 0%, ${colorPrimaryActive} 100%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        letterSpacing: '-0.5px',
                    }}
                >
                    {t('app.name')}
                </span>
            </Title>
            <Flex align="center" gap={SPACING.sm}>
                <Avatar
                    size={32}
                    style={{
                        background: colorPrimary,
                        fontFamily: FONT_HEADING,
                        fontWeight: 700,
                        fontSize: FONT_SIZE.sm,
                    }}
                >
                    {initials}
                </Avatar>
                <Button type="primary" icon={<LogoutOutlined />} onClick={onLogout} aria-label={t('common.logout')}>
                    {!isMobile && t('common.logout')}
                </Button>
            </Flex>
        </Header>
    );
};
