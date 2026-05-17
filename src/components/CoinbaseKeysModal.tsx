import React, {useState} from 'react';
import {Button, Form, Input, message, Modal} from 'antd';
import {useTranslation} from 'react-i18next';
import {saveCoinbaseKeys} from '../services/api';
import type {CoinbaseKeysRequest} from '../types/api';

interface CoinbaseKeysModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CoinbaseKeysModal: React.FC<CoinbaseKeysModalProps> = ({ open, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const handleSubmit = async (values: CoinbaseKeysRequest) => {
        setLoading(true);
        try {
            await saveCoinbaseKeys(values);
            message.success(t('coinbaseKeys.saveSuccess'));
            form.resetFields();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save Coinbase keys:', error);
            message.error(t('coinbaseKeys.saveError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={t('coinbaseKeys.title')}
            open={open}
            onCancel={onClose}
            footer={null}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
            >
                <Form.Item
                    name="apiKeyName"
                    label={t('coinbaseKeys.apiKeyName')}
                    rules={[{ required: true, message: t('coinbaseKeys.apiKeyNameRequired') }]}
                >
                    <Input placeholder={t('coinbaseKeys.apiKeyNamePlaceholder')} />
                </Form.Item>

                <Form.Item
                    name="privateKey"
                    label={t('coinbaseKeys.privateKey')}
                    rules={[{ required: true, message: t('coinbaseKeys.privateKeyRequired') }]}
                >
                    <Input.TextArea
                        placeholder={t('coinbaseKeys.privateKeyPlaceholder')}
                        autoSize={{ minRows: 6, maxRows: 12 }}
                    />
                </Form.Item>

                <Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <Button onClick={onClose}>{t('common.cancel')}</Button>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            {t('coinbaseKeys.saveKeys')}
                        </Button>
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
};
