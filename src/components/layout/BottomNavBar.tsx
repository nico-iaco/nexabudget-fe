import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';
import {
    ContainerOutlined,
    FundOutlined,
    PieChartOutlined,
    SettingOutlined,
    TransactionOutlined,
} from '@ant-design/icons';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const NAV_ITEMS = (t: (k: string) => string) => [
    { path: '/dashboard', icon: <PieChartOutlined />, label: t('nav.dashboard') },
    { path: '/transactions', icon: <TransactionOutlined />, label: t('nav.transactions') },
    { path: '/budgets', icon: <ContainerOutlined />, label: t('nav.budgets') },
    { path: '/crypto', icon: <FundOutlined />, label: t('nav.crypto') },
    { path: '/settings', icon: <SettingOutlined />, label: t('nav.settings') },
];

export const BottomNavBar = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { token } = theme.useToken();

    if (!isMobile) return null;

    const items = NAV_ITEMS(t);

    return (
        <nav
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                background: token.colorBgContainer,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                zIndex: 999,
                boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
            }}
        >
            {items.map(({ path, icon, label }) => {
                const isActive = location.pathname === path ||
                    (path === '/transactions' && location.pathname.startsWith('/accounts/'));
                return (
                    <button
                        key={path}
                        onClick={() => navigate(path)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: isActive ? token.colorPrimary : token.colorTextSecondary,
                            fontSize: 10,
                            fontWeight: isActive ? 600 : 400,
                            padding: '6px 0',
                            transition: 'color 0.2s',
                            WebkitTapHighlightColor: 'transparent',
                        }}
                        aria-label={label}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
                        <span>{label}</span>
                    </button>
                );
            })}
        </nav>
    );
};
