import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Button, Card, Empty, Flex, List, Popconfirm, Switch, Table, Tag, Typography, message
} from 'antd';
import { BellOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import type { BudgetTemplate, BudgetTemplateRequest, Category } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { BudgetTemplateModal } from './BudgetTemplateModal';
import { BudgetAlertsDrawer } from './BudgetAlertsDrawer';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const { Title } = Typography;

interface OutletContextType {
    categories: Category[];
}

export const BudgetsPage = () => {
    const { t } = useTranslation();
    const { categories } = useOutletContext<OutletContextType>();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [budgets, setBudgets] = useState<BudgetTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<BudgetTemplate | null>(null);
    const [alertsBudget, setAlertsBudget] = useState<BudgetTemplate | null>(null);

    const fetchBudgets = async () => {
        setLoading(true);
        try {
            const resp = await api.getBudgetTemplates();
            setBudgets(resp.data);
        } catch {
            message.error(t('budgets.loadError', { defaultValue: 'Failed to load budgets' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBudgets(); }, []);

    const handleFinish = async (values: BudgetTemplateRequest) => {
        try {
            if (editing) {
                await api.updateBudgetTemplate(editing.id, values);
                message.success(t('budgets.updatedSuccess'));
            } else {
                await api.createBudgetTemplate(values);
                message.success(t('budgets.createdSuccess'));
            }
            setIsModalOpen(false);
            setEditing(null);
            fetchBudgets();
        } catch {
            message.error(t('budgets.saveError'));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.deleteBudgetTemplate(id);
            message.success(t('budgets.deletedSuccess'));
            fetchBudgets();
        } catch {
            message.error(t('budgets.deleteError'));
        }
    };

    const recurrenceLabel = (r: BudgetTemplate['recurrenceType']) => {
        const map = {
            MONTHLY: t('budgets.recurrenceMonthly'),
            QUARTERLY: t('budgets.recurrenceQuarterly'),
            YEARLY: t('budgets.recurrenceYearly'),
        };
        return map[r];
    };

    const columns: ColumnsType<BudgetTemplate> = [
        {
            title: t('budgets.category'),
            dataIndex: 'categoryName',
            key: 'categoryName',
        },
        {
            title: t('budgets.limit'),
            dataIndex: 'budgetLimit',
            key: 'budgetLimit',
            render: (v: number) => `${v.toFixed(2)} €`,
            sorter: (a, b) => a.budgetLimit - b.budgetLimit,
        },
        {
            title: t('budgets.recurrence'),
            dataIndex: 'recurrenceType',
            key: 'recurrenceType',
            render: (v: BudgetTemplate['recurrenceType']) => <Tag>{recurrenceLabel(v)}</Tag>,
        },
        {
            title: t('budgets.active'),
            dataIndex: 'active',
            key: 'active',
            render: (v: boolean) => <Switch checked={v} size="small" disabled />,
        },
        {
            title: t('common.actions'),
            key: 'actions',
            render: (_: unknown, record: BudgetTemplate) => (
                <Flex gap="small">
                    <Button
                        icon={<BellOutlined />}
                        size="small"
                        onClick={() => setAlertsBudget(record)}
                        aria-label={t('budgets.manageAlerts')}
                    />
                    <Button
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => { setEditing(record); setIsModalOpen(true); }}
                        aria-label={t('common.edit')}
                    />
                    <Popconfirm
                        title={t('budgets.deleteConfirm')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.delete')}
                        cancelText={t('common.cancel')}
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger icon={<DeleteOutlined />} size="small" aria-label={t('common.delete')} />
                    </Popconfirm>
                </Flex>
            ),
        },
    ];

    return (
        <>
            <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
                <Title level={2} style={{ margin: 0 }}>{t('budgets.title')}</Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => { setEditing(null); setIsModalOpen(true); }}
                >
                    {t('budgets.newBudget')}
                </Button>
            </Flex>

            {!loading && budgets.length === 0 ? (
                <Empty description={t('budgets.emptyList')} />
            ) : isMobile ? (
                <List
                    dataSource={budgets}
                    loading={loading}
                    renderItem={(record) => (
                        <Card
                            size="small"
                            style={{ marginBottom: 12 }}
                            actions={[
                                <Button
                                    key="alerts"
                                    type="text"
                                    icon={<BellOutlined />}
                                    onClick={() => setAlertsBudget(record)}
                                    aria-label={t('budgets.manageAlerts')}
                                />,
                                <Button
                                    key="edit"
                                    type="text"
                                    icon={<EditOutlined />}
                                    onClick={() => { setEditing(record); setIsModalOpen(true); }}
                                    aria-label={t('common.edit')}
                                />,
                                <Popconfirm
                                    key="delete"
                                    title={t('budgets.deleteConfirm')}
                                    onConfirm={() => handleDelete(record.id)}
                                    okText={t('common.delete')}
                                    cancelText={t('common.cancel')}
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button danger type="text" icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                                </Popconfirm>,
                            ]}
                        >
                            <Flex justify="space-between" align="flex-start">
                                <Flex vertical gap={4}>
                                    <Typography.Text strong>{record.categoryName}</Typography.Text>
                                    <Typography.Text type="secondary">
                                        {record.budgetLimit.toFixed(2)} € · <Tag style={{ margin: 0 }}>{recurrenceLabel(record.recurrenceType)}</Tag>
                                    </Typography.Text>
                                </Flex>
                                <Switch checked={record.active} size="small" disabled />
                            </Flex>
                        </Card>
                    )}
                />
            ) : (
                <Table
                    columns={columns}
                    dataSource={budgets}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={{ defaultPageSize: 20, showSizeChanger: false }}
                />
            )}

            <BudgetTemplateModal
                open={isModalOpen}
                onCancel={() => { setIsModalOpen(false); setEditing(null); }}
                onFinish={handleFinish}
                editing={editing}
                categories={categories}
            />

            <BudgetAlertsDrawer
                open={!!alertsBudget}
                onClose={() => setAlertsBudget(null)}
                budget={alertsBudget}
            />
        </>
    );
};
