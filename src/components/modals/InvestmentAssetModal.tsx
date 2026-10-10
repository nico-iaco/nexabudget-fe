import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Flex, Form, Input, InputNumber, Modal, Segmented, Spin, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeSelect } from '../common/SafeSelect';
import { SafeDatePicker } from '../common/SafeDatePicker';
import { createInvestmentAsset, searchInvestments, updateInvestmentAsset } from '../../services/api';
import { invalidateInvestmentData } from '../../queryKeys';
import { apiErrorText, applyApiFieldErrors, getApiErrorMessage, getApiErrorStatus } from '../../utils/apiError';
import { commaDecimalParser } from '../../utils/number';
import {
    ASSET_TYPES, COMMON_CURRENCIES, PRICE_SOURCES, SEARCH_MIN_LENGTH, buildAssetRequest, canSearch, defaultPriceSource,
    isBond, isCurrencyUndeterminedError, isUnverifiedProvider, looksLikeIsin, normalizeSearchQuery, symbolRequired,
} from '../../utils/investments';
import { FONT_SIZE, SPACING } from '../../theme/tokens';
import type {
    CouponFrequency, InvestmentAsset, InvestmentAssetType, InvestmentPriceSource, InvestmentSearchResult,
} from '../../types/api';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 400;
const FREQUENCIES: CouponFrequency[] = ['ANNUAL', 'SEMIANNUAL', 'QUARTERLY'];

interface FormValues {
    assetType: InvestmentAssetType;
    name: string;
    isin?: string;
    symbol?: string;
    currency?: string;
    priceSource: InvestmentPriceSource;
    manualPrice?: number | null;
    couponRate?: number | null;
    couponFrequency?: CouponFrequency;
    maturityDate?: Dayjs | null;
}

interface Props {
    open: boolean;
    /** Se presente, il modale modifica questo asset (valuta non modificabile). */
    asset?: InvestmentAsset | null;
    onClose: () => void;
    onSaved?: (asset: InvestmentAsset) => void;
}

const useDebounced = <T,>(value: T, delay: number): T => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
};

const EMPTY_FORM: Partial<FormValues> = { assetType: 'ETF', priceSource: 'YAHOO' };

const AssetForm = ({ asset, onClose, onSaved }: Omit<Props, 'open'>) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const [form] = Form.useForm<FormValues>();
    const editing = !!asset;

    const [mode, setMode] = useState<'search' | 'manual'>('search');
    const [selected, setSelected] = useState<InvestmentSearchResult | null>(null);
    const [searchText, setSearchText] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Il backend non ha ricavato la valuta dal ticker (Yahoo non risponde): si chiede esplicita.
    const [needCurrency, setNeedCurrency] = useState(false);
    // Se l'utente sceglie la fonte a mano, smettiamo di proporla in base al ticker.
    const sourceTouched = useRef(false);

    const initialValues: Partial<FormValues> = asset ? {
        assetType: asset.assetType,
        name: asset.name,
        isin: asset.isin ?? undefined,
        symbol: asset.symbol ?? undefined,
        currency: asset.currency,
        priceSource: asset.priceSource,
        couponRate: asset.couponRate ?? undefined,
        couponFrequency: asset.couponFrequency ?? undefined,
        maturityDate: asset.maturityDate ? dayjs(asset.maturityDate) : undefined,
    } : EMPTY_FORM;

    // Al primo render useWatch è ancora vuoto: si parte dai valori iniziali.
    const assetType = Form.useWatch('assetType', form) ?? initialValues.assetType;
    const priceSource = Form.useWatch('priceSource', form) ?? initialValues.priceSource;
    const bond = isBond(assetType);

    const debouncedQuery = useDebounced(normalizeSearchQuery(searchText), SEARCH_DEBOUNCE_MS);
    const searchEnabled = !editing && mode === 'search' && !selected && canSearch(debouncedQuery);
    const search = useQuery({
        queryKey: ['investment-search', debouncedQuery],
        queryFn: ({ signal }) => searchInvestments(debouncedQuery, signal).then(r => r.data),
        enabled: searchEnabled,
        staleTime: 5 * 60_000,
        retry: 0,
    });

    const changeMode = (next: 'search' | 'manual') => {
        setMode(next);
        setNeedCurrency(false);
        setSelected(null);
        setError(null);
        sourceTouched.current = false;
        form.resetFields();
        // Inserimento manuale: nessun ticker, prezzo aggiornato a mano.
        form.setFieldsValue(next === 'manual' ? { assetType: 'ETF', priceSource: 'MANUAL' } : EMPTY_FORM);
    };

    const pick = (result: InvestmentSearchResult) => {
        setSelected(result);
        setNeedCurrency(false);
        setError(null);
        sourceTouched.current = false;
        form.resetFields();
        form.setFieldsValue({
            symbol: result.symbol,
            name: result.name,
            assetType: result.suggestedType ?? 'OTHER',
            priceSource: 'YAHOO',
            // Cercando per ISIN, lo si porta nel form (i risultati non lo includono).
            isin: looksLikeIsin(searchText) ? searchText.trim().toUpperCase() : undefined,
        });
    };

    const submit = async (values: FormValues) => {
        setSaving(true);
        setError(null);
        try {
            const body = buildAssetRequest({
                ...values,
                maturityDate: values.maturityDate ? values.maturityDate.format('YYYY-MM-DD') : null,
            }, editing ? 'edit' : 'create');
            const { data } = asset
                ? await updateInvestmentAsset(asset.id, body)
                : await createInvestmentAsset(body);
            invalidateInvestmentData(queryClient);
            message.success(t(editing ? 'investments.asset.updated' : 'investments.asset.created'));
            onSaved?.(data);
            onClose();
        } catch (e) {
            console.error('Failed to save asset:', e);
            applyApiFieldErrors(form, e);
            if (!editing && isCurrencyUndeterminedError(getApiErrorStatus(e), getApiErrorMessage(e))) {
                setNeedCurrency(true);
            }
            // 409 duplicato (stesso ISIN o ticker), 400 validazione: il `message` del backend.
            setError(apiErrorText(e, t('investments.asset.saveError')));
        } finally {
            setSaving(false);
        }
    };

    const showForm = editing || mode === 'manual' || selected !== null;
    const results = search.data ?? [];

    return (
        <>
            {!editing && (
                <Segmented<'search' | 'manual'>
                    block
                    value={mode}
                    onChange={changeMode}
                    options={[
                        { value: 'search', label: t('investments.asset.tabSearch') },
                        { value: 'manual', label: t('investments.asset.tabManual') },
                    ]}
                    style={{ marginBottom: SPACING.md }}
                />
            )}

            {error && <Alert type="error" showIcon title={error} style={{ marginBottom: SPACING.md }} />}

            {!editing && mode === 'search' && !selected && (
                <div>
                    <Text strong>{t('investments.asset.searchLabel')}</Text>
                    <Input.Search
                        allowClear
                        autoFocus
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        placeholder={t('investments.asset.searchPlaceholder')}
                        loading={search.isFetching}
                        style={{ margin: `${SPACING.xs}px 0 ${SPACING.sm}px` }}
                    />
                    {!canSearch(searchText) && (
                        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                            {t('investments.asset.searchMinLength', { min: SEARCH_MIN_LENGTH })}
                        </Text>
                    )}
                    {searchEnabled && search.isPending && <Flex justify="center"><Spin /></Flex>}
                    {search.isError && (
                        <Alert type="warning" showIcon title={t('investments.asset.searchError')} />
                    )}
                    {search.isSuccess && results.length === 0 && (
                        <Text type="secondary">{t('investments.asset.searchEmpty')}</Text>
                    )}
                    {results.length > 0 && (
                        <>
                            {looksLikeIsin(debouncedQuery) && results.length > 1 && (
                                <Text type="secondary" style={{ display: 'block', fontSize: FONT_SIZE.sm, marginBottom: SPACING.xs }}>
                                    {t('investments.asset.listingHint')}
                                </Text>
                            )}
                            <Flex vertical gap={SPACING.xs} role="list">
                                {results.map(r => (
                                    <Button
                                        key={`${r.symbol}|${r.exchange ?? ''}|${r.provider}`}
                                        role="listitem"
                                        onClick={() => pick(r)}
                                        style={{ height: 'auto', padding: `${SPACING.xs}px ${SPACING.sm}px`, textAlign: 'left', whiteSpace: 'normal' }}
                                    >
                                        <Flex justify="space-between" align="center" gap={SPACING.sm} style={{ width: '100%' }}>
                                            <Flex vertical style={{ minWidth: 0 }}>
                                                <Text strong>{r.symbol}</Text>
                                                <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                                                    {[r.name, r.exchange].filter(Boolean).join(' · ')}
                                                </Text>
                                            </Flex>
                                            <Flex gap={4} wrap justify="flex-end">
                                                {r.suggestedType && <Tag style={{ margin: 0 }}>{t(`investments.types.${r.suggestedType}`)}</Tag>}
                                                {isUnverifiedProvider(r.provider) && (
                                                    <Tag color="warning" style={{ margin: 0 }}>{t('investments.asset.unverified')}</Tag>
                                                )}
                                            </Flex>
                                        </Flex>
                                    </Button>
                                ))}
                            </Flex>
                        </>
                    )}
                </div>
            )}

            {selected && !editing && (
                <Flex vertical gap={SPACING.xs} style={{ marginBottom: SPACING.md }}>
                    <Flex justify="space-between" align="center" gap={SPACING.sm}>
                        <Text>
                            <Text type="secondary">{t('investments.asset.selected')}: </Text>
                            <Text strong>{selected.symbol}</Text>
                            {selected.exchange && <Text type="secondary"> · {selected.exchange}</Text>}
                        </Text>
                        <Button size="small" onClick={() => changeMode('search')}>{t('investments.asset.changeSelection')}</Button>
                    </Flex>
                    {isUnverifiedProvider(selected.provider) && (
                        <Alert type="warning" showIcon title={t('investments.asset.unverifiedWarn')} />
                    )}
                </Flex>
            )}

            <Form
                form={form}
                layout="vertical"
                onFinish={submit}
                initialValues={initialValues}
                style={{ display: showForm ? undefined : 'none' }}
                onValuesChange={changed => {
                    if (changed.priceSource !== undefined) sourceTouched.current = true;
                    // Fonte di default del backend: Yahoo con un ticker, altrimenti manuale.
                    if ('symbol' in changed && !sourceTouched.current && !editing) {
                        form.setFieldValue('priceSource', defaultPriceSource(changed.symbol));
                    }
                }}
            >
                <Form.Item name="assetType" label={t('investments.asset.fields.assetType')}
                           rules={[{ required: true, message: t('investments.asset.validation.typeRequired') }]}>
                    <SafeSelect options={ASSET_TYPES.map(a => ({ value: a, label: t(`investments.types.${a}`) }))} />
                </Form.Item>

                {bond && <Alert type="info" showIcon title={t('investments.asset.bondHint')} style={{ marginBottom: SPACING.md }} />}

                <Form.Item name="name" label={t('investments.asset.fields.name')}
                           rules={[
                               { required: true, whitespace: true, message: t('investments.asset.validation.nameRequired') },
                               { max: 255, message: t('investments.asset.validation.nameMax') },
                           ]}>
                    <Input maxLength={255} />
                </Form.Item>
                <Form.Item name="isin" label={t('investments.asset.fields.isin')}
                           rules={[{ len: 12, message: t('investments.asset.validation.isinLength') }]}>
                    <Input maxLength={12} style={{ textTransform: 'uppercase' }} />
                </Form.Item>
                <Form.Item
                    name="symbol"
                    label={t('investments.asset.fields.symbol')}
                    extra={t('investments.asset.fields.symbolHint')}
                    dependencies={['priceSource']}
                    rules={[({ getFieldValue }) => ({
                        // Con una fonte automatica senza simbolo il backend risponde 400.
                        validator: (_, v?: string) => (!v?.trim() && symbolRequired(getFieldValue('priceSource'))
                            ? Promise.reject(new Error(t('investments.asset.validation.symbolRequired')))
                            : Promise.resolve()),
                    })]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    name="currency"
                    label={t('investments.asset.fields.currency')}
                    extra={editing
                        ? t('investments.asset.fields.currencyLocked')
                        : needCurrency ? t('investments.asset.fields.currencyNeeded') : t('investments.asset.fields.currencyAuto')}
                    dependencies={['symbol']}
                    rules={editing ? [] : [({ getFieldValue }) => ({
                        validator: (_, v?: string) => {
                            const value = v?.trim();
                            if (!value) {
                                // Senza ticker il backend non può ricavarla; con un ticker sì, salvo
                                // che abbia già fallito (needCurrency).
                                return getFieldValue('symbol')?.trim() && !needCurrency
                                    ? Promise.resolve()
                                    : Promise.reject(new Error(t('investments.asset.validation.currencyRequired')));
                            }
                            return /^[A-Za-z]{3}$/.test(value)
                                ? Promise.resolve()
                                : Promise.reject(new Error(t('investments.asset.validation.currencyLength')));
                        },
                    })]}
                >
                    {needCurrency
                        ? <SafeSelect showSearch options={COMMON_CURRENCIES.map(c => ({ value: c, label: c }))} />
                        : <Input maxLength={3} disabled={editing} style={{ textTransform: 'uppercase' }} />}
                </Form.Item>

                <Form.Item name="priceSource" label={t('investments.asset.fields.priceSource')}>
                    <SafeSelect options={PRICE_SOURCES.map(p => ({ value: p, label: t(`investments.sources.${p}`) }))} />
                </Form.Item>

                {editing && (
                    <Text type="secondary" style={{ display: 'block', fontSize: FONT_SIZE.sm, marginBottom: SPACING.md }}>
                        {t('investments.asset.fields.editResetHint')}
                    </Text>
                )}

                {priceSource === 'MANUAL' && !editing && (
                    <Form.Item
                        name="manualPrice"
                        label={bond ? t('investments.asset.fields.manualPriceBond') : t('investments.asset.fields.manualPrice')}
                        extra={t('investments.asset.manualHint')}
                    >
                        <InputNumber<number> style={{ width: '100%' }} min={0} inputMode="decimal" parser={commaDecimalParser} />
                    </Form.Item>
                )}

                {bond && (
                    <>
                        <Form.Item name="couponRate" label={t('investments.asset.fields.couponRate')}
                                   rules={[{ type: 'number', min: 0, max: 100, message: t('investments.asset.validation.couponRange') }]}>
                            <InputNumber<number> style={{ width: '100%' }} min={0} max={100} inputMode="decimal" parser={commaDecimalParser} />
                        </Form.Item>
                        <Form.Item name="couponFrequency" label={t('investments.asset.fields.couponFrequency')}>
                            <SafeSelect allowClear options={FREQUENCIES.map(f => ({ value: f, label: t(`investments.frequencies.${f}`) }))} />
                        </Form.Item>
                        <Form.Item name="maturityDate" label={t('investments.asset.fields.maturityDate')}>
                            <SafeDatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </>
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
 * Creazione (ricerca con scelta del listing, oppure inserimento manuale senza ticker) e
 * modifica di un asset. Un 409 (asset già presente con lo stesso ISIN o ticker) mostra il
 * messaggio del backend. Il form è un componente interno montato solo a modale aperto
 * (destroyOnHidden): stato e valori iniziali ripartono puliti a ogni apertura.
 */
export const InvestmentAssetModal = ({ open, asset, onClose, onSaved }: Props) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={asset ? t('investments.asset.editTitle') : t('investments.asset.addTitle')}
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnHidden
            width={560}
        >
            <AssetForm asset={asset} onClose={onClose} onSaved={onSaved} />
        </Modal>
    );
};
