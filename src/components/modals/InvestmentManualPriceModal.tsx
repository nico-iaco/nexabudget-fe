import { useState } from 'react';
import { Alert, App, Button, Flex, Form, InputNumber, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { updateInvestmentManualPrice } from '../../services/api';
import { invalidateInvestmentData } from '../../queryKeys';
import { apiErrorText } from '../../utils/apiError';
import { commaDecimalParser } from '../../utils/number';
import { isBond } from '../../utils/investments';
import type { InvestmentAsset } from '../../types/api';

interface Props {
    open: boolean;
    asset: InvestmentAsset | null;
    onClose: () => void;
}

const ManualPriceForm = ({ asset, onClose }: { asset: InvestmentAsset | null; onClose: () => void }) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async ({ price }: { price: number }) => {
        if (!asset) return;
        setSaving(true);
        setError(null);
        try {
            await updateInvestmentManualPrice(asset.id, price);
            invalidateInvestmentData(queryClient);
            message.success(t('investments.manualPrice.saved'));
            onClose();
        } catch (e) {
            console.error('Failed to update manual price:', e);
            setError(apiErrorText(e, t('investments.manualPrice.error')));
        } finally {
            setSaving(false);
        }
    };

    const bond = isBond(asset?.assetType);
    return (
        <>
            {asset && asset.priceSource !== 'MANUAL' && (
                <Alert type="info" showIcon title={t('investments.manualPrice.notManual')} style={{ marginBottom: 16 }} />
            )}
            {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
            <Form
                layout="vertical"
                onFinish={submit}
                initialValues={{ price: asset?.manualPrice ?? undefined }}
            >
                <Form.Item
                    name="price"
                    required
                    label={bond ? t('investments.manualPrice.labelBond') : `${t('investments.manualPrice.label')}${asset ? ` (${asset.currency})` : ''}`}
                    rules={[{
                        validator: (_, v) => (typeof v === 'number' && v > 0
                            ? Promise.resolve()
                            : Promise.reject(new Error(t('investments.manualPrice.required')))),
                    }]}
                >
                    <InputNumber<number> style={{ width: '100%' }} min={0} inputMode="decimal" parser={commaDecimalParser} />
                </Form.Item>
                <Flex justify="flex-end" gap={8}>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button type="primary" htmlType="submit" loading={saving}>{t('common.save')}</Button>
                </Flex>
            </Form>
        </>
    );
};

/**
 * PUT /investments/assets/{id}/manual-price: per i BTP e gli asset senza prezzo automatico.
 * Il contenuto vive in un componente interno montato solo a modale aperto (destroyOnHidden):
 * stato e valori iniziali ripartono puliti a ogni apertura, senza effetti di reset.
 */
export const InvestmentManualPriceModal = ({ open, asset, onClose }: Props) => {
    const { t } = useTranslation();
    return (
        <Modal title={asset && asset.priceSource !== 'MANUAL' ? t('investments.manualPrice.fallbackTitle') : t('investments.manualPrice.title')} open={open} onCancel={onClose} footer={null} destroyOnHidden>
            <ManualPriceForm asset={asset} onClose={onClose} />
        </Modal>
    );
};
