import type React from 'react';
import { memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';
import {
    ContainerOutlined,
    PieChartOutlined,
    RobotOutlined,
    SettingOutlined,
    TransactionOutlined,
} from '@ant-design/icons';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { NAV_ITEMS as ALL_NAV_ITEMS } from './navItems';

/** Icone per la bottom-bar — stesso mapping di AppSider, solo subset mobile */
const BOTTOM_BAR_ICON_MAP: Record<string, React.ReactNode> = {
    '/dashboard':    <PieChartOutlined />,
    '/transactions': <TransactionOutlined />,
    '/budgets':      <ContainerOutlined />,
    '/chat':         <RobotOutlined />,
    '/settings':     <SettingOutlined />,
};

const BottomNavBarInner = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { isSmallMobile } = useBreakpoints();
    const { token } = theme.useToken();

    if (!isSmallMobile) return null;

    // Filtro dentro il componente (non a livello modulo) per evitare problemi
    // di inizializzazione nel bundle di produzione Rollup/Vite
    const bottomBarItems = (Array.isArray(ALL_NAV_ITEMS) ? ALL_NAV_ITEMS : [])
        .filter(item => item.showInBottomBar);

    return (
        <nav
            aria-label={t('common.menu')}
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
                transform: 'translateZ(0)',
                willChange: 'transform',
            }}
        >
            {bottomBarItems.map(({ key, labelKey }) => {
                const label = t(labelKey);
                const icon = BOTTOM_BAR_ICON_MAP[key];
                const isActive = location.pathname === key ||
                    (key === '/transactions' && location.pathname.startsWith('/accounts/'));
                return (
                    <button
                        key={key}
                        onClick={() => navigate(key)}
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

export const BottomNavBar = memo(BottomNavBarInner);
