import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    App, Button, Card, Flex, List, Popconfirm, Progress, Switch, Table, Tag, Typography
} from 'antd';
import { BellOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EmptyState } from '../../components/common/EmptyState';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import type { BudgetTemplate, BudgetTemplateRequest, MonthlySummaryResponse } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { BudgetTemplateModal } from '../../components/modals/BudgetTemplateModal';
import { BudgetAlertsDrawer } from './BudgetAlertsDrawer';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PageHeader } from '../../components/common/PageHeader';
import { COLOR_POSITIVE, COLOR_NEGATIVE, COLOR_WARNING, FONT_SIZE, SPACING } from '../../theme/tokens';
import type { AppOutletContext } from '../../types/outletContext';

const { Text } = Typography;

const progressColor = (pct: number): string => {
    if (pct >= 100) return COLOR_NEGATIVE;
    if (pct >= 75) return COLOR_WARNING;
    return COLOR_POSITIVE;
};

export const BudgetsPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    usePageTitle(t('budgets.title'));
    const { categories } = useOutletContext<AppOutletContext>();
    const { isSmallMobile: isMobile } = useBreakpoints();

    const [budgets, setBudgets] = useState<BudgetTemplate[]>([]);
    const [summaries, setSummaries] = useState<MonthlySummaryResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<BudgetTemplate | null>(null);
    const [alertsBudget, setAlertsBudget] = useState<BudgetTemplate | null>(null);

    // Mappa categoryId → riepilogo mensile per lookup O(1).
    // Il join corretto è per categoryId: BudgetTemplate.categoryId = MonthlySummaryResponse.categoryId.
    // budgetId nella risposta si riferisce all'istanza mensile, non al template.
    const summaryMap = useMemo(
        () => new Map((Array.isArray(summaries) ? summaries : []).map(s => [s.categoryId, s])),
        [summaries]
    );

    const fetchBudgets = async () => {
        setLoading(true);
        try {
            const today = dayjs().format('YYYY-MM-DD');
            const [templatesResp, summaryResp] = await Promise.all([
                api.getBudgetTemplates(),
                api.getBudgetMonthlySummary(today).catch(() => ({ data: [] as MonthlySummaryResponse[] })),
            ]);
            setBudgets(Array.isArray(templatesResp.data) ? templatesResp.data : []);
            setSummaries(Array.isArray(summaryResp.data) ? summaryResp.data : []);
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

    const renderProgress = (categoryId: string) => {
        const s = summaryMap.get(categoryId);
        if (!s) return <Text type="secondary">{t('budgets.noMonthlyData')}</Text>;
        const pct = Math.min(s.percentageUsed, 100);
        return (
            <div style={{ minWidth: 160 }}>
                <Flex justify="space-between" style={{ marginBottom: 2 }}>
                    <Text style={{ fontSize: FONT_SIZE.sm }}>
                        {s.spent.toFixed(2)} / {s.limit.toFixed(2)} €
                    </Text>
                    <Text style={{ fontSize: FONT_SIZE.sm, color: progressColor(s.percentageUsed) }}>
                        {s.percentageUsed.toFixed(0)}%
                    </Text>
                </Flex>
                <Progress
                    percent={pct}
                    size="small"
                    showInfo={false}
                    strokeColor={progressColor(s.percentageUsed)}
                    aria-label={`${t('budgets.spent')}: ${s.percentageUsed.toFixed(0)}%`}
                />
                <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>
                    {t('budgets.remaining')}: {s.remaining.toFixed(2)} €
                </Text>
            </div>
        );
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
            title: t('budgets.monthlyProgress'),
            key: 'monthlyProgress',
            render: (_: unknown, record: BudgetTemplate) => renderProgress(record.categoryId),
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
            <PageHeader
                title={t('budgets.title')}
                actions={
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => { setEditing(null); setIsModalOpen(true); }}
                        block={isMobile}
                    >
                        {t('budgets.newBudget')}
                    </Button>
                }
            />

            {!loading && budgets.length === 0 ? (
                <EmptyState
                    description={t('budgets.emptyList')}
                    actions={[{ label: t('budgets.emptyListCta'), onClick: () => { setEditing(null); setIsModalOpen(true); } }]}
                />
            ) : isMobile ? (
                <List
                    dataSource={budgets}
                    loading={loading}
                    renderItem={(record) => (
                        <Card
                            size="small"
                            style={{ marginBottom: SPACING.sm }}
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
                            <Flex justify="space-between" align="flex-start" style={{ marginBottom: SPACING.xs }}>
                                <Flex vertical gap={4} style={{ flex: 1, minWidth: 0 }}>
                                    <Typography.Text strong>{record.categoryName}</Typography.Text>
                                    <Typography.Text type="secondary">
                                        {record.budgetLimit.toFixed(2)} € · <Tag style={{ margin: 0 }}>{recurrenceLabel(record.recurrenceType)}</Tag>
                                    </Typography.Text>
                                </Flex>
                                <Switch checked={record.active} size="small" disabled style={{ marginLeft: SPACING.xs, flexShrink: 0 }} />
                            </Flex>
                            {renderProgress(record.categoryId)}
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
                    scroll={{ x: 'max-content' }}
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
