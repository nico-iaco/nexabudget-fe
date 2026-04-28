import { Form, Input, Modal, Select, DatePicker } from 'antd';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import type { ApiKeyResponse, CreateApiKeyRequest, UpdateApiKeyRequest } from '../../types/api';
import dayjs from 'dayjs';

interface ApiKeyFormModalProps {
    open: boolean;
    onCancel: () => void;
    onOk: (data: CreateApiKeyRequest | UpdateApiKeyRequest) => void;
    editingKey?: ApiKeyResponse;
    loading?: boolean;
}

export const ApiKeyFormModal = ({ open, onCancel, onOk, editingKey, loading }: ApiKeyFormModalProps) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [formValues, setFormValues] = useState<any>({});

    useEffect(() => {
        if (open) {
            if (editingKey) {
                const scopesArr = editingKey.scopes ? editingKey.scopes.split(',').filter(Boolean) : [];
                form.setFieldsValue({
                    name: editingKey.name,
                    scopes: scopesArr,
                    expiresAt: editingKey.expiresAt ? dayjs(editingKey.expiresAt) : undefined,
                });
                setFormValues(form.getFieldsValue());
            } else {
                form.resetFields();
                form.setFieldsValue({
                    expiresAt: dayjs().add(1, 'year'),
                });
            }
        }
    }, [open, editingKey, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            const data: any = {
                name: values.name,
                scopes: values.scopes ? values.scopes.join(',') : '',
                expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined,
            };
            if (editingKey) {
                // Keep the existing active state on edit
                (data as UpdateApiKeyRequest).active = editingKey.active;
            }
            onOk(data);
        } catch (error) {
            // Form validation failed
        }
    };

    const scopeOptions = [
        { label: t('settings.apiKeys.scopesList.READ_ALL'), value: 'READ_ALL' },
        { label: t('settings.apiKeys.scopesList.WRITE_TRANSACTIONS'), value: 'WRITE_TRANSACTIONS' },
        { label: t('settings.apiKeys.scopesList.WRITE_BUDGETS'), value: 'WRITE_BUDGETS' },
        { label: t('settings.apiKeys.scopesList.WRITE_CATEGORIES'), value: 'WRITE_CATEGORIES' },
        { label: t('settings.apiKeys.scopesList.SYNC_BANK'), value: 'SYNC_BANK' },
    ];

    const isEdit = !!editingKey;

    return (
        <Modal
            title={isEdit ? t('settings.apiKeys.editTitle') : t('settings.apiKeys.createTitle')}
            open={open}
            onOk={handleOk}
            onCancel={onCancel}
            confirmLoading={loading}
            okText={t('common.save')}
            cancelText={t('common.cancel')}
        >
            <Form form={form} layout="vertical" onValuesChange={(_, all) => setFormValues(all)}>
                <Form.Item
                    name="name"
                    label={t('settings.apiKeys.name')}
                    rules={[{ required: true, message: t('settings.apiKeys.nameRequired') }]}
                >
                    <Input placeholder={t('settings.apiKeys.namePlaceholder')} />
                </Form.Item>

                <Form.Item
                    name="scopes"
                    label={t('settings.apiKeys.scopes')}
                >
                    <Select
                        mode="multiple"
                        allowClear
                        placeholder={t('settings.apiKeys.scopesPlaceholder')}
                        options={scopeOptions}
                    />
                </Form.Item>

                <Form.Item
                    name="expiresAt"
                    label={t('settings.apiKeys.expiresAt')}
                    tooltip={t('settings.apiKeys.expiresAtTooltip')}
                >
                    <DatePicker 
                        style={{ width: '100%' }} 
                        format="YYYY-MM-DD HH:mm"
                        showTime 
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};
