import { useState } from 'react';
import { Alert, App, Button, Flex, Form, Input, InputNumber, Modal } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { SafeSelect } from '../common/SafeSelect';
import { SafeDatePicker } from '../common/SafeDatePicker';
import { createInvestmentOperation, updateInvestmentOperation } from '../../services/api';
import { invalidateInvestmentData } from '../../queryKeys';
import { apiErrorText, applyApiFieldErrors } from '../../utils/apiError';
import { commaDecimalParser } from '../../utils/number';
import { buildOperationRequest, isBond, isTradeOperation, operationTypesFor } from '../../utils/investments';
import type { InvestmentAsset, InvestmentOperation, InvestmentOperationType } from '../../types/api';

interface FormValues {
    type: InvestmentOperationType;
    operationDate: Dayjs | null;
    quantity?: number | null;
    price?: number | null;
    fees?: number | null;
    amount?: number | null;
    notes?: string;
}

interface Props {
    open: boolean;
    asset: InvestmentAsset | null;
    /** Se presente, il modale modifica questa operazione invece di crearne una. */
    operation?: InvestmentOperation | null;
    onClose: () => void;
}

const positive = (message: string) => ({
    validator: (_: unknown, v: unknown) => (typeof v === 'number' && v > 0 ? Promise.resolve() : Promise.reject(new Error(message))),
});

const OperationForm = ({ asset, operation, onClose }: Omit<Props, 'open'>) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const [form] = Form.useForm<FormValues>();
    const initialValues: Partial<FormValues> = operation ? {
        type: operation.type,
        operationDate: dayjs(operation.operationDate),
        quantity: operation.quantity ?? undefined,
        price: operation.price ?? undefined,
        fees: operation.fees,
        amount: operation.amount ?? undefined,
        notes: operation.notes ?? undefined,
    } : { type: 'BUY', operationDate: dayjs() };

    // Al primo render useWatch è ancora vuoto: si parte dal tipo iniziale per non far
    // lampeggiare i campi sbagliati.
    const type = Form.useWatch('type', form) ?? initialValues.type;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bond = isBond(asset?.assetType);
    const trade = isTradeOperation(type);

    const submit = async (values: FormValues) => {
        if (!asset || !values.operationDate) return;
        setSaving(true);
        setError(null);
        try {
            const body = buildOperationRequest({ ...values, operationDate: values.operationDate.format('YYYY-MM-DD') });
            if (operation) {
                await updateInvestmentOperation(operation.id, body);
                message.success(t('investments.operations.updated'));
            } else {
                await createInvestmentOperation(asset.id, body);
                message.success(t('investments.operations.saved'));
            }
            invalidateInvestmentData(queryClient);
            onClose();
        } catch (e) {
            console.error('Failed to save operation:', e);
            applyApiFieldErrors(form, e);
            // 400/404/409: il `message` del backend (es. vendita oltre la quantità detenuta).
            setError(apiErrorText(e, t('investments.operations.saveError')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
            <Form form={form} layout="vertical" onFinish={submit} initialValues={initialValues}>
                <Form.Item name="type" label={t('investments.operations.form.type')}>
                    <SafeSelect options={operationTypesFor(asset?.assetType, operation?.type).map(o => ({ value: o, label: t(`investments.opTypes.${o}`) }))} />
                </Form.Item>
                <Form.Item
                    name="operationDate"
                    label={t('investments.operations.form.date')}
                    rules={[{ required: true, message: t('investments.operations.form.dateRequired') }]}
                >
                    <SafeDatePicker style={{ width: '100%' }} allowClear={false} maxDate={dayjs()} />
                </Form.Item>

                {trade ? (
                    <>
                        <Form.Item
                            name="quantity"
                            required
                            label={bond ? t('investments.operations.form.nominal') : t('investments.operations.form.quantity')}
                            rules={[positive(t('investments.operations.form.quantityRequired'))]}
                        >
                            <InputNumber<number> style={{ width: '100%' }} min={0} inputMode="decimal" parser={commaDecimalParser} />
                        </Form.Item>
                        <Form.Item
                            name="price"
                            required
                            label={bond ? t('investments.operations.form.pricePercent') : t('investments.operations.form.price')}
                            rules={[positive(t('investments.operations.form.priceRequired'))]}
                        >
                            <InputNumber<number> style={{ width: '100%' }} min={0} inputMode="decimal" parser={commaDecimalParser} />
                        </Form.Item>
                        <Form.Item name="fees" label={t('investments.operations.form.fees')}>
                            <InputNumber<number> style={{ width: '100%' }} min={0} inputMode="decimal" parser={commaDecimalParser} />
                        </Form.Item>
                    </>
                ) : (
                    <Form.Item
                        name="amount"
                        required
                        label={t('investments.operations.form.amount')}
                        rules={[positive(t('investments.operations.form.amountRequired'))]}
                    >
                        <InputNumber<number> style={{ width: '100%' }} min={0} inputMode="decimal" parser={commaDecimalParser} />
                    </Form.Item>
                )}

                <Form.Item
                    name="notes"
                    label={t('investments.operations.form.notes')}
                    rules={[{ max: 500, message: t('investments.operations.form.notesMax') }]}
                >
                    <Input.TextArea rows={2} maxLength={500} />
                </Form.Item>

                {asset && (
                    <Alert type="info" showIcon style={{ marginBottom: 16 }}
                           title={t('investments.operations.form.currencyHint', { currency: asset.currency })} />
                )}

                <Flex justify="flex-end" gap={8}>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button type="primary" htmlType="submit" loading={saving}>{t('common.save')}</Button>
                </Flex>
            </Form>
        </>
    );
};

/**
 * Nuova operazione / modifica: i campi cambiano col tipo (BUY/SELL: quantità, prezzo,
 * commissioni; DIVIDEND/COUPON: importo netto incassato). Per le obbligazioni la quantità è
 * il valore nominale e il prezzo la quotazione in % del nominale. Un 409 (vendita oltre la
 * quantità detenuta) mostra il messaggio del backend così com'è.
 * Il form è un componente interno montato solo a modale aperto (destroyOnHidden): stato e
 * valori iniziali ripartono puliti a ogni apertura, senza effetti di reset.
 */
export const InvestmentOperationModal = ({ open, asset, operation, onClose }: Props) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={operation ? t('investments.operations.form.editTitle') : t('investments.operations.form.addTitle')}
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnHidden
        >
            <OperationForm asset={asset} operation={operation} onClose={onClose} />
        </Modal>
    );
};
