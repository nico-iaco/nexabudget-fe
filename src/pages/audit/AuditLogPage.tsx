import { memo, useEffect, useState } from 'react';
import { App, Card, Collapse, Flex, Table, Tag, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { AuditAction, AuditLogEntry } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { InlineError } from '../../components/common/InlineError';
import { ItemList } from '../../components/common/ItemList';
import { FONT_SIZE, SPACING, RADIUS } from '../../theme/tokens';

const { Text } = Typography;

const ACTION_COLORS: Record<AuditAction, string> = {
    CREATE_TRANSACTION: 'green',
    UPDATE_TRANSACTION: 'blue',
    DELETE_TRANSACTION: 'red',
    CREATE_TRANSFER: 'cyan',
    CREATE_ACCOUNT: 'green',
    UPDATE_ACCOUNT: 'blue',
    DELETE_ACCOUNT: 'red',
    CREATE_BUDGET: 'green',
    UPDATE_BUDGET: 'blue',
    DELETE_BUDGET: 'red',
    CREATE_CATEGORY: 'green',
    UPDATE_CATEGORY: 'blue',
    DELETE_CATEGORY: 'red',
};

const formatValue = (raw: string) => {
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
};

/**
 * Anteprima JSON del valore di un'entry di audit.
 * Esiste come componente proprio perché il ramo mobile la mostra dentro un Collapse:
 * passando `formatValue(record.newValue)` come children dell'item, la chiamata veniva
 * valutata subito — i children React sono costruiti in modo eager — quindi il
 * parse+stringify girava per tutte e 20 le righe della pagina anche da collassate.
 * Dentro un componente, il lavoro avviene solo quando il pannello viene aperto.
 */
const JsonPreview = memo(({ raw, maxHeight, fontSize, background }: {
    raw: string;
    maxHeight: number;
    fontSize: number;
    background: string;
}) => (
    <pre style={{ fontSize, maxHeight, overflow: 'auto', margin: 0, background, padding: SPACING.xs, borderRadius: RADIUS.sm }}>
        {formatValue(raw)}
    </pre>
));
JsonPreview.displayName = 'JsonPreview';

export const AuditLogPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const { token } = theme.useToken();
    usePageTitle(t('audit.title'));
    const { isSmallMobile: isMobile } = useBreakpoints();

    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    // true da subito: il fetch parte al mount, e con false il primo render mostrava
    // per un istante "nessuna attività registrata".
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const pageSize = 20;

    const fetchLog = async (p: number) => {
        setLoading(true);
        try {
            const resp = await api.getAuditLog(p - 1, pageSize);
            setEntries(Array.isArray(resp.data.content) ? resp.data.content : []);
            setTotal(resp.data.page?.totalElements ?? 0);
            setLoadError(false);
        } catch {
            message.error(t('audit.loadError'));
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLog(1); }, []);

    // Larghezze fisse tranne l'azione, che prende lo spazio rimanente: con tableLayout="fixed"
    // la tabella resta larga quanto il contenitore. L'IP (IPv6 fino a 39 caratteri) va in
    // ellissi e sparisce sotto xl, dove lo spazio serve alle colonne principali.
    const columns: ColumnsType<AuditLogEntry> = [
        {
            title: t('audit.timestamp'),
            dataIndex: 'timestamp',
            key: 'timestamp',
            render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
            width: 150,
        },
        {
            title: t('audit.action'),
            dataIndex: 'action',
            key: 'action',
            ellipsis: true,
            render: (v: AuditAction) => (
                <Tag color={ACTION_COLORS[v]}>
                    {t(`audit.actions.${v}`)}
                </Tag>
            ),
        },
        {
            title: t('audit.entityType'),
            dataIndex: 'entityType',
            key: 'entityType',
            width: 120,
            ellipsis: { showTitle: true },
        },
        {
            title: t('audit.entityId'),
            dataIndex: 'entityId',
            key: 'entityId',
            width: 120,
            render: (v: string) => (
                <Text copyable={{ text: v }} style={{ fontSize: FONT_SIZE.sm, fontFamily: 'monospace' }}>
                    {v.substring(0, 8)}…
                </Text>
            ),
        },
        {
            title: t('audit.ipAddress'),
            dataIndex: 'ipAddress',
            key: 'ipAddress',
            width: 200,
            ellipsis: { showTitle: true },
            responsive: ['xl'],
        },
    ];

    const paginationProps = {
        current: page,
        pageSize,
        total,
        showSizeChanger: false,
        showTotal: (tot: number) => `${tot} ${t('audit.title').toLowerCase()}`,
        onChange: (p: number) => {
            setPage(p);
            fetchLog(p);
        },
    };


    return (
        <>
            <PageHeader title={t('audit.title')} />
            {/* Un errore non è "nessuna attività": prima mostrava l'empty state. L'empty
                state vive dentro lista/tabella, non sopra (lì compariva due volte). */}
            {loadError && !loading ? (
                <InlineError message={t('audit.loadError')} onRetry={() => fetchLog(page)} />
            ) : isMobile ? (
                <ItemList
                    items={entries}
                    rowKey={record => record.id}
                    loading={loading}
                    aria-label={t('audit.title')}
                    deferOffscreen
                    empty={<EmptyState description={t('audit.emptyState')} />}
                    pagination={paginationProps}
                    renderItem={(record) => (
                        <Card size="small" style={{ marginBottom: SPACING.sm }}>
                            <Flex vertical gap={6}>
                                <Flex justify="space-between" align="center" wrap="wrap" gap="small">
                                    <Tag color={ACTION_COLORS[record.action]} style={{ margin: 0 }}>
                                        {t(`audit.actions.${record.action}`)}
                                    </Tag>
                                    <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                                        {dayjs(record.timestamp).format('DD/MM/YYYY HH:mm')}
                                    </Text>
                                </Flex>
                                <Flex gap="small" wrap="wrap">
                                    <Text style={{ fontSize: FONT_SIZE.sm }}>{record.entityType}</Text>
                                    <Text copyable={{ text: record.entityId }} type="secondary" style={{ fontSize: FONT_SIZE.sm, fontFamily: 'monospace' }}>
                                        {record.entityId.substring(0, 8)}…
                                    </Text>
                                </Flex>
                                {record.newValue && (
                                    <Collapse
                                        size="small"
                                        ghost
                                        items={[{
                                            key: '1',
                                            label: <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>{t('audit.newValue')}</Text>,
                                            children: (
                                                <JsonPreview
                                                    raw={record.newValue}
                                                    maxHeight={200}
                                                    fontSize={FONT_SIZE.xs}
                                                    background={token.colorFillTertiary}
                                                />
                                            ),
                                        }]}
                                    />
                                )}
                            </Flex>
                        </Card>
                    )}
                />
            ) : (
                <Table
                    columns={columns}
                    dataSource={entries}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    tableLayout="fixed"
                    locale={{ emptyText: <EmptyState description={t('audit.emptyState')} /> }}
                    expandable={{
                        expandedRowRender: (record) => (
                            <JsonPreview
                                raw={record.newValue}
                                maxHeight={300}
                                fontSize={FONT_SIZE.sm}
                                background={token.colorFillTertiary}
                            />
                        ),
                        rowExpandable: (record) => !!record.newValue,
                    }}
                    pagination={{ ...paginationProps, placement: ['bottomCenter'] }}
                />
            )}
        </>
    );
};
