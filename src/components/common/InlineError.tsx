import { Alert, Button } from 'antd';
import { useTranslation } from 'react-i18next';

interface InlineErrorProps {
    /** Testo dell'errore; default: messaggio generico "impossibile caricare questi dati". */
    message?: string;
    /** Se presente, mostra il pulsante Riprova. */
    onRetry?: () => void;
    style?: React.CSSProperties;
}

/**
 * Errore di caricamento compatto, da mettere al posto del contenuto di una card o di una
 * sezione. Esiste perché un dato mancante non va mai mostrato come "0,00 €" o come lista
 * vuota: l'utente deve capire che il dato non c'è, non che vale zero.
 * Per un'intera vista guidata da useQuery preferire AsyncBoundary.
 */
export const InlineError = ({ message, onRetry, style }: InlineErrorProps) => {
    const { t } = useTranslation();
    return (
        <Alert
            type="error"
            showIcon
            title={message ?? t('common.sectionLoadError')}
            action={onRetry && (
                <Button size="small" onClick={onRetry}>
                    {t('common.retry')}
                </Button>
            )}
            style={style}
        />
    );
};
