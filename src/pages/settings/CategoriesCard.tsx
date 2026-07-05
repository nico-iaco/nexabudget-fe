import { useMemo, useState } from 'react';
import { App, Card, Dropdown, Flex, Tag, theme, Tooltip } from 'antd';
import { BranchesOutlined, DeleteOutlined, EditOutlined, LoadingOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import type { Category, CategoryRequest } from '../../types/api';
import { createCategory, deleteCategory, mergeCategoryInto, updateCategory } from '../../services/api';
import { CategoryFormModal } from '../../components/modals/CategoryFormModal';
import { CategoryMergeModal } from '../../components/modals/CategoryMergeModal';
import { useConfirm } from '../../hooks/useConfirm';
import type { AppOutletContext } from '../../types/outletContext';
import { FONT_SIZE, RADIUS, SPACING } from '../../theme/tokens';

export const CategoriesCard = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const confirm = useConfirm();
    const { token } = theme.useToken();
    const { categories, fetchCategories } = useOutletContext<AppOutletContext>();

    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [mergeModalOpen, setMergeModalOpen] = useState(false);
    const [mergeSource, setMergeSource] = useState<Category | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [rowBusyId, setRowBusyId] = useState<string | null>(null);

    const sortedCategories = useMemo(
        () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
        [categories]
    );

    const openCreateModal = () => {
        setEditingCategory(null);
        setFormModalOpen(true);
    };

    const openEditModal = (record: Category) => {
        setEditingCategory(record);
        setFormModalOpen(true);
    };

    const openMergeModal = (record: Category) => {
        setMergeSource(record);
        setMergeModalOpen(true);
    };

    const handleSubmit = async (values: CategoryRequest) => {
        setSubmitting(true);
        try {
            if (editingCategory) {
                await updateCategory(editingCategory.id, values);
                message.success(t('settings.categories.updatedSuccess'));
            } else {
                await createCategory(values);
                message.success(t('settings.categories.createdSuccess'));
            }
            setFormModalOpen(false);
            setEditingCategory(null);
            fetchCategories();
        } catch (error) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            if (status === 400 || status === 409) {
                message.error(t('settings.categories.duplicateError'));
            } else {
                message.error(t('settings.categories.saveError'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (record: Category) => {
        confirm({
            title: t('settings.categories.deleteConfirm'),
            danger: true,
            okText: t('common.delete'),
            cancelText: t('common.cancel'),
            onOk: async () => {
                setRowBusyId(record.id);
                try {
                    await deleteCategory(record.id);
                    message.success(t('settings.categories.deletedSuccess'));
                    fetchCategories();
                } catch {
                    message.error(t('settings.categories.deleteError'));
                } finally {
                    setRowBusyId(null);
                }
            },
        });
    };

    const handleMergeConfirm = async (targetId: string) => {
        if (!mergeSource) return;
        setSubmitting(true);
        try {
            await mergeCategoryInto(mergeSource.id, targetId);
            message.success(t('settings.categories.mergedSuccess'));
            setMergeModalOpen(false);
            setMergeSource(null);
            fetchCategories();
        } catch (error) {
            message.error(t('settings.categories.mergeError'));
        } finally {
            setSubmitting(false);
        }
    };

    const userCategoriesCount = useMemo(
        () => categories.filter(c => !c.isDefault).length,
        [categories]
    );

    const pillBaseStyle = {
        margin: 0,
        borderRadius: RADIUS.pill,
        padding: `6px 14px`,
        fontSize: FONT_SIZE.md,
        border: 'none',
        background: token.colorFillTertiary,
        color: token.colorText,
    };

    return (
        <Card title={t('settings.categories.cardTitle')} style={{ marginBottom: SPACING.md }}>
            <Flex wrap="wrap" gap={8}>
                {sortedCategories.length === 0 && (
                    <span style={{ color: token.colorTextSecondary, fontSize: FONT_SIZE.sm }}>
                        {t('settings.categories.emptyList')}
                    </span>
                )}

                {sortedCategories.map(cat => {
                    const isBusy = rowBusyId === cat.id;

                    if (cat.isDefault) {
                        return (
                            <Tooltip key={cat.id} title={t('settings.categories.defaultLocked')}>
                                <Tag style={{ ...pillBaseStyle, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'default' }}>
                                    {cat.name}
                                    <LockOutlined style={{ fontSize: FONT_SIZE.xs, color: token.colorTextTertiary }} />
                                </Tag>
                            </Tooltip>
                        );
                    }

                    const canMerge = userCategoriesCount > 1;
                    return (
                        <Dropdown
                            key={cat.id}
                            trigger={['click']}
                            menu={{
                                items: [
                                    {
                                        key: 'edit',
                                        icon: <EditOutlined />,
                                        label: t('settings.categories.editCategory'),
                                        onClick: () => openEditModal(cat),
                                    },
                                    {
                                        key: 'merge',
                                        icon: <BranchesOutlined />,
                                        label: canMerge ? t('settings.categories.mergeCategory') : t('settings.categories.mergeNoTargets'),
                                        disabled: !canMerge,
                                        onClick: () => openMergeModal(cat),
                                    },
                                    { type: 'divider' },
                                    {
                                        key: 'delete',
                                        icon: <DeleteOutlined />,
                                        label: t('common.delete'),
                                        danger: true,
                                        onClick: () => handleDelete(cat),
                                    },
                                ],
                            }}
                        >
                            <Tag style={{ ...pillBaseStyle, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                {cat.name}
                                {isBusy && <LoadingOutlined style={{ fontSize: FONT_SIZE.xs }} />}
                            </Tag>
                        </Dropdown>
                    );
                })}

                <Tag
                    onClick={openCreateModal}
                    style={{
                        margin: 0,
                        borderRadius: RADIUS.pill,
                        padding: '6px 14px',
                        fontSize: FONT_SIZE.md,
                        background: 'transparent',
                        border: `1px dashed ${token.colorBorder}`,
                        color: token.colorTextSecondary,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <PlusOutlined style={{ fontSize: FONT_SIZE.xs }} />
                    {t('settings.categories.newCategory')}
                </Tag>
            </Flex>

            {formModalOpen && (
                <CategoryFormModal
                    open={formModalOpen}
                    editingCategory={editingCategory}
                    onCancel={() => { setFormModalOpen(false); setEditingCategory(null); }}
                    onFinish={handleSubmit}
                    submitting={submitting}
                />
            )}
            {mergeModalOpen && (
                <CategoryMergeModal
                    open={mergeModalOpen}
                    source={mergeSource}
                    categories={categories}
                    onCancel={() => { setMergeModalOpen(false); setMergeSource(null); }}
                    onConfirm={handleMergeConfirm}
                    submitting={submitting}
                />
            )}
        </Card>
    );
};
