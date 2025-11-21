import React, {useState} from 'react';
import {Button, Form, Input, message, Modal} from 'antd';
import {saveBinanceKeys} from '../services/api';
import type {BinanceKeysRequest} from '../types/api';

interface BinanceKeysModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const BinanceKeysModal: React.FC<BinanceKeysModalProps> = ({ open, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const handleSubmit = async (values: BinanceKeysRequest) => {
        setLoading(true);
        try {
            await saveBinanceKeys(values);
            message.success('Binance keys saved successfully');
            form.resetFields();
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save Binance keys:', error);
            message.error('Failed to save Binance keys. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Connect Binance Account"
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
                    label="API Key"
                    rules={[{ required: true, message: 'Please enter your Binance API Key' }]}
                >
                    <Input.Password placeholder="Enter your API Key" />
                </Form.Item>

                <Form.Item
                    name="apiSecret"
                    label="API Secret"
                    rules={[{ required: true, message: 'Please enter your Binance API Secret' }]}
                >
                    <Input.Password placeholder="Enter your API Secret" />
                </Form.Item>

                <Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            Save Keys
                        </Button>
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
};
