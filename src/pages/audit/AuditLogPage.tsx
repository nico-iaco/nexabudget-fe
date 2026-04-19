import { useEffect, useState } from 'react';
import { Flex, Table, Tag, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { AuditAction, AuditLogEntry } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';

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

    return (
        <>
            <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
                <Title level={2} style={{ margin: 0 }}>{t('audit.title')}</Title>
            </Flex>
            <Table
                columns={columns}
                dataSource={entries}
                rowKey="id"
                loading={loading}
                size="small"
                expandable={{
                    expandedRowRender: (record) => {
                        let formatted = record.newValue;
                        try {
                            formatted = JSON.stringify(JSON.parse(record.newValue), null, 2);
                        } catch {
                            // not valid JSON, show as-is
                        }
                        return (
                            <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto', margin: 0 }}>
                                {formatted}
                            </pre>
                        );
                    },
                    rowExpandable: (record) => !!record.newValue,
                }}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    position: ['bottomCenter'],
                    showSizeChanger: false,
                    showTotal: (tot) => `${tot} ${t('audit.title').toLowerCase()}`,
                    onChange: (p) => {
                        setPage(p);
                        fetchLog(p);
                    },
                }}
            />
        </>
    );
};
