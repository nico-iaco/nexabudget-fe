import { useMemo, useState } from 'react';
import { App, Button, Card, Popconfirm, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BranchesOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import type { Category, CategoryRequest } from '../../types/api';
import { createCategory, deleteCategory, mergeCategoryInto, updateCategory } from '../../services/api';
import { CategoryFormModal } from '../../components/modals/CategoryFormModal';
import { CategoryMergeModal } from '../../components/modals/CategoryMergeModal';

interface OutletContextType {
    categories: Category[];
    fetchCategories: () => void;
}

export const CategoriesCard = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const { categories, fetchCategories } = useOutletContext<OutletContextType>();

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

    const handleDelete = async (record: Category) => {
        setRowBusyId(record.id);
        try {
            await deleteCategory(record.id);
            message.success(t('settings.categories.deletedSuccess'));
            fetchCategories();
        } catch (error) {
            message.error(t('settings.categories.deleteError'));
        } finally {
            setRowBusyId(null);
        }
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

    const columns: ColumnsType<Category> = [
        {
            title: t('settings.categories.name'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('settings.categories.type'),
            key: 'type',
            width: 160,
            render: (_, record) =>
                record.isDefault
                    ? <Tag>{t('settings.categories.typeDefault')}</Tag>
                    : <Tag color="blue">{t('settings.categories.typeCustom')}</Tag>,
        },
        {
            title: t('settings.categories.actions'),
            key: 'actions',
            width: 160,
            render: (_, record) => {
                const isBusy = rowBusyId === record.id;
                if (record.isDefault) {
                    return (
                        <Tooltip title={t('settings.categories.defaultLocked')}>
                            <Space>
                                <Button type="text" icon={<EditOutlined />} disabled />
                                <Button type="text" icon={<BranchesOutlined />} disabled />
                                <Button type="text" danger icon={<DeleteOutlined />} disabled />
                            </Space>
                        </Tooltip>
                    );
                }
                const canMerge = userCategoriesCount > 1;
                return (
                    <Space>
                        <Tooltip title={t('settings.categories.editCategory')}>
                            <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => openEditModal(record)}
                                disabled={isBusy}
                            />
                        </Tooltip>
                        <Tooltip title={canMerge ? t('settings.categories.mergeCategory') : t('settings.categories.mergeNoTargets')}>
                            <Button
                                type="text"
                                icon={<BranchesOutlined />}
                                onClick={() => openMergeModal(record)}
                                disabled={isBusy || !canMerge}
                            />
                        </Tooltip>
                        <Popconfirm
                            title={t('settings.categories.deleteConfirm')}
                            onConfirm={() => handleDelete(record)}
                            okText={t('common.yes')}
                            cancelText={t('common.no')}
                            okButtonProps={{ danger: true }}
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} loading={isBusy} />
                        </Popconfirm>
                    </Space>
                );
            }
        }
    ];

    return (
        <Card
            title={t('settings.categories.cardTitle')}
            extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                    {t('settings.categories.newCategory')}
                </Button>
            }
            style={{ marginBottom: 16 }}
        >
            <Table<Category>
                dataSource={sortedCategories}
                columns={columns}
                rowKey="id"
                pagination={false}
                locale={{ emptyText: t('settings.categories.emptyList') }}
                scroll={{ x: 600 }}
                size="middle"
            />
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
