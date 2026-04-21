import { useEffect, useState } from 'react';
import {
    Button, Drawer, Empty, Flex, Form, InputNumber,
    Popconfirm, Switch, Table, message
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { BudgetAlert, BudgetTemplate } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';

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
    const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm<AlertFormValues>();

    const fetchAlerts = async () => {
        if (!budget) return;
        setLoading(true);
        try {
            const resp = await api.getBudgetAlerts(budget.id);
            setAlerts(resp.data);
        } catch {
            message.error(t('budgets.alerts.loadError', { defaultValue: 'Failed to load alerts' }));
        } finally {
            setLoading(false);
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
            await api.updateBudgetAlert(alert.id, { templateId: alert.budgetId, thresholdPercentage: alert.thresholdPercentage, active });
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
            render: (v: number) => `${v}%`,
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
            render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : t('budgets.alerts.never'),
        },
        {
            title: t('common.actions'),
            key: 'actions',
            render: (_: unknown, record: BudgetAlert) => (
                <Popconfirm
                    title={t('budgets.deleteConfirm')}
                    onConfirm={() => handleDelete(record.id)}
                    okText={t('common.delete')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true }}
                >
                    <Button danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>
            ),
        },
    ];

    return (
        <Drawer
            title={t('budgets.alerts.title', { name: budget?.categoryName ?? '' })}
            open={open}
            onClose={onClose}
            width={480}
        >
            <Form
                form={form}
                layout="inline"
                onFinish={handleAddAlert}
                initialValues={{ active: true }}
                style={{ marginBottom: 16 }}
            >
                <Form.Item name="thresholdPercentage" rules={[{ required: true, message: t('budgets.alerts.thresholdRequired') }]}>
                    <InputNumber min={1} max={100} addonAfter="%" placeholder="80" style={{ width: 120 }} />
                </Form.Item>
                <Form.Item name="active" valuePropName="checked">
                    <Switch checkedChildren={t('budgets.alerts.active')} unCheckedChildren={t('budgets.alerts.active')} />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit">{t('budgets.alerts.add')}</Button>
                </Form.Item>
            </Form>

            {alerts.length === 0 && !loading ? (
                <Empty description={t('budgets.alerts.emptyList')} />
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

            <Flex justify="flex-end" style={{ marginTop: 16 }}>
                <Button onClick={onClose}>{t('common.close')}</Button>
            </Flex>
        </Drawer>
    );
};
