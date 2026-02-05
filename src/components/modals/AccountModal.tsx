import {Button, Form, Input, InputNumber, Modal, Select} from 'antd';
import type {Account, AccountRequest} from '../../types/api';
import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';

const { Option } = Select;

interface AccountModalProps {
    open: boolean;
    onCancel: () => void;
    onFinish: (values: AccountRequest) => void;
    editingAccount: Account | null;
}

export const AccountModal = ({ open, onCancel, onFinish, editingAccount }: AccountModalProps) => {
    const { t } = useTranslation();
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
            title={editingAccount ? t('accounts.editAccount') : t('accounts.newAccount')}
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
                    label={t('accounts.accountName')}
                    rules={[{ required: true, message: t('accounts.accountNamePlaceholder') }]}
                >
                    <Input placeholder={t('accounts.accountNamePlaceholder')} />
                </Form.Item>
                <Form.Item
                    name="type"
                    label={t('accounts.accountType')}
                    rules={[{ required: true, message: t('accounts.accountTypePlaceholder') }]}
                >
                    <Select placeholder={t('accounts.accountTypePlaceholder')}>
                        <Option value="CONTO_CORRENTE">{t('accounts.accountTypeChecking')}</Option>
                        <Option value="RISPARMIO">{t('accounts.accountTypeSavings')}</Option>
                        <Option value="INVESTIMENTO">{t('accounts.accountTypeInvestment')}</Option>
                        <Option value="CONTANTI">{t('accounts.accountTypeCash')}</Option>
                    </Select>
                </Form.Item>
                <Form.Item
                    name="starterBalance"
                    label={t('accounts.startingBalance')}
                    initialValue={0}
                    rules={[{ required: true, message: t('accounts.startingBalanceRequired') }]}
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
                    label={t('accounts.currency')}
                    rules={[{ required: true, message: t('accounts.currencyRequired') }]}
                >
                    <Input placeholder="EUR" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block>{t('accounts.saveAccount')}</Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};
