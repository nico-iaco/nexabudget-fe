// src/hooks/useConfirm.ts
// Wrapper su App.useApp().modal.confirm per dialog di conferma delete a livello pagina.
// Regola: usare questo hook per azioni destructive modali (es. delete account, delete sessione chat).
//         Usare Popconfirm inline per azioni su singola riga di tabella.
import { App } from 'antd';

interface ConfirmOptions {
    title: string;
    content?: string;
    okText?: string;
    cancelText?: string;
    danger?: boolean;
    onOk: () => void | Promise<void>;
    onCancel?: () => void;
}

/**
 * Hook per mostrare un dialog di conferma modale.
 * Sostituisce il `<Modal>` custom in Layout.tsx e garantisce uno stile coerente
 * per tutte le conferme destructive nell'app.
 *
 * @example
 * const confirm = useConfirm();
 * confirm({
 *   title: 'Elimina account',
 *   content: 'Questa azione non può essere annullata.',
 *   danger: true,
 *   okText: 'Elimina',
 *   onOk: () => deleteAccount(id),
 * });
 */
export const useConfirm = () => {
    const { modal } = App.useApp();

    return (opts: ConfirmOptions) => {
        modal.confirm({
            title: opts.title,
            content: opts.content,
            okText: opts.okText ?? 'Conferma',
            cancelText: opts.cancelText ?? 'Annulla',
            okButtonProps: opts.danger ? { danger: true } : undefined,
            onOk: opts.onOk,
            onCancel: opts.onCancel,
        });
    };
};
