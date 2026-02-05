import React, {useEffect, useState} from 'react';
import {Button, Form, Input, InputNumber, message, Modal} from 'antd';
import {useTranslation} from 'react-i18next';
import {addManualHolding, updateManualHolding} from '../services/api';
import type {CryptoAsset, ManualHoldingsRequest, UpdateCryptoAsset} from '../types/api';

interface ManualHoldingModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingAsset?: CryptoAsset | null;
}

export const ManualHoldingModal: React.FC<ManualHoldingModalProps> = ({ open, onClose, onSuccess, editingAsset }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        if (open && editingAsset) {
            form.setFieldsValue({
                symbol: editingAsset.symbol,
                amount: editingAsset.amount
            });
        } else if (open) {
            form.resetFields();
        }
    }, [open, editingAsset, form]);

    const handleSubmit = async (values: ManualHoldingsRequest) => {
        setLoading(true);
        try {
            if (editingAsset) {
                const updateData: UpdateCryptoAsset = { amount: values.amount };
                await updateManualHolding(editingAsset.id, updateData);
                message.success(t('manualHolding.updatedSuccess'));
            } else {
                await addManualHolding(values);
                message.success(t('manualHolding.addedSuccess'));
            }
            form.resetFields();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save holding:', error);
            message.error(t('manualHolding.saveError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={editingAsset ? t('manualHolding.titleEdit') : t('manualHolding.titleAdd')}
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
                    name="symbol"
                    label={t('manualHolding.symbol')}
                    rules={[{ required: true, message: t('manualHolding.symbolRequired') }]}
                >
                    <Input placeholder="BTC" style={{ textTransform: 'uppercase' }} disabled={!!editingAsset} />
                </Form.Item>

                <Form.Item
                    name="amount"
                    label={t('manualHolding.amount')}
                    rules={[{ required: true, message: t('manualHolding.amountRequired') }]}
                >
                    <InputNumber
                        style={{ width: '100%' }}
                        placeholder="0.00"
                        step="0.00000001"
                        stringMode
                    />
                </Form.Item>

                <Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <Button onClick={onClose}>{t('common.cancel')}</Button>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            {editingAsset ? t('manualHolding.update') : t('manualHolding.add')}
                        </Button>
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
};
