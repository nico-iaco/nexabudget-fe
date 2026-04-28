import { useEffect, useState } from 'react';
import { Card, Table, Switch, Button, Popconfirm, message, Space, Typography, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getApiKeys, createApiKey, updateApiKey, deleteApiKey } from '../../services/api';
import type { ApiKeyResponse, CreateApiKeyRequest, UpdateApiKeyRequest } from '../../types/api';
import { ApiKeyFormModal } from './ApiKeyFormModal';
import { ApiKeySecretModal } from './ApiKeySecretModal';
import dayjs from 'dayjs';

const { Text } = Typography;

export const ApiKeysCard = () => {
    const { t } = useTranslation();
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
        } catch (error) {
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
                const resData = response.data as any;
                // Gestione robusta della chiave in base a possibili variazioni del nome proprietà nel backend
                const extractedKey = resData.plaintextKey || resData.plainTextKey || resData.token || resData.key || 'ERRORE-CHIAVE-NON-RESTITUITA';
                setNewPlaintextKey(extractedKey);
                setSecretModalVisible(true);
            }
            setFormModalVisible(false);
            setEditingKey(undefined);
            fetchKeys();
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
            message.error(t('settings.apiKeys.deleteError'));
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (record: ApiKeyResponse) => {
        setEditingKey(record);
        setFormModalVisible(true);
    };

    const columns = [
        {
            title: t('settings.apiKeys.name'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: t('settings.apiKeys.scopes'),
            dataIndex: 'scopes',
            key: 'scopes',
            render: (scopes: string) => {
                if (!scopes) return <Text type="secondary">{t('common.none')}</Text>;
                return (
                    <Space size={[0, 4]} wrap>
                        {scopes.split(',').filter(Boolean).map(scope => (
                            <Tag key={scope} color="blue">{t(`settings.apiKeys.scopesList.${scope}`, scope)}</Tag>
                        ))}
                    </Space>
                );
            }
        },
        {
            title: t('settings.apiKeys.expiresAt'),
            dataIndex: 'expiresAt',
            key: 'expiresAt',
            render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY HH:mm') : <Text type="secondary">{t('settings.apiKeys.noExpiration')}</Text>,
        },
        {
            title: t('settings.apiKeys.lastUsedAt'),
            dataIndex: 'lastUsedAt',
            key: 'lastUsedAt',
            render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY HH:mm') : <Text type="secondary">{t('settings.apiKeys.never')}</Text>,
        },
        {
            title: t('settings.apiKeys.active'),
            key: 'active',
            render: (_: any, record: ApiKeyResponse) => (
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
            render: (_: any, record: ApiKeyResponse) => (
                <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
                    <Popconfirm
                        title={t('settings.apiKeys.deleteConfirm')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Card 
            title={t('settings.apiKeys.cardTitle')} 
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingKey(undefined); setFormModalVisible(true); }}>{t('settings.apiKeys.generateNew')}</Button>}
            style={{ marginBottom: 16 }}
        >
            <Table
                dataSource={keys}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={false}
                locale={{ emptyText: t('settings.apiKeys.emptyList') }}
                scroll={{ x: 800 }}
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
