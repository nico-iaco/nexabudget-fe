// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './mobile.css'
import 'antd/dist/reset.css';
import './i18n';
import {AuthProvider} from './contexts/AuthContext.tsx';
import {PreferencesProvider} from './contexts/PreferencesContext.tsx';
import {registerPWA} from './pwaRegister';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';


dayjs.extend(customParseFormat);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <PreferencesProvider>
            <AuthProvider>
                <App />
            </AuthProvider>
        </PreferencesProvider>
    </React.StrictMode>,
)

// Registra il service worker per PWA
registerPWA();
