// src/App.tsx
import {createBrowserRouter, Navigate, Outlet, RouterProvider} from 'react-router-dom';
import {App as AntApp, ConfigProvider, theme as antTheme} from 'antd';
import {useAuth} from './contexts/AuthContext';
import {Layout} from './components/Layout';
import { Suspense, lazy } from 'react';
import type {JSX} from "react";
import {usePreferences} from './contexts/PreferencesContext';

// Dynamic imports (Code Splitting)
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const TransactionsPage = lazy(() => import('./pages/transactions/TransactionsPage').then(m => ({ default: m.TransactionsPage })));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const GoCardlessCallbackPage = lazy(() => import('./pages/gocardless/GoCardlessCallbackPage.tsx').then(m => ({ default: m.GoCardlessCallbackPage })));
const CryptoPage = lazy(() => import('./pages/crypto/CryptoPage').then(m => ({ default: m.CryptoPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const TrashPage = lazy(() => import('./pages/trash/TrashPage').then(m => ({ default: m.TrashPage })));
const BudgetsPage = lazy(() => import('./pages/budgets/BudgetsPage').then(m => ({ default: m.BudgetsPage })));
const AuditLogPage = lazy(() => import('./pages/audit/AuditLogPage').then(m => ({ default: m.AuditLogPage })));

const LoadingSpinner = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="ant-spin ant-spin-spinning ant-spin-lg"><span className="ant-spin-dot ant-spin-dot-spin"><i className="ant-spin-dot-item"></i><i className="ant-spin-dot-item"></i><i className="ant-spin-dot-item"></i><i className="ant-spin-dot-item"></i></span></div>
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


const router = createBrowserRouter([
    {
        path: '/',
        element: <PrivateRoute><Layout /></PrivateRoute>,
        children: [
            { index: true, element: <Navigate to="/dashboard" /> },
            {
                path: 'dashboard',
                element: <Suspense fallback={<LoadingSpinner />}><DashboardPage /></Suspense>,
            },
            {
                path: 'transactions',
                element: <Suspense fallback={<LoadingSpinner />}><TransactionsPage /></Suspense>,
            },
            {
                path: 'accounts/:accountId/transactions',
                element: <Suspense fallback={<LoadingSpinner />}><TransactionsPage /></Suspense>,
            },
            {
                path: 'gocardless/callback/:accountId',
                element: <Suspense fallback={<LoadingSpinner />}><GoCardlessCallbackPage /></Suspense>,
            },
            {
                path: 'crypto',
                element: <Suspense fallback={<LoadingSpinner />}><CryptoPage /></Suspense>,
            },
            {
                path: 'settings',
                element: <Suspense fallback={<LoadingSpinner />}><SettingsPage /></Suspense>,
            },
            {
                path: 'trash',
                element: <Suspense fallback={<LoadingSpinner />}><TrashPage /></Suspense>,
            },
            {
                path: 'budgets',
                element: <Suspense fallback={<LoadingSpinner />}><BudgetsPage /></Suspense>,
            },
            {
                path: 'audit-log',
                element: <Suspense fallback={<LoadingSpinner />}><AuditLogPage /></Suspense>,
            },
        ],
    },
    {
        path: '/',
        element: <RedirectIfAuth><PublicLayout /></RedirectIfAuth>,
        children: [
            { path: 'login', element: <Suspense fallback={<LoadingSpinner />}><LoginPage /></Suspense> },
            { path: 'register', element: <Suspense fallback={<LoadingSpinner />}><RegisterPage /></Suspense> },
        ]
    }
]);

function App() {
    const { preferences } = usePreferences();
    const algorithm = preferences.theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;

    return (
        <ConfigProvider theme={{ algorithm }}>
            <AntApp>
                <RouterProvider router={router} />
            </AntApp>
        </ConfigProvider>
    );
}

export default App;
