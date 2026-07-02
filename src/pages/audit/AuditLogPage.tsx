import { useEffect, useState } from 'react';
import { App, Card, Collapse, Flex, List, Table, Tag, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { AuditAction, AuditLogEntry } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
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

export const AuditLogPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const { token } = theme.useToken();
    usePageTitle(t('audit.title'));
    const { isSmallMobile: isMobile } = useBreakpoints();

    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const pageSize = 20;

    const fetchLog = async (p: number) => {
        setLoading(true);
        try {
            const resp = await api.getAuditLog(p - 1, pageSize);
            setEntries(Array.isArray(resp.data.content) ? resp.data.content : []);
            setTotal(resp.data.page?.totalElements ?? 0);
        } catch {
            message.error(t('audit.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLog(1); }, []);

    const columns: ColumnsType<AuditLogEntry> = [
        {
            title: t('audit.timestamp'),
            dataIndex: 'timestamp',
            key: 'timestamp',
            render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
            width: 160,
        },
        {
            title: t('audit.action'),
            dataIndex: 'action',
            key: 'action',
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
        },
        {
            title: t('audit.entityId'),
            dataIndex: 'entityId',
            key: 'entityId',
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

    const formatValue = (raw: string) => {
        try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
    };

    return (
        <>
            <PageHeader title={t('audit.title')} />
            {!loading && entries.length === 0 && (
                <EmptyState description={t('audit.emptyState')} />
            )}
            {isMobile ? (
                <List
                    dataSource={entries}
                    loading={loading}
                    pagination={entries.length > 0 ? { ...paginationProps, position: 'bottom', align: 'center' } : false}
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
                                                <pre style={{ fontSize: FONT_SIZE.xs, maxHeight: 200, overflow: 'auto', margin: 0, background: token.colorFillTertiary, padding: SPACING.xs, borderRadius: RADIUS.sm }}>
                                                    {formatValue(record.newValue)}
                                                </pre>
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
                    scroll={{ x: 'max-content' }}
                    expandable={{
                        expandedRowRender: (record) => (
                            <pre style={{ fontSize: FONT_SIZE.sm, maxHeight: 300, overflow: 'auto', margin: 0, background: token.colorFillTertiary, padding: SPACING.xs, borderRadius: RADIUS.sm }}>
                                {formatValue(record.newValue)}
                            </pre>
                        ),
                        rowExpandable: (record) => !!record.newValue,
                    }}
                    pagination={{ ...paginationProps, position: ['bottomCenter'] }}
                />
            )}
        </>
    );
};
