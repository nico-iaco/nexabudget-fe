import {Button, Layout, theme, Typography} from 'antd';
import {LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

const { Header } = Layout;
const { Title } = Typography;

interface AppHeaderProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    isMobile: boolean;
    onLogout: () => void;
}

export const AppHeader = ({ collapsed, setCollapsed, isMobile, onLogout }: AppHeaderProps) => {
    const { t } = useTranslation();
    const {
        token: { colorBgContainer },
    } = theme.useToken();

    return (
        <Header style={{
            padding: isMobile ? '0 12px' : '0 16px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
            <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: '16px', width: 64, height: 64 }}
            />
            <Title
                level={3}
                style={{
                    margin: 0,
                    fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontSize: isMobile ? '20px' : '24px',
                    letterSpacing: '-0.5px'
                }}
            >
                {t('app.name')}
            </Title>
            <Button type="primary" icon={<LogoutOutlined />} onClick={onLogout}>
                {!isMobile && t('common.logout')}
            </Button>
        </Header>
    );
};
