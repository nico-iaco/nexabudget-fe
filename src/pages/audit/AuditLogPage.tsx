import { useEffect, useState } from 'react';
import { Card, Collapse, Flex, List, Table, Tag, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { AuditAction, AuditLogEntry } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const { Title, Text } = Typography;

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
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const pageSize = 20;

    const fetchLog = async (p: number) => {
        setLoading(true);
        try {
            const resp = await api.getAuditLog(p - 1, pageSize);
            setEntries(resp.data.content);
            setTotal(resp.data.totalElements);
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
                <Text copyable={{ text: v }} style={{ fontSize: 12, fontFamily: 'monospace' }}>
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
            <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
                <Title level={2} style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem' }}>{t('audit.title')}</Title>
            </Flex>
            {isMobile ? (
                <List
                    dataSource={entries}
                    loading={loading}
                    pagination={{ ...paginationProps, position: 'bottom', align: 'center' }}
                    renderItem={(record) => (
                        <Card size="small" style={{ marginBottom: 12 }}>
                            <Flex vertical gap={6}>
                                <Flex justify="space-between" align="center" wrap="wrap" gap="small">
                                    <Tag color={ACTION_COLORS[record.action]} style={{ margin: 0 }}>
                                        {t(`audit.actions.${record.action}`)}
                                    </Tag>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {dayjs(record.timestamp).format('DD/MM/YYYY HH:mm')}
                                    </Text>
                                </Flex>
                                <Flex gap="small" wrap="wrap">
                                    <Text style={{ fontSize: 12 }}>{record.entityType}</Text>
                                    <Text copyable={{ text: record.entityId }} style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(0,0,0,0.45)' }}>
                                        {record.entityId.substring(0, 8)}…
                                    </Text>
                                </Flex>
                                {record.newValue && (
                                    <Collapse
                                        size="small"
                                        ghost
                                        items={[{
                                            key: '1',
                                            label: <Text type="secondary" style={{ fontSize: 12 }}>{t('audit.newValue')}</Text>,
                                            children: (
                                                <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', margin: 0, background: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 4 }}>
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
                    expandable={{
                        expandedRowRender: (record) => (
                            <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto', margin: 0 }}>
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
