import React, {useState} from 'react';
import {Button, Form, Input, message, Modal} from 'antd';
import {useTranslation} from 'react-i18next';
import {saveBinanceKeys} from '../services/api';
import type {BinanceKeysRequest} from '../types/api';

interface BinanceKeysModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const BinanceKeysModal: React.FC<BinanceKeysModalProps> = ({ open, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const handleSubmit = async (values: BinanceKeysRequest) => {
        setLoading(true);
        try {
            await saveBinanceKeys(values);
            message.success(t('binanceKeys.saveSuccess'));
            form.resetFields();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save Binance keys:', error);
            message.error(t('binanceKeys.saveError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={t('binanceKeys.title')}
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
                    name="apiKey"
                    label={t('binanceKeys.apiKey')}
                    rules={[{ required: true, message: t('binanceKeys.apiKeyRequired') }]}
                >
                    <Input.Password placeholder={t('binanceKeys.apiKey')} />
                </Form.Item>

                <Form.Item
                    name="apiSecret"
                    label={t('binanceKeys.apiSecret')}
                    rules={[{ required: true, message: t('binanceKeys.apiSecretRequired') }]}
                >
                    <Input.Password placeholder={t('binanceKeys.apiSecret')} />
                </Form.Item>

                <Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <Button onClick={onClose}>{t('common.cancel')}</Button>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            {t('binanceKeys.saveKeys')}
                        </Button>
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
};
