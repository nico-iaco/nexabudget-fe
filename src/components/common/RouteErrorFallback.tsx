// src/components/RouteErrorFallback.tsx
// UI di fallback usata da ErrorBoundary sulle route e sulle sezioni grafici.
// Riusa EmptyState per coerenza visiva; colori da theme.useToken().
import { theme, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';
import { SPACING } from '../../theme/tokens';

const { Text } = Typography;

interface RouteErrorFallbackProps {
    /** Errore catturato dal boundary (usato per il messaggio di dettaglio). */
    error?: Error | null;
    /** Callback per riprovare — resetta il boundary e ritenta il render. */
    onReset?: () => void;
    /** Se true, mostra il fallback in modalità compatta (per sezioni interne come i grafici). */
    compact?: boolean;
}

export const RouteErrorFallback = ({ error, onReset, compact = false }: RouteErrorFallbackProps) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();

    const description = t('common.errorBoundaryDescription', {
        defaultValue: 'Si è verificato un errore imprevisto in questa sezione.',
    });

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: compact ? token.paddingMD : token.paddingXL,
                minHeight: compact ? 120 : 280,
            }}
        >
            <EmptyState
                image={<WarningOutlined style={{ fontSize: 48, color: token.colorWarning }} />}
                description={description}
                style={{ marginTop: compact ? 0 : SPACING.xxl }}
                actions={
                    onReset
                        ? [
                              {
                                  label: t('common.retry', { defaultValue: 'Riprova' }),
                                  onClick: onReset,
                                  type: 'primary',
                              },
                          ]
                        : []
                }
            />
            {!compact && error?.message && (
                <Text
                    type="secondary"
                    style={{
                        fontSize: token.fontSizeSM,
                        marginTop: token.marginXS,
                        maxWidth: 480,
                        textAlign: 'center',
                        fontFamily: 'monospace',
                    }}
                >
                    {error.message}
                </Text>
            )}
        </div>
    );
};

/**
 * Versione compatta per wrappare sezioni interne (es. grafici dashboard).
 * Non mostra il dettaglio dell'errore — solo l'icona e il bottone "Riprova".
 */
export const CompactErrorFallback = ({ onReset }: { onReset?: () => void }) => (
    <RouteErrorFallback onReset={onReset} compact />
);
