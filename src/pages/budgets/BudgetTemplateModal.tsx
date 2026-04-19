import { Button, Form, InputNumber, Modal, Select, Switch } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { BudgetTemplate, BudgetTemplateRequest, Category } from '../../types/api';

interface Props {
    open: boolean;
    onCancel: () => void;
    onFinish: (values: BudgetTemplateRequest) => void;
    editing: BudgetTemplate | null;
    categories: Category[];
}

export const BudgetTemplateModal = ({ open, onCancel, onFinish, editing, categories }: Props) => {
    const { t } = useTranslation();
    const [form] = Form.useForm<BudgetTemplateRequest>();

    useEffect(() => {
        if (open) {
            if (editing) {
                form.setFieldsValue({
                    categoryId: editing.categoryId,
                    budgetLimit: editing.budgetLimit,
                    recurrenceType: editing.recurrenceType,
                    active: editing.active,
                });
            } else {
                form.resetFields();
                form.setFieldsValue({ active: true, recurrenceType: 'MONTHLY' });
            }
        }
    }, [open, editing, form]);

    return (
        <Modal
            title={editing ? t('budgets.editBudget') : t('budgets.newBudget')}
            open={open}
            onCancel={onCancel}
            footer={null}
        >
            <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 24 }}>
                <Form.Item name="categoryId" label={t('budgets.category')} rules={[{ required: true, message: t('budgets.categoryRequired') }]}>
                    <Select placeholder={t('budgets.categoryRequired')}>
                        {categories.map(c => (
                            <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="budgetLimit" label={t('budgets.limit')} rules={[{ required: true, message: t('budgets.limitRequired') }]}>
                    <InputNumber style={{ width: '100%' }} min={0.01} precision={2} addonAfter="€" />
                </Form.Item>
                <Form.Item name="recurrenceType" label={t('budgets.recurrence')} rules={[{ required: true, message: t('budgets.recurrenceRequired') }]}>
                    <Select>
                        <Select.Option value="MONTHLY">{t('budgets.recurrenceMonthly')}</Select.Option>
                        <Select.Option value="QUARTERLY">{t('budgets.recurrenceQuarterly')}</Select.Option>
                        <Select.Option value="YEARLY">{t('budgets.recurrenceYearly')}</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item name="active" label={t('budgets.active')} valuePropName="checked">
                    <Switch />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block>{t('common.save')}</Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};
