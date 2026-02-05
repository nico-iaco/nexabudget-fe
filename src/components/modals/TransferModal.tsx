import {Button, DatePicker, Form, Input, InputNumber, Modal, Select} from 'antd';
import dayjs, {type Dayjs} from 'dayjs';
import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import type {Account} from '../../types/api';

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
    const { t } = useTranslation();
    const [form] = Form.useForm<TransferFormValues>();

    useEffect(() => {
        if (open) {
            form.resetFields();
            form.setFieldsValue({ transferDate: dayjs() });
        }
    }, [open, form]);

    return (
        <Modal
            title={t('transfers.newTransfer')}
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
                    label={t('transfers.sourceAccount')}
                    rules={[{ required: true, message: t('transfers.sourceAccountRequired') }]}
                >
                    <Select placeholder={t('transfers.sourceAccountPlaceholder')}>
                        {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                    </Select>
                </Form.Item>
                <Form.Item
                    name="destinationAccountId"
                    label={t('transfers.destinationAccount')}
                    rules={[
                        { required: true, message: t('transfers.destinationAccountRequired') },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue('sourceAccountId') !== value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(new Error(t('transfers.destinationAccountDifferent')));
                            },
                        }),
                    ]}
                >
                    <Select placeholder={t('transfers.destinationAccountPlaceholder')}>
                        {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                    </Select>
                </Form.Item>
                <Form.Item
                    name="amount"
                    label={t('transfers.amount')}
                    rules={[{ required: true, message: t('transfers.amountRequired') }]}
                >
                    <InputNumber style={{ width: '100%' }} min={0.01} addonAfter="€" />
                </Form.Item>
                <Form.Item
                    name="transferDate"
                    label={t('transfers.transferDate')}
                    rules={[{ required: true, message: t('transfers.transferDateRequired') }]}
                >
                    <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                    name="description"
                    label={t('transfers.description')}
                    rules={[{ required: true, message: t('transfers.descriptionRequired') }]}
                >
                    <Input placeholder={t('transfers.descriptionPlaceholder')} />
                </Form.Item>
                <Form.Item name="notes" label={t('transfers.notes')}>
                    <Input.TextArea placeholder={t('transfers.notesPlaceholder')} />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block>{t('transfers.executeTransfer')}</Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};
