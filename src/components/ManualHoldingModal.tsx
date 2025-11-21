import React, {useState} from 'react';
import {Button, Form, Input, InputNumber, message, Modal} from 'antd';
import {addManualHolding} from '../services/api';
import type {ManualHoldingsRequest} from '../types/api';

interface ManualHoldingModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ManualHoldingModal: React.FC<ManualHoldingModalProps> = ({ open, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const handleSubmit = async (values: ManualHoldingsRequest) => {
        setLoading(true);
        try {
            await addManualHolding(values);
            message.success('Holding added successfully');
            form.resetFields();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to add holding:', error);
            message.error('Failed to add holding. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Add Manual Holding"
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
                    <Input placeholder="BTC" style={{ textTransform: 'uppercase' }} />
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
                            Add Holding
                        </Button>
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
};
