/* eslint-disable react-refresh/only-export-components */
import {createContext, type ReactNode, useContext, useEffect, useMemo, useState} from 'react';
import {i18n} from '../i18n';

export type ThemeMode = 'light' | 'dark';
export type AppLanguage = 'it' | 'en';

export interface ServerSettings {
    baseUrl?: string;
    timeoutMs?: number;
}

export interface PreferencesState {
    theme: ThemeMode;
    language: AppLanguage;
    server: ServerSettings;
}

interface PreferencesContextValue {
    preferences: PreferencesState;
    setTheme: (theme: ThemeMode) => void;
    setLanguage: (language: AppLanguage) => void;
    setServerSettings: (server: ServerSettings) => void;
}

const defaultPreferences: PreferencesState = {
    theme: 'light',
    language: 'it',
    server: {}
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const loadPreferences = (): PreferencesState => {
    try {
        const raw = localStorage.getItem('preferences');
        if (!raw) return defaultPreferences;
        const parsed = JSON.parse(raw) as Partial<PreferencesState>;
        return {
            theme: parsed.theme === 'dark' ? 'dark' : 'light',
            language: parsed.language === 'en' ? 'en' : 'it',
            server: parsed.server ?? {}
        };
    } catch {
        return defaultPreferences;
    }
};

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
    const [preferences, setPreferences] = useState<PreferencesState>(loadPreferences);

    useEffect(() => {
        localStorage.setItem('preferences', JSON.stringify(preferences));
    }, [preferences]);

    useEffect(() => {
        if (i18n.language !== preferences.language) {
            i18n.changeLanguage(preferences.language).catch(() => undefined);
        }
    }, [preferences.language]);

    const value = useMemo<PreferencesContextValue>(() => ({
        preferences,
        setTheme: (theme) => setPreferences((prev) => ({ ...prev, theme })),
        setLanguage: (language) => setPreferences((prev) => ({ ...prev, language })),
        setServerSettings: (server) => setPreferences((prev) => ({ ...prev, server }))
    }), [preferences]);

    return (
        <PreferencesContext.Provider value={value}>
            {children}
        </PreferencesContext.Provider>
    );
};

export const usePreferences = () => {
    const context = useContext(PreferencesContext);
    if (!context) {
        throw new Error('usePreferences must be used within a PreferencesProvider');
    }
    return context;
};
