// src/App.tsx
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Spin, theme as antTheme } from 'antd';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Suspense, lazy, type ReactNode } from 'react';
import type { JSX } from 'react';
import { usePreferences } from './contexts/PreferencesContext';
import { FONT_BODY, PRIMARY_DARK_HEX, PRIMARY_LIGHT_HEX, RADIUS, RADIUS_BASE } from './theme/tokens';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { RouteErrorFallback } from './components/common/RouteErrorFallback';

// Dynamic imports (Code Splitting)
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const TransactionsPage = lazy(() => import('./pages/transactions/TransactionsPage').then(m => ({ default: m.TransactionsPage })));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const GoCardlessCallbackPage = lazy(() => import('./pages/gocardless/GoCardlessCallbackPage.tsx').then(m => ({ default: m.GoCardlessCallbackPage })));
const EnableBankingCallbackPage = lazy(() => import('./pages/banking/EnableBankingCallbackPage.tsx').then(m => ({ default: m.EnableBankingCallbackPage })));
const CryptoPage = lazy(() => import('./pages/crypto/CryptoPage').then(m => ({ default: m.CryptoPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const TrashPage = lazy(() => import('./pages/trash/TrashPage').then(m => ({ default: m.TrashPage })));
const BudgetsPage = lazy(() => import('./pages/budgets/BudgetsPage').then(m => ({ default: m.BudgetsPage })));
const AuditLogPage = lazy(() => import('./pages/audit/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const ChatPage = lazy(() => import('./pages/chat/ChatPage').then(m => ({ default: m.ChatPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

const LoadingSpinner = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
    </div>
);

const PublicLayout = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Outlet />
    </div>
);

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
    const { auth } = useAuth();
    return auth ? children : <Navigate to="/login" />;
};

const RedirectIfAuth = ({ children }: { children: JSX.Element }) => {
    const { auth } = useAuth();
    return auth ? <Navigate to="/" /> : children;
};

/**
 * Helper che wrappa ogni pagina lazy con Suspense + ErrorBoundary.
 * Il boundary usa resetKeys con il pathname corrente: navigando su un'altra route
 * lo stato di errore si resetta automaticamente (sider/header rimangono vivi).
 */
const LazyRoute = ({ children }: { children: ReactNode }) => {
    const location = useLocation();
    return (
        <ErrorBoundary
            resetKeys={[location.pathname]}
            fallback={(error, reset) => <RouteErrorFallback error={error} onReset={reset} />}
        >
            <Suspense fallback={<LoadingSpinner />}>
                {children}
            </Suspense>
        </ErrorBoundary>
    );
};

const router = createBrowserRouter([
    {
        path: '/',
        element: <PrivateRoute><Layout /></PrivateRoute>,
        children: [
            { index: true, element: <Navigate to="/dashboard" /> },
            {
                path: 'dashboard',
                element: <LazyRoute><DashboardPage /></LazyRoute>,
            },
            {
                path: 'transactions',
                element: <LazyRoute><TransactionsPage /></LazyRoute>,
            },
            {
                path: 'accounts/:accountId/transactions',
                element: <LazyRoute><TransactionsPage /></LazyRoute>,
            },
            {
                path: 'gocardless/callback/:accountId',
                element: <LazyRoute><GoCardlessCallbackPage /></LazyRoute>,
            },
            {
                // Redirect_url statico e unico registrato in ENABLEBANKING_REDIRECT_URL:
                // porta con sé `?code=...&state=<localAccountId>` in query string.
                path: 'banking/enable-banking/callback',
                element: <LazyRoute><EnableBankingCallbackPage /></LazyRoute>,
            },
            {
                path: 'crypto',
                element: <LazyRoute><CryptoPage /></LazyRoute>,
            },
            {
                path: 'settings',
                element: <LazyRoute><SettingsPage /></LazyRoute>,
            },
            {
                path: 'trash',
                element: <LazyRoute><TrashPage /></LazyRoute>,
            },
            {
                path: 'budgets',
                element: <LazyRoute><BudgetsPage /></LazyRoute>,
            },
            {
                path: 'audit-log',
                element: <LazyRoute><AuditLogPage /></LazyRoute>,
            },
            {
                path: 'chat',
                element: <LazyRoute><ChatPage /></LazyRoute>,
            },
            {
                path: '*',
                element: <LazyRoute><NotFoundPage /></LazyRoute>,
            },
        ],
    },
    {
        path: '/',
        element: <RedirectIfAuth><PublicLayout /></RedirectIfAuth>,
        children: [
            { path: 'login', element: <LazyRoute><LoginPage /></LazyRoute> },
            { path: 'register', element: <LazyRoute><RegisterPage /></LazyRoute> },
        ]
    },
    {
        path: '*',
        element: <LazyRoute><NotFoundPage /></LazyRoute>,
    },
]);

function App() {
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    const algorithm = isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;

    return (
        <ConfigProvider
            theme={{
                algorithm,
                token: {
                    colorPrimary: isDark ? PRIMARY_DARK_HEX : PRIMARY_LIGHT_HEX,
                    borderRadius: RADIUS_BASE,
                    borderRadiusLG: RADIUS.card,
                    fontFamily: FONT_BODY,
                },
                components: {
                    Card: {
                        borderRadiusLG: RADIUS.card,
                    },
                    Button: {
                        borderRadius: 10,
                        controlHeight: 38,
                    },
                    Menu: {
                        itemBorderRadius: 9,
                        itemHeight: 38,
                        itemMarginInline: 8,
                    },
                    Modal: {
                        borderRadiusLG: RADIUS.card,
                    },
                },
            }}
            getPopupContainer={(triggerNode) => {
                const drawer = triggerNode?.closest?.('.ant-drawer-body');
                if (drawer) return drawer as HTMLElement;
                const modal = triggerNode?.closest?.('.ant-modal-body');
                if (modal) return modal as HTMLElement;
                return document.body;
            }}
        >
            <AntApp>
                <RouterProvider router={router} />
            </AntApp>
        </ConfigProvider>
    );
}

export default App;
