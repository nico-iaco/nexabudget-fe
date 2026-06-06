// src/components/ErrorBoundary.tsx
// Error Boundary applicativo per catturare errori di render nelle pagine lazy e nei grafici.
// Non richiede dipendenze aggiuntive (implementazione class component nativa).
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /**
     * Fallback da renderizzare quando si verifica un errore.
     * Può essere un ReactNode statico oppure una funzione che riceve
     * l'errore e una callback `reset` per ripristinare lo stato.
     */
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    /** Callback chiamata quando viene catturato un errore (utile per telemetria). */
    onReset?: () => void;
    /**
     * Array di valori: quando uno di essi cambia, il boundary si resetta automaticamente.
     * Usato in App.tsx con `resetKeys={[location.pathname]}` per uscire dallo stato di errore
     * navigando verso un'altra route.
     */
    resetKeys?: unknown[];
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
        this.reset = this.reset.bind(this);
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary] Errore catturato:', error, info.componentStack);
    }

    componentDidUpdate(prevProps: Props) {
        const { resetKeys } = this.props;
        if (this.state.hasError && resetKeys && prevProps.resetKeys) {
            const changed = resetKeys.some((key, i) => key !== prevProps.resetKeys![i]);
            if (changed) this.reset();
        }
    }

    reset() {
        this.props.onReset?.();
        this.setState({ hasError: false, error: null });
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        const { fallback } = this.props;
        if (!fallback) return null;

        if (typeof fallback === 'function') {
            return (fallback as (error: Error, reset: () => void) => ReactNode)(
                this.state.error!,
                this.reset
            );
        }

        return fallback;
    }
}
