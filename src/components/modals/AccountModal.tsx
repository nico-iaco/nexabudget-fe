
import { Button, Form, Input, InputNumber, Modal, Select } from 'antd';
import type { Account, AccountRequest } from '../../types/api';
import { useEffect } from 'react';

const { Option } = Select;

interface AccountModalProps {
    open: boolean;
    onCancel: () => void;
    onFinish: (values: AccountRequest) => void;
    editingAccount: Account | null;
}

export const AccountModal = ({ open, onCancel, onFinish, editingAccount }: AccountModalProps) => {
    const [form] = Form.useForm<AccountRequest>();

    useEffect(() => {
        if (open) {
            if (editingAccount) {
                form.setFieldsValue({
                    name: editingAccount.name,
                    type: editingAccount.type,
                    currency: editingAccount.currency,
                    starterBalance: 0 // Default or fetch if needed, but it's disabled in edit mode
                });
            } else {
                form.resetFields();
                form.setFieldsValue({ currency: 'EUR' });
            }
        }
    }, [open, editingAccount, form]);

    return (
        <Modal
            title={editingAccount ? "Modifica Conto" : "Nuovo Conto"}
            open={open}
            onCancel={onCancel}
            footer={null}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                style={{ marginTop: 24 }}
                initialValues={{ currency: 'EUR' }}
            >
                <Form.Item
                    name="name"
                    label="Nome Conto"
                    rules={[{ required: true, message: 'Inserisci il nome del conto' }]}
                >
                    <Input placeholder="Es. Conto Principale" />
                </Form.Item>
                <Form.Item
                    name="type"
                    label="Tipo di Conto"
                    rules={[{ required: true, message: 'Seleziona il tipo di conto' }]}
                >
                    <Select placeholder="Seleziona un tipo">
                        <Option value="CONTO_CORRENTE">Conto Corrente</Option>
                        <Option value="RISPARMIO">Risparmio</Option>
                        <Option value="INVESTIMENTO">Investimento</Option>
                        <Option value="CONTANTI">Contanti</Option>
                    </Select>
                </Form.Item>
                <Form.Item
                    name="starterBalance"
                    label="Saldo Iniziale"
                    initialValue={0}
                    rules={[{ required: true, message: 'Inserisci il saldo iniziale' }]}
                >
                    <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        addonAfter="€"
                        disabled={!!editingAccount}
                    />
                </Form.Item>
                <Form.Item
                    name="currency"
                    label="Valuta"
                    rules={[{ required: true, message: 'Inserisci la valuta' }]}
                >
                    <Input placeholder="Es. EUR" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block>Salva Conto</Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};
