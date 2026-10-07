import { Button, Form, Input, Modal } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category, CategoryRequest } from '../../types/api';
import { SPACING } from '../../theme/tokens';
import { applyApiFieldErrors } from '../../utils/apiError';

interface CategoryFormModalProps {
    open: boolean;
    onCancel: () => void;
    /** Se rifiuta (400/409 rilanciati dal chiamante), l'errore del backend va sul campo nome. */
    onFinish: (values: CategoryRequest) => Promise<void>;
    editingCategory: Category | null;
    submitting?: boolean;
}

export const CategoryFormModal = ({ open, onCancel, onFinish, editingCategory, submitting = false }: CategoryFormModalProps) => {
    const { t } = useTranslation();
    const [form] = Form.useForm<CategoryRequest>();

    useEffect(() => {
        if (open) {
            if (editingCategory) {
                form.setFieldsValue({ name: editingCategory.name });
            } else {
                form.resetFields();
            }
        }
    }, [open, editingCategory, form]);

    const handleFinish = async (values: CategoryRequest) => {
        try {
            await onFinish({ name: values.name.trim() });
        } catch (error) {
            // 409 "nome già esistente": il messaggio del backend sul campo, non in un toast.
            if (!applyApiFieldErrors(form, error, 'name')) {
                form.setFields([{ name: 'name', errors: [t('settings.categories.duplicateError')] }]);
            }
        }
    };

    return (
        <Modal
            title={editingCategory ? t('settings.categories.editCategory') : t('settings.categories.newCategory')}
            open={open}
            onCancel={onCancel}
            footer={null}
            destroyOnHidden
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                style={{ marginTop: SPACING.lg }}
            >
                <Form.Item
                    name="name"
                    label={t('settings.categories.name')}
                    rules={[
                        { required: true, message: t('settings.categories.nameRequired') },
                        { max: 100, message: t('settings.categories.nameTooLong') },
                        {
                            validator: (_, value) => {
                                if (value && !value.trim()) {
                                    return Promise.reject(new Error(t('settings.categories.nameRequired')));
                                }
                                return Promise.resolve();
                            }
                        }
                    ]}
                >
                    <Input placeholder={t('settings.categories.namePlaceholder')} autoFocus maxLength={100} />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={submitting}>
                        {t('settings.categories.save')}
                    </Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};
