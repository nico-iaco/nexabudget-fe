import { Button, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';
import type { Account } from '../../types/api';

const { Option } = Select;

export interface TransferFormValues {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    description: string;
    transferDate?: Dayjs | null;
    notes?: string;
}

interface TransferModalProps {
    open: boolean;
    onCancel: () => void;
    onFinish: (values: TransferFormValues) => void;
    accounts: Account[];
}

export const TransferModal = ({ open, onCancel, onFinish, accounts }: TransferModalProps) => {
    const [form] = Form.useForm<TransferFormValues>();

    useEffect(() => {
        if (open) {
            form.resetFields();
            form.setFieldsValue({ transferDate: dayjs() });
        }
    }, [open, form]);

    return (
        <Modal
            title="Nuovo Trasferimento"
            open={open}
            onCancel={onCancel}
            footer={null}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                style={{ marginTop: 24 }}
                initialValues={{ transferDate: dayjs() }}
            >
                <Form.Item
                    name="sourceAccountId"
                    label="Conto di Origine"
                    rules={[{ required: true, message: 'Seleziona il conto di origine' }]}
                >
                    <Select placeholder="Da quale conto?">
                        {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                    </Select>
                </Form.Item>
                <Form.Item
                    name="destinationAccountId"
                    label="Conto di Destinazione"
                    rules={[
                        { required: true, message: 'Seleziona il conto di destinazione' },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue('sourceAccountId') !== value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(new Error('Il conto di destinazione deve essere diverso da quello di origine.'));
                            },
                        }),
                    ]}
                >
                    <Select placeholder="A quale conto?">
                        {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                    </Select>
                </Form.Item>
                <Form.Item
                    name="amount"
                    label="Importo"
                    rules={[{ required: true, message: 'Inserisci l\'importo' }]}
                >
                    <InputNumber style={{ width: '100%' }} min={0.01} addonAfter="€" />
                </Form.Item>
                <Form.Item
                    name="transferDate"
                    label="Data del Trasferimento"
                    rules={[{ required: true, message: 'Seleziona la data' }]}
                >
                    <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                    name="description"
                    label="Descrizione"
                    rules={[{ required: true, message: 'Inserisci una descrizione' }]}
                >
                    <Input placeholder="Es. Giroconto" />
                </Form.Item>
                <Form.Item name="notes" label="Note">
                    <Input.TextArea placeholder="Note aggiuntive (opzionale)" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block>Esegui Trasferimento</Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};
