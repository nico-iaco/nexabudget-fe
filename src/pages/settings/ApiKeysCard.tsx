import { useEffect, useState } from 'react';
import { App, Card, Table, Switch, Button, Popconfirm, Space, Typography, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getApiKeys, createApiKey, updateApiKey, deleteApiKey } from '../../services/api';
import type { ApiKeyResponse, CreateApiKeyRequest, UpdateApiKeyRequest } from '../../types/api';
import { ApiKeyFormModal } from '../../components/modals/ApiKeyFormModal';
import { ApiKeySecretModal } from '../../components/modals/ApiKeySecretModal';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { FONT_SIZE, SPACING } from '../../theme/tokens';
import { useBreakpoints } from '../../hooks/useBreakpoints';

const { Text } = Typography;

export const ApiKeysCard = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const { isSmallMobile } = useBreakpoints();
    const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [formModalVisible, setFormModalVisible] = useState(false);
    const [secretModalVisible, setSecretModalVisible] = useState(false);
    const [editingKey, setEditingKey] = useState<ApiKeyResponse | undefined>(undefined);
    const [newPlaintextKey, setNewPlaintextKey] = useState('');

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const { data } = await getApiKeys();
            setKeys(data);
        } catch {
            message.error(t('settings.apiKeys.fetchError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleCreateOrUpdate = async (data: CreateApiKeyRequest | UpdateApiKeyRequest) => {
        try {
            if (editingKey) {
                const req = data as UpdateApiKeyRequest;
                await updateApiKey(editingKey.id, req);
                message.success(t('settings.apiKeys.updateSuccess'));
            } else {
                const response = await createApiKey(data as CreateApiKeyRequest);
                const resData = response.data as unknown as Record<string, string | undefined>;
                // Gestione robusta della chiave in base a possibili variazioni del nome proprietà nel backend
                const extractedKey = resData.plaintextKey || resData.plainTextKey || resData.token || resData.key || 'ERRORE-CHIAVE-NON-RESTITUITA';
                setNewPlaintextKey(extractedKey);
                setSecretModalVisible(true);
            }
            setFormModalVisible(false);
            setEditingKey(undefined);
            fetchKeys();
        } catch {
            message.error(t('settings.apiKeys.saveError'));
        }
    };

    const handleToggleActive = async (checked: boolean, id: string) => {
        try {
            setLoading(true);
            const keyToUpdate = keys.find(k => k.id === id);
            if (!keyToUpdate) return;
            const req: UpdateApiKeyRequest = {
                name: keyToUpdate.name,
                scopes: keyToUpdate.scopes,
                expiresAt: keyToUpdate.expiresAt,
                active: checked
            };
            await updateApiKey(id, req);
            message.success(checked ? t('settings.apiKeys.activated') : t('settings.apiKeys.deactivated'));
            fetchKeys();
        } catch {
            message.error(t('settings.apiKeys.toggleError'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setLoading(true);
            await deleteApiKey(id);
            message.success(t('settings.apiKeys.deleteSuccess'));
            fetchKeys();
        } catch {
            message.error(t('settings.apiKeys.deleteError'));
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (record: ApiKeyResponse) => {
        setEditingKey(record);
        setFormModalVisible(true);
    };

    const renderScopes = (scopes: string) => {
        if (!scopes) return <Text type="secondary">{t('common.none')}</Text>;
        return (
            <Space size={[0, 4]} wrap>
                {scopes.split(',').filter(Boolean).map(scope => (
                    <Tag key={scope} color="blue">{t(`settings.apiKeys.scopesList.${scope}`, scope)}</Tag>
                ))}
            </Space>
        );
    };

    // La card vive in un contenitore da max 720px: prima la tabella aveva scroll x fisso a
    // 800 e scorreva sempre. Ora scadenza e ultimo utilizzo condividono una colonna, e su
    // mobile le date spariscono e gli scope scendono sotto il nome.
    const columns: ColumnsType<ApiKeyResponse> = [
        {
            title: t('settings.apiKeys.name'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: ApiKeyResponse) => isSmallMobile ? (
                <Space orientation="vertical" size={4}>
                    <Text strong>{text}</Text>
                    {renderScopes(record.scopes)}
                </Space>
            ) : <Text strong>{text}</Text>,
        },
        {
            title: t('settings.apiKeys.scopes'),
            dataIndex: 'scopes',
            key: 'scopes',
            hidden: isSmallMobile,
            render: renderScopes,
        },
        {
            title: t('settings.apiKeys.expiresAt'),
            dataIndex: 'expiresAt',
            key: 'expiresAt',
            width: 150,
            hidden: isSmallMobile,
            render: (date: string, record: ApiKeyResponse) => (
                <Space orientation="vertical" size={0}>
                    {date ? dayjs(date).format('DD/MM/YYYY HH:mm') : <Text type="secondary">{t('settings.apiKeys.noExpiration')}</Text>}
                    <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>
                        {t('settings.apiKeys.lastUsedAt')}: {record.lastUsedAt ? dayjs(record.lastUsedAt).format('DD/MM/YYYY HH:mm') : t('settings.apiKeys.never')}
                    </Text>
                </Space>
            ),
        },
        {
            title: t('settings.apiKeys.active'),
            key: 'active',
            width: 80,
            render: (_: unknown, record: ApiKeyResponse) => (
                <Switch 
                    checked={record.active} 
                    onChange={(checked) => handleToggleActive(checked, record.id)}
                    checkedChildren={t('common.yes')}
                    unCheckedChildren={t('common.no')}
                />
            )
        },
        {
            title: t('settings.apiKeys.actions'),
            key: 'actions',
            width: 120,
            render: (_: unknown, record: ApiKeyResponse) => (
                <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} aria-label={t('common.edit')} />
                    <Popconfirm
                        title={t('settings.apiKeys.deleteConfirm')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Card 
            title={t('settings.apiKeys.cardTitle')} 
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingKey(undefined); setFormModalVisible(true); }}>{t('settings.apiKeys.generateNew')}</Button>}
            style={{ marginBottom: SPACING.md }}
        >
            <Table
                dataSource={keys}
                columns={columns}
                rowKey="id"
                loading={loading}
                tableLayout="fixed"
                pagination={false}
                locale={{ emptyText: t('settings.apiKeys.emptyList') }}
            />
            {formModalVisible && (
                <ApiKeyFormModal
                    open={formModalVisible}
                    onCancel={() => setFormModalVisible(false)}
                    onOk={handleCreateOrUpdate}
                    editingKey={editingKey}
                />
            )}
            {secretModalVisible && (
                <ApiKeySecretModal
                    open={secretModalVisible}
                    onClose={() => setSecretModalVisible(false)}
                    plaintextKey={newPlaintextKey}
                />
            )}
        </Card>
    );
};
