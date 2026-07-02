// src/components/AsyncBoundary.tsx
// Wrapper dichiarativo per viste guidate da React Query.
// Uniforma loading (Skeleton), error (EmptyState + Riprova), empty (EmptyState)
// in tutta l'app, sostituendo Spin inline e Empty nudo.
import type { ReactNode } from 'react';
import { Skeleton } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';

interface AsyncBoundaryProps {
    /** true durante il caricamento iniziale (isPending da useQuery) */
    loading: boolean;
    /**
     * Errore da mostrare (isError da useQuery).
     * Passare `null` o `undefined` per nascondere lo stato di errore.
     */
    error?: Error | null | unknown;
    /**
     * true quando i dati esistono ma la lista è vuota.
     * Se omesso, AsyncBoundary non mostrerà lo stato vuoto.
     */
    isEmpty?: boolean;
    /** Callback per ritentare la fetch (refetch da useQuery). */
    onRetry?: () => void;
    /**
     * Skeleton custom da mostrare durante il loading.
     * Default: <Skeleton active /> di Ant Design.
     */
    skeleton?: ReactNode;
    /**
     * EmptyState custom da mostrare quando isEmpty=true.
     * Default: EmptyState generico.
     */
    empty?: ReactNode;
    /** Contenuto da renderizzare quando i dati sono pronti e la lista non è vuota. */
    children: ReactNode;
}

/**
 * Convenzione: ogni vista guidata da useQuery rende i suoi stati tramite AsyncBoundary.
 * Non usare Spin inline o Empty nudo nelle viste che usano React Query.
 *
 * Priorità: loading > error > isEmpty > children
 */
export const AsyncBoundary = ({
    loading,
    error,
    isEmpty,
    onRetry,
    skeleton,
    empty,
    children,
}: AsyncBoundaryProps) => {
    const { t } = useTranslation();

    if (loading) {
        return <>{skeleton ?? <Skeleton active paragraph={{ rows: 4 }} />}</>;
    }

    if (error) {
        return (
            <EmptyState
                image={<WarningOutlined style={{ fontSize: 40 }} />}
                description={t('common.errorBoundaryDescription', {
                    defaultValue: 'Si è verificato un errore nel caricamento dei dati.',
                })}
                actions={
                    onRetry
                        ? [
                              {
                                  label: t('common.retry', { defaultValue: 'Riprova' }),
                                  onClick: onRetry,
                                  type: 'primary',
                              },
                          ]
                        : []
                }
            />
        );
    }

    if (isEmpty) {
        return <>{empty ?? <EmptyState description={t('common.noData', { defaultValue: 'Nessun dato disponibile.' })} />}</>;
    }

    return <>{children}</>;
};
