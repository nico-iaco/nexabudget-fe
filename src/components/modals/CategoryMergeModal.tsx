import { Alert, Button, Form, Modal, Space } from 'antd';
import { SafeSelect } from '../common/SafeSelect';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '../../types/api';
import { SPACING } from '../../theme/tokens';

interface CategoryMergeModalProps {
    open: boolean;
    source: Category | null;
    categories: Category[];
    onCancel: () => void;
    onConfirm: (targetId: string) => void;
    submitting?: boolean;
}

export const CategoryMergeModal = ({ open, source, categories, onCancel, onConfirm, submitting = false }: CategoryMergeModalProps) => {
    const { t } = useTranslation();
    const [targetId, setTargetId] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (open) setTargetId(undefined);
    }, [open, source?.id]);

    const targets = useMemo(
        () => categories
            .filter(c => !c.isDefault && c.id !== source?.id)
            .sort((a, b) => a.name.localeCompare(b.name)),
        [categories, source?.id]
    );

    const handleConfirm = () => {
        if (targetId) onConfirm(targetId);
    };

    return (
        <Modal
            title={t('settings.categories.mergeTitle')}
            open={open}
            onCancel={onCancel}
            footer={null}
            destroyOnClose
        >
            <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: SPACING.md }}>
                <Alert
                    type="warning"
                    showIcon
                    message={t('settings.categories.mergeWarning', { source: source?.name ?? '' })}
                />
                <Form layout="vertical" onFinish={handleConfirm}>
                    <Form.Item
                        label={t('settings.categories.mergeTargetLabel')}
                        required
                    >
                        <SafeSelect
                            value={targetId}
                            placeholder={t('settings.categories.mergeTargetPlaceholder')}
                            onChange={(v) => setTargetId(v as string | undefined)}
                            disabled={targets.length === 0}
                            notFoundContent={t('settings.categories.mergeNoTargets')}
                            options={targets.map(c => ({ value: c.id, label: c.name }))}
                            showSearch
                            optionFilterProp="label"
                        />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={onCancel}>{t('settings.categories.cancel')}</Button>
                            <Button
                                type="primary"
                                danger
                                htmlType="submit"
                                loading={submitting}
                                disabled={!targetId}
                            >
                                {t('settings.categories.mergeConfirm')}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Space>
        </Modal>
    );
};
