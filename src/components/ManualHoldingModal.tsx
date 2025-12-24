import React, { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, message, Modal } from 'antd';
import { addManualHolding, updateManualHolding } from '../services/api';
import type { CryptoAsset, ManualHoldingsRequest, UpdateCryptoAsset } from '../types/api';

interface ManualHoldingModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingAsset?: CryptoAsset | null;
}

export const ManualHoldingModal: React.FC<ManualHoldingModalProps> = ({ open, onClose, onSuccess, editingAsset }) => {
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
                message.success('Holding updated successfully');
            } else {
                await addManualHolding(values);
                message.success('Holding added successfully');
            }
            form.resetFields();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save holding:', error);
            message.error('Failed to save holding. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={editingAsset ? "Edit Manual Holding" : "Add Manual Holding"}
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
                    label="Crypto Symbol"
                    rules={[{ required: true, message: 'Please enter the crypto symbol (e.g., BTC)' }]}
                >
                    <Input placeholder="BTC" style={{ textTransform: 'uppercase' }} disabled={!!editingAsset} />
                </Form.Item>

                <Form.Item
                    name="amount"
                    label="Amount"
                    rules={[{ required: true, message: 'Please enter the amount' }]}
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
                        <Button onClick={onClose}>Cancel</Button>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            {editingAsset ? "Update Holding" : "Add Holding"}
                        </Button>
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
};
