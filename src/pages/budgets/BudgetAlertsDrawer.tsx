import { useEffect, useRef, useState } from 'react';
import {
    App, Button, Drawer, Flex, Form, InputNumber,
    Popconfirm, Switch, Table
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import type { BudgetAlert, BudgetTemplate } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { EmptyState } from '../../components/common/EmptyState';
import { InlineError } from '../../components/common/InlineError';
import { formatDateTime, formatPercent } from '../../utils/format';
import { SPACING } from '../../theme/tokens';
import { commaDecimalParser } from '../../utils/number';

interface Props {
    open: boolean;
    onClose: () => void;
    budget: BudgetTemplate | null;
}

interface AlertFormValues {
    thresholdPercentage: number;
    active: boolean;
}

export const BudgetAlertsDrawer = ({ open, onClose, budget }: Props) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [form] = Form.useForm<AlertFormValues>();
    // Ultima richiesta lanciata: aprendo un altro budget, la risposta lenta di quello
    // precedente non deve finire sotto il titolo del nuovo.
    const requestIdRef = useRef(0);

    // Cambiando budget la lista riparte vuota: prima restavano a schermo gli alert del
    // budget precedente finché (e se) arrivava la risposta.
    // Solo verso un altro budget: alla chiusura `budget` torna null e svuotare subito
    // faceva lampeggiare "nessun alert" durante l'animazione.
    const [prevBudgetId, setPrevBudgetId] = useState(budget?.id);
    if (budget && prevBudgetId !== budget.id) {
        setPrevBudgetId(budget.id);
        setAlerts([]);
        setLoadFailed(false);
    }

    const fetchAlerts = async () => {
        if (!budget) return;
        const requestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const resp = await api.getBudgetAlerts(budget.id);
            if (requestId !== requestIdRef.current) return;
            setAlerts(Array.isArray(resp.data) ? resp.data : []);
            setLoadFailed(false);
        } catch {
            if (requestId !== requestIdRef.current) return;
            // Un errore non è "nessun alert": la lista lascia il posto a InlineError.
            setLoadFailed(true);
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        if (open && budget) fetchAlerts();
    }, [open, budget]);

    const handleAddAlert = async (values: AlertFormValues) => {
        if (!budget) return;
        try {
            await api.createBudgetAlert({ templateId: budget.id, ...values });
            message.success(t('budgets.alerts.createdSuccess'));
            form.resetFields();
            form.setFieldsValue({ active: true });
            fetchAlerts();
        } catch {
            message.error(t('budgets.alerts.saveError'));
        }
    };

    const handleToggleActive = async (alert: BudgetAlert, active: boolean) => {
        try {
            if (!budget) return;
            // L'id del template è quello del drawer: `alert.budgetId` può riferirsi
            // all'istanza mensile del budget, non al template.
            await api.updateBudgetAlert(alert.id, { templateId: budget.id, thresholdPercentage: alert.thresholdPercentage, active });
            message.success(t('budgets.alerts.updatedSuccess'));
            fetchAlerts();
        } catch {
            message.error(t('budgets.alerts.saveError'));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.deleteBudgetAlert(id);
            message.success(t('budgets.alerts.deletedSuccess'));
            fetchAlerts();
        } catch {
            message.error(t('budgets.alerts.deleteError'));
        }
    };

    const columns: ColumnsType<BudgetAlert> = [
        {
            title: t('budgets.alerts.threshold'),
            dataIndex: 'thresholdPercentage',
            key: 'thresholdPercentage',
            render: (v: number) => formatPercent(v, 0),
        },
        {
            title: t('budgets.alerts.active'),
            dataIndex: 'active',
            key: 'active',
            render: (v: boolean, record: BudgetAlert) => (
                <Switch checked={v} onChange={(checked) => handleToggleActive(record, checked)} size="small" />
            ),
        },
        {
            title: t('budgets.alerts.lastNotified'),
            dataIndex: 'lastNotifiedAt',
            key: 'lastNotifiedAt',
            render: (v: string | null) => v ? formatDateTime(v) : t('budgets.alerts.never'),
        },
        {
            title: t('common.actions'),
            key: 'actions',
            render: (_: unknown, record: BudgetAlert) => (
                <Popconfirm
                    title={t('budgets.alerts.deleteConfirm')}
                    onConfirm={() => handleDelete(record.id)}
                    okText={t('common.delete')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true }}
                >
                    <Button danger icon={<DeleteOutlined />} size="small" aria-label={t('common.delete')} />
                </Popconfirm>
            ),
        },
    ];

    return (
        <Drawer
            title={t('budgets.alerts.title', { name: budget?.categoryName ?? '' })}
            open={open}
            onClose={onClose}
            size={480}
        >
            <Form
                form={form}
                layout="inline"
                onFinish={handleAddAlert}
                initialValues={{ active: true }}
                style={{ marginBottom: SPACING.md }}
            >
                <Form.Item name="thresholdPercentage" rules={[{ required: true, message: t('budgets.alerts.thresholdRequired') }]}>
                    <InputNumber<number> min={1} max={100} suffix="%" placeholder="80" style={{ width: 120 }} parser={commaDecimalParser} />
                </Form.Item>
                <Form.Item name="active" valuePropName="checked">
                    <Switch checkedChildren={t('budgets.alerts.active')} unCheckedChildren={t('budgets.alerts.active')} />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit">{t('budgets.alerts.add')}</Button>
                </Form.Item>
            </Form>

            {loadFailed ? (
                <InlineError message={t('budgets.alerts.loadError')} onRetry={fetchAlerts} />
            ) : alerts.length === 0 && !loading ? (
                <EmptyState description={t('budgets.alerts.emptyList')} />
            ) : (
                <Table
                    columns={columns}
                    dataSource={alerts}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    pagination={false}
                />
            )}

            <Flex justify="flex-end" style={{ marginTop: SPACING.md }}>
                <Button onClick={onClose}>{t('common.close')}</Button>
            </Flex>
        </Drawer>
    );
};
