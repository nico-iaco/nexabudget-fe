// src/contexts/AuthContext.tsx
/* eslint-disable react-refresh/only-export-components */
import {createContext, type ReactNode, useContext, useEffect, useRef, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import type {AuthResponse} from '../types/api';
import {clearCachedApiResponses} from '../services/api';

interface AuthContextType {
    auth: AuthResponse | null;
    login: (authData: AuthResponse) => void;
    logout: () => void;
    updateUser: (userData: Partial<AuthResponse>) => void;
    /** true dopo un logout volontario: PrivateRoute non ricorda la pagina da cui si è usciti. */
    explicitLogout: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Un valore corrotto in localStorage (scritto a mano, troncato) mandava in crash l'app
// sopra ogni ErrorBoundary: schermo bianco. Meglio ripartire non autenticati.
const parseStoredAuth = (raw: string | null): AuthResponse | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as AuthResponse | null;
        return parsed && typeof parsed === 'object' && parsed.token ? parsed : null;
    } catch {
        return null;
    }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const queryClient = useQueryClient();
    const [auth, setAuth] = useState<AuthResponse | null>(() => parseStoredAuth(localStorage.getItem('auth')));

    // Più schede: il token è condiviso (l'interceptor lo legge da localStorage), lo stato
    // React no. Senza sincronizzazione, un logout/login come altro utente in una scheda
    // lasciava l'altra con il nome del primo utente e i dati in cache del primo, ma le
    // richieste firmate col token del secondo — e un updateUser lì riscriveva il token vecchio.
    const [explicitLogout, setExplicitLogout] = useState(false);
    const authRef = useRef(auth);
    useEffect(() => { authRef.current = auth; });
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== 'auth' && e.key !== null) return;
            const next = parseStoredAuth(localStorage.getItem('auth'));
            if (authRef.current?.token === next?.token) return;
            queryClient.clear();
            clearCachedApiResponses();
            setAuth(next);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [queryClient]);

    useEffect(() => {
        const token = auth?.token;
        if (token) {
            localStorage.setItem('authToken', token);
            localStorage.setItem('auth', JSON.stringify(auth));
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('auth');
        }
    }, [auth]);

    const login = (authData: AuthResponse) => {
        setExplicitLogout(false);
        setAuth(authData);
    };

    const logout = () => {
        setExplicitLogout(true);
        setAuth(null);
        // Le query key non sono legate all'utente: senza clear(), chi fa login nella stessa
        // scheda entro lo staleTime vedrebbe conti e saldi dell'utente precedente.
        queryClient.clear();
        clearCachedApiResponses();
    };

    const updateUser = (userData: Partial<AuthResponse>) => {
        setAuth(prev => prev ? { ...prev, ...userData } : null);
    };

    return (
        <AuthContext.Provider value={{ auth, login, logout, updateUser, explicitLogout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
