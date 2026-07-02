import {Button, Form, Input, InputNumber, Modal} from 'antd';
import type {Account, AccountRequest} from '../../types/api';
import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {getCurrencySymbol} from '../../utils/currency';
import { SafeSelect } from '../SafeSelect';

const { Option } = SafeSelect;

interface AccountModalProps {
    open: boolean;
    onCancel: () => void;
    onFinish: (values: AccountRequest) => void;
    editingAccount: Account | null;
    /** true durante il salvataggio — disabilita il bottone submit per evitare doppio invio */
    loading?: boolean;
}

export const AccountModal = ({ open, onCancel, onFinish, editingAccount, loading = false }: AccountModalProps) => {
    const { t } = useTranslation();
    const [form] = Form.useForm<AccountRequest>();
    const currencyValue = Form.useWatch('currency', form);

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
            destroyOnClose
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
                    <SafeSelect placeholder={t('accounts.accountTypePlaceholder')}>
                        <Option value="CONTO_CORRENTE">{t('accounts.accountTypeChecking')}</Option>
                        <Option value="RISPARMIO">{t('accounts.accountTypeSavings')}</Option>
                        <Option value="INVESTIMENTO">{t('accounts.accountTypeInvestment')}</Option>
                        <Option value="CONTANTI">{t('accounts.accountTypeCash')}</Option>
                    </SafeSelect>
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
                        addonAfter={getCurrencySymbol(currencyValue ?? 'EUR')}
                        disabled={!!editingAccount}
                        parser={(value) => value?.replace(',', '.') as any}
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
                    <Button type="primary" htmlType="submit" block loading={loading} disabled={loading}>
                        {t('accounts.saveAccount')}
                    </Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};
