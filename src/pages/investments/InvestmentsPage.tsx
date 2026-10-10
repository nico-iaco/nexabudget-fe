import { useState } from 'react';
import { Alert, Button, Card, Col, Collapse, Flex, Row, Skeleton, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { InlineError } from '../../components/common/InlineError';
import { StatCard } from '../../components/common/StatCard';
import { AllocationBar } from '../../components/investments/AllocationBar';
import { PerformanceSection } from '../../components/investments/PerformanceSection';
import { PeriodSelector } from '../../components/investments/PeriodSelector';
import { PortfolioHistorySection } from '../../components/investments/PortfolioHistorySection';
import { PositionsList } from '../../components/investments/PositionsList';
import { InvestmentAssetModal } from '../../components/modals/InvestmentAssetModal';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useInvestmentPortfolio } from '../../hooks/useInvestments';
import { usePreferences } from '../../contexts/PreferencesContext';
import { FONT_SIZE, GRADIENT_BALANCE, GRADIENT_BALANCE_DARK, SPACING, getSemanticColors } from '../../theme/tokens';
import { formatMoneyOrNA, formatPercentOrNA } from '../../utils/format';
import { plColor, splitPositions, type PeriodMonths } from '../../utils/investments';
import type { AllocationSlice } from '../../types/api';

const { Text } = Typography;

export const InvestmentsPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    usePageTitle(t('investments.title'));
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    const semantic = getSemanticColors(isDark);

    const [months, setMonths] = useState<PeriodMonths>(12);
    const [assetModalOpen, setAssetModalOpen] = useState(false);
    const { data, isPending, isError, refetch } = useInvestmentPortfolio();

    const { open, closed } = splitPositions(data?.positions);
    const currency = data?.currency ?? 'EUR';
    const hasAnything = (data?.positions.length ?? 0) > 0;

    const allocationRows = (slices: AllocationSlice[], labelOf: (key: string) => string) =>
        slices.map(s => ({ ...s, label: labelOf(s.key) }));

    const addButton = (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAssetModalOpen(true)}>
            {t('investments.addAsset')}
        </Button>
    );

    return (
        <>
            <PageHeader
                title={t('investments.title')}
                actions={
                    <Flex gap="small" wrap align="center" justify="flex-end">
                        <PeriodSelector value={months} onChange={setMonths} />
                        {addButton}
                    </Flex>
                }
            />

            {isPending && (
                <>
                    <Row gutter={[SPACING.md, SPACING.md]}>
                        {[0, 1, 2, 3].map(i => (
                            <Col key={i} xs={12} lg={6}><Skeleton.Button active block style={{ height: 100 }} /></Col>
                        ))}
                    </Row>
                    <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: SPACING.md }} />
                </>
            )}

            {/* Un errore non è "nessun investimento": prende il posto della vista, con Riprova. */}
            {!isPending && !data && isError && (
                <InlineError message={t('investments.loadError')} onRetry={() => { void refetch(); }} />
            )}

            {data && (
                <Flex vertical gap={SPACING.md}>
                    {!data.complete && (
                        <Alert type="warning" showIcon title={t('investments.incomplete')} />
                    )}

                    <Row gutter={[SPACING.md, SPACING.md]}>
                        <Col xs={24} lg={8}>
                            <StatCard
                                variant="borderless"
                                gradient={isDark ? GRADIENT_BALANCE_DARK : GRADIENT_BALANCE}
                                title={t('investments.summary.totalValue')}
                                value={data.totalValue ?? undefined}
                                formatter={() => formatMoneyOrNA(data.totalValue, currency)}
                            />
                        </Col>
                        <Col xs={12} lg={4}>
                            <StatCard
                                title={t('investments.summary.costBasis')}
                                value={data.totalCostBasis ?? undefined}
                                formatter={() => formatMoneyOrNA(data.totalCostBasis, currency)}
                            />
                        </Col>
                        <Col xs={12} lg={4}>
                            <StatCard
                                title={t('investments.summary.unrealizedPl')}
                                value={data.unrealizedPl ?? undefined}
                                color={plColor(data.unrealizedPl, semantic)}
                                formatter={() => formatMoneyOrNA(data.unrealizedPl, currency, { signed: true })}
                                footer={<Text style={{ color: plColor(data.unrealizedPlPercent, semantic), fontSize: FONT_SIZE.sm }}>
                                    {formatPercentOrNA(data.unrealizedPlPercent, 2, true)}
                                </Text>}
                            />
                        </Col>
                        <Col xs={12} lg={4}>
                            <StatCard
                                title={t('investments.summary.realizedPl')}
                                value={data.realizedPl ?? undefined}
                                color={plColor(data.realizedPl, semantic)}
                                formatter={() => formatMoneyOrNA(data.realizedPl, currency, { signed: true })}
                            />
                        </Col>
                        <Col xs={12} lg={4}>
                            <StatCard
                                title={t('investments.summary.income')}
                                value={data.income ?? undefined}
                                formatter={() => formatMoneyOrNA(data.income, currency)}
                            />
                        </Col>
                    </Row>

                    <Card title={t('investments.positions')}>
                        {!hasAnything ? (
                            <EmptyState
                                description={t('investments.empty')}
                                actions={[{ label: t('investments.addAsset'), onClick: () => setAssetModalOpen(true), icon: <PlusOutlined /> }]}
                            />
                        ) : (
                            <>
                                {open.length > 0 && <PositionsList positions={open} currency={currency} />}
                                {closed.length > 0 && (
                                    <Collapse
                                        ghost
                                        style={{ marginTop: open.length > 0 ? SPACING.md : 0 }}
                                        items={[{
                                            key: 'closed',
                                            label: t('investments.closedPositions', { count: closed.length }),
                                            children: (
                                                <>
                                                    <Text type="secondary" style={{ display: 'block', fontSize: FONT_SIZE.sm, marginBottom: SPACING.sm }}>
                                                        {t('investments.closedHint')}
                                                    </Text>
                                                    <PositionsList positions={closed} currency={currency} variant="closed" />
                                                </>
                                            ),
                                        }]}
                                    />
                                )}
                            </>
                        )}
                        <Text type="secondary" style={{ display: 'block', fontSize: FONT_SIZE.sm, marginTop: SPACING.md }}>
                            {t('investments.pricesNote')}
                        </Text>
                    </Card>

                    {hasAnything && (
                        <>
                            <Row gutter={[SPACING.md, SPACING.md]}>
                                <Col xs={24} md={12}>
                                    <Card title={`${t('investments.allocation.title')} · ${t('investments.allocation.byType')}`}>
                                        {data.allocationByType.length === 0
                                            ? <Text type="secondary">{t('investments.allocation.empty')}</Text>
                                            : <AllocationBar
                                                rows={allocationRows(data.allocationByType, k => t(`investments.types.${k}`, { defaultValue: k }))}
                                                currency={currency}
                                                aria-label={t('investments.allocation.byType')}
                                            />}
                                    </Card>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Card title={`${t('investments.allocation.title')} · ${t('investments.allocation.byCurrency')}`}>
                                        {data.allocationByCurrency.length === 0
                                            ? <Text type="secondary">{t('investments.allocation.empty')}</Text>
                                            : <AllocationBar
                                                rows={allocationRows(data.allocationByCurrency, k => k)}
                                                currency={currency}
                                                aria-label={t('investments.allocation.byCurrency')}
                                            />}
                                    </Card>
                                </Col>
                            </Row>

                            <Card title={t('investments.history.title')}>
                                <PortfolioHistorySection months={months} />
                            </Card>

                            <Card title={t('investments.performance.title')}>
                                <PerformanceSection months={months} />
                            </Card>
                        </>
                    )}
                </Flex>
            )}

            <InvestmentAssetModal
                open={assetModalOpen}
                onClose={() => setAssetModalOpen(false)}
                onSaved={asset => { void navigate(`/investments/${asset.id}`); }}
            />
        </>
    );
};
