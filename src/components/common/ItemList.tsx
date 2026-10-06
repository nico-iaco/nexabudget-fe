// src/components/common/ItemList.tsx
import type { CSSProperties, Key, ReactNode } from 'react';
import { Pagination, Spin, theme } from 'antd';
import type { PaginationProps } from 'antd';
import { RADIUS, SPACING } from '../../theme/tokens';

interface ItemListProps<T> {
    items: readonly T[];
    rowKey: (item: T) => Key;
    renderItem: (item: T, index: number) => ReactNode;
    /**
     * Stato di caricamento (overlay Spin). Ometterlo per le liste che non caricano: lo
     * Spin ha un min-height di 200px (mobile.css) che lascerebbe spazio vuoto sotto.
     */
    loading?: boolean;
    /** Mostrato quando non ci sono elementi e non si sta caricando (default: niente). */
    empty?: ReactNode;
    /** Spazio verticale fra gli elementi, in px (default 0). */
    gap?: number;
    /** Contenitore con bordo, intestazione separata e divisori fra le righe. */
    bordered?: boolean;
    header?: ReactNode;
    /** Paginazione sotto la lista, centrata. Omessa se non passata. */
    pagination?: PaginationProps;
    /**
     * Liste lunghe di card su mobile: salta il rendering degli elementi fuori schermo
     * (`content-visibility: auto`, mobile.css). Non usarlo su righe focalizzabili: il
     * contenimento del paint taglierebbe l'anello di focus.
     */
    deferOffscreen?: boolean;
    style?: CSSProperties;
    'aria-label'?: string;
}

/**
 * Lista generica di elementi, al posto di `List` di AntD — deprecato in AntD 6 e rimosso
 * nella 7. Copre quello che usavamo davvero: renderItem, loading, stato vuoto, variante
 * bordata con header, paginazione. Il contenuto di ogni riga (azioni, titolo/descrizione)
 * lo compone chi chiama, con Flex/Typography.
 *
 * Markup semantico `<ul>/<li>`; la classe `nb-list-item` è il gancio per gli stili mobile
 * (touch-action, content-visibility) che prima stavano su `.ant-list-item`.
 */
export const ItemList = <T,>({
    items, rowKey, renderItem, loading, empty = null, gap = 0,
    bordered = false, header, pagination, deferOffscreen = false, style, 'aria-label': ariaLabel,
}: ItemListProps<T>) => {
    const { token } = theme.useToken();
    const isEmpty = !loading && items.length === 0;

    const list = (
        <ul
            className={deferOffscreen ? 'nb-item-list nb-item-list--defer' : 'nb-item-list'}
            aria-label={ariaLabel}
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap }}
        >
            {items.map((item, index) => (
                <li
                    key={rowKey(item)}
                    className="nb-list-item"
                    style={bordered ? {
                        padding: `${SPACING.sm}px ${SPACING.md}px`,
                        borderTop: index > 0 || header ? `1px solid ${token.colorSplit}` : undefined,
                    } : undefined}
                >
                    {renderItem(item, index)}
                </li>
            ))}
        </ul>
    );

    const body = bordered ? (
        <div style={{ border: `1px solid ${token.colorBorder}`, borderRadius: RADIUS.md }}>
            {header && <div style={{ padding: `${SPACING.sm}px ${SPACING.md}px` }}>{header}</div>}
            {isEmpty ? empty : list}
        </div>
    ) : (
        <>
            {header}
            {isEmpty ? empty : list}
        </>
    );

    return (
        // fontSize esplicito: dentro un Radio.Group (che azzera il font-size del contenitore)
        // l'header testuale spariva; prima lo ripristinava lo Spin di List.
        <div style={{ fontSize: token.fontSize, ...style }}>
            {loading === undefined ? body : <Spin spinning={loading}>{body}</Spin>}
            {pagination && !isEmpty && (
                <Pagination align="center" style={{ marginTop: SPACING.md }} {...pagination} />
            )}
        </div>
    );
};
