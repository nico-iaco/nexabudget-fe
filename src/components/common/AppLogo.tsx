import { usePreferences } from '../../contexts/PreferencesContext';
import { GRADIENT_BRAND, GRADIENT_BRAND_DARK } from '../../theme/tokens';

interface AppLogoProps {
    /** Lato del quadrato, in px. */
    size?: number;
    /** Raggio degli angoli; default proporzionale a `size`. */
    radius?: number;
}

/**
 * Monogramma NexaBudget: tre barre ascendenti (stesso motivo delle sparkline
 * nelle card KPI) su un quadrato con il gradiente brand — un riferimento
 * diretto e minimale al tema "crescita del budget" invece di un placeholder vuoto.
 */
export const AppLogo = ({ size = 32, radius }: AppLogoProps) => {
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    const r = radius ?? Math.round(size * 0.28);
    const glyph = Math.round(size * 0.52);

    return (
        <div
            aria-hidden
            style={{
                width: size,
                height: size,
                borderRadius: r,
                background: isDark ? GRADIENT_BRAND_DARK : GRADIENT_BRAND,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
                <rect x="3" y="13" width="4.4" height="8" rx="1.6" fill="#fff" fillOpacity="0.55" />
                <rect x="9.8" y="8" width="4.4" height="13" rx="1.6" fill="#fff" fillOpacity="0.8" />
                <rect x="16.6" y="3" width="4.4" height="18" rx="1.6" fill="#fff" />
            </svg>
        </div>
    );
};
