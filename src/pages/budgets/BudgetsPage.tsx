import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    App, Button, Card, Col, Flex, Popconfirm, Progress, Row, Skeleton, Switch, Tag, Typography, theme
} from 'antd';
import { BellOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EmptyState } from '../../components/common/EmptyState';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import type { BudgetTemplate, BudgetTemplateRequest, MonthlySummaryResponse } from '../../types/api';
import { BudgetTemplateModal } from '../../components/modals/BudgetTemplateModal';
import { BudgetAlertsDrawer } from './BudgetAlertsDrawer';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PageHeader } from '../../components/common/PageHeader';
import { Fab } from '../../components/common/Fab';
import { usePreferences } from '../../contexts/PreferencesContext';
import { FONT_SIZE, SPACING, getSemanticColors } from '../../theme/tokens';
import type { AppOutletContext } from '../../types/outletContext';

const { Text } = Typography;

export const BudgetsPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    usePageTitle(t('budgets.title'));
    const { categories } = useOutletContext<AppOutletContext>();
    const { isSmallMobile: isMobile } = useBreakpoints();
    const { preferences } = usePreferences();
    const { token } = theme.useToken();
    const semantic = getSemanticColors(preferences.theme === 'dark');

    const progressColor = (pct: number): string => {
        if (pct >= 100) return semantic.negative;
        if (pct >= 75) return semantic.warning;
        return semantic.positive;
    };

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
            <div>
                <Flex justify="space-between" style={{ marginBottom: 2 }}>
                    <Text style={{ fontSize: FONT_SIZE.sm }}>
                        {s.spent.toFixed(2)} / {s.limit.toFixed(2)} €
                    </Text>
                    <Text style={{ fontSize: FONT_SIZE.sm, color: progressColor(s.percentageUsed), fontWeight: 700 }}>
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

    const renderBudgetCard = (record: BudgetTemplate) => (
        <Card size="small" style={{ height: '100%' }}>
            <Flex justify="space-between" align="flex-start" style={{ marginBottom: SPACING.sm }}>
                <Flex vertical gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: FONT_SIZE.base }}>{record.categoryName}</Text>
                    <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>
                        {record.budgetLimit.toFixed(2)} €
                    </Text>
                </Flex>
                <Flex align="center" gap={SPACING.xs}>
                    <Tag style={{ margin: 0, borderRadius: 6 }}>{recurrenceLabel(record.recurrenceType)}</Tag>
                    <Switch checked={record.active} size="small" disabled />
                </Flex>
            </Flex>

            {renderProgress(record.categoryId)}

            <Flex justify="flex-end" gap={6} style={{ marginTop: SPACING.sm }}>
                <Button
                    icon={<BellOutlined />}
                    size="small"
                    style={{ background: token.colorFillTertiary, border: 'none' }}
                    onClick={() => setAlertsBudget(record)}
                    aria-label={t('budgets.manageAlerts')}
                />
                <Button
                    icon={<EditOutlined />}
                    size="small"
                    style={{ background: token.colorFillTertiary, border: 'none' }}
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
        </Card>
    );

    return (
        <>
            <PageHeader
                title={t('budgets.title')}
                actions={
                    // Su small-mobile la creazione avviene tramite il FAB (come da mockup);
                    // qui resta solo per desktop/tablet dove non c'è un FAB.
                    !isMobile && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => { setEditing(null); setIsModalOpen(true); }}
                        >
                            {t('budgets.newBudget')}
                        </Button>
                    )
                }
            />

            {isMobile && (
                <Fab
                    icon={<PlusOutlined />}
                    onClick={() => { setEditing(null); setIsModalOpen(true); }}
                    aria-label={t('budgets.newBudget')}
                />
            )}

            {loading ? (
                <Row gutter={[16, 16]}>
                    {[1, 2, 3].map(i => (
                        <Col key={i} xs={24} sm={isMobile ? 24 : 12} lg={8}>
                            <Card size="small"><Skeleton active paragraph={{ rows: 3 }} /></Card>
                        </Col>
                    ))}
                </Row>
            ) : budgets.length === 0 ? (
                <EmptyState
                    description={t('budgets.emptyList')}
                    actions={[{ label: t('budgets.emptyListCta'), onClick: () => { setEditing(null); setIsModalOpen(true); } }]}
                />
            ) : (
                <Row gutter={[16, 16]}>
                    {budgets.map(record => (
                        <Col key={record.id} xs={24} sm={isMobile ? 24 : 12} lg={8}>
                            {renderBudgetCard(record)}
                        </Col>
                    ))}
                </Row>
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
