// src/pages/dashboard/DashboardPage.tsx
import { useState, lazy, Suspense } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
    Button, Card, Col, DatePicker, Flex, Progress, Row, Select, Skeleton, Statistic, Table, Tabs, Tooltip, Typography, theme,
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useDashboardData } from '../../hooks/useDashboardData';
import { usePageTitle } from '../../hooks/usePageTitle';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

// Su mobile si carica il bundle di grafici leggero, su desktop quello completo (entrambi
// SVG scritti a mano). Valutato una volta al caricamento del modulo: in una sessione PWA
// il tipo di dispositivo non cambia.
// Deve combaciare col default di `height` in Sparkline (dashboard/Sparkline.tsx).
const SPARKLINE_HEIGHT = 32;

const _isMobileAtLoad = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
const _chartsModule = () =>
    _isMobileAtLoad
        ? import('../../components/dashboard/DashboardChartsMobile')
        : import('../../components/dashboard/DashboardCharts');
const GenericPieChart = lazy(() => _chartsModule().then(m => ({ default: m.GenericPieChart })));
const TrendDualChart = lazy(() => _chartsModule().then(m => ({ default: m.TrendDualChart })));
const ComparisonBars = lazy(() => _chartsModule().then(m => ({ default: m.ComparisonBars })));
const Sparkline = lazy(() => _chartsModule().then(m => ({ default: m.Sparkline })));
// Lazy: AiAnalysisCard importa react-markdown + remark-gfm (153 kB raw / 40 kB gzip)
// per una card opzionale, e li portava nel chunk della route di atterraggio.
const AiAnalysisCard = lazy(() => import('../../components/dashboard/AiAnalysisCard').then(m => ({ default: m.AiAnalysisCard })));
import { BalanceTrendSection } from '../../components/reports/BalanceTrendSection';
import * as api from '../../services/api';
import { queryKeys } from '../../queryKeys';
import type { CategoryBreakdownItem, MonthComparisonResponse, MonthlySummaryResponse } from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { usePreferences } from '../../contexts/PreferencesContext';
import { ON_GRADIENT_SPARKLINE, SPACING, budgetUsageColor, FONT_SIZE, GRADIENT_BALANCE, GRADIENT_BALANCE_DARK, getSemanticColors } from '../../theme/tokens';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { InlineError } from '../../components/common/InlineError';
import { StatCard } from '../../components/common/StatCard';
import { OnboardingChecklist } from '../../components/onboarding/OnboardingChecklist';
import type { AppOutletContext } from '../../types/outletContext';
import { DatePresetPicker } from '../../components/common/DatePresetPicker';
import { SafeDatePicker } from '../../components/common/SafeDatePicker';
import { formatMoney, formatPercent } from '../../utils/format';
import { getRangePresets } from '../../utils/datePresets';
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency';

const { Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * Titolo con icona info sulla base di calcolo dei report: netto per categoria (un rimborso
 * riduce la spesa della sua categoria). Totali, ripartizione, trend, confronto e
 * proiezione usano tutti questa base, quindi i loro numeri sono confrontabili.
 */
const NetBasisTitle = ({ title, hint }: { title: string; hint: string }) => (
    <Flex align="center" gap={6} component="span">
        {title}
        <Tooltip title={hint}>
            <InfoCircleOutlined aria-label={hint} style={{ fontSize: FONT_SIZE.sm, opacity: 0.65 }} />
        </Tooltip>
    </Flex>
);

// Preset condivisi (utils/datePresets): stessi intervalli di report e transazioni.
const PRESETS = (t: (k: string) => string) =>
    getRangePresets(t, ['last7Days', 'thisMonth', 'previousMonth', 'last6Months', 'last12Months']);

export const DashboardPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { transactionRefreshKey, accounts, onOpenCreateAccount } = useOutletContext<AppOutletContext>();
    const { isSmallMobile: isMobile } = useBreakpoints();
    const { preferences } = usePreferences();
    const isDark = preferences.theme === 'dark';
    const semantic = getSemanticColors(isDark);
    const { token } = theme.useToken();
    const balanceGradient = isDark ? GRADIENT_BALANCE_DARK : GRADIENT_BALANCE;

    usePageTitle(t('dashboard.title'));
    const netBasisHint = t('reports.netBasisHint');

    const [trendMonths, setTrendMonths] = useState(12);

    const {
        loading,
        refreshing,
        appliedRange,
        dateRange,
        setDateRange,
        totalIncome,
        totalExpenses,
        netBalance,
        expensesByCategory,
        incomeByCategory,
        incomeBreakdown,
        expenseBreakdown,
        trendPoints,
        incomeSparkline,
        expenseSparkline,
        netSparkline,
        expenseComparison,
        portfolioValue,
        projection,
        budgetSummary,
        hasData,
        failedSections,
        refetch: refetchDashboard,
    } = useDashboardData(transactionRefreshKey, trendMonths);

    // Una sezione fallita mostra un errore con Riprova al posto del valore di fallback:
    // "0,00 €" o un grafico vuoto sarebbero indistinguibili da dati reali.
    const breakdownFailed = failedSections.has('categoryBreakdown');
    const trendFailed = failedSections.has('monthlyTrend');
    const budgetsFailed = failedSections.has('budgetSummary');
    const projectionFailed = failedSections.has('monthlyProjection');
    // Senza breakdown né trend non sappiamo se l'utente ha dati: niente onboarding né
    // "aggiungi la prima transazione", solo l'errore.
    const coreFailed = breakdownFailed && trendFailed;
    // Con una delle due fonti fallita "nessun dato" non è affidabile: niente stato vuoto da
    // nuovo utente (prima bastava il trend fallito su un intervallo senza movimenti).
    const emptyIsKnown = !breakdownFailed && !trendFailed;
    const portfolioFailed = failedSections.has('portfolioValue');
    const retryDashboard = () => { void refetchDashboard(); };

    usePullToRefresh(refetchDashboard ?? (() => {}), isMobile);

    // Confronto mese scelto dall'utente — cached via React Query.
    const [comparisonMonth, setComparisonMonth] = useState<Dayjs>(dayjs());
    const {
        data: customComparison,
        isPending: loadingComparison,
        isError: comparisonFailed,
        refetch: refetchComparison,
    } = useQuery<MonthComparisonResponse>({
        queryKey: queryKeys.monthComparison(comparisonMonth.year(), comparisonMonth.month() + 1),
        queryFn: () => api.getMonthComparison(comparisonMonth.year(), comparisonMonth.month() + 1).then(r => r.data),
        placeholderData: keepPreviousData,
    });

    // Un errore del portafoglio non mostra la card: chi non ha crypto vedrebbe una card
    // d'errore fissa. Il toast delle sezioni fallite (useDashboardData) lo segnala già.
    const showCrypto = !portfolioFailed && !!portfolioValue && portfolioValue.totalValue > 0;
    // La variazione spese è sempre "mese corrente vs precedente": ha senso solo sotto il
    // totale del mese corrente, non sotto quello di un altro intervallo.
    const isCurrentMonthRange = appliedRange[0] === dayjs().startOf('month').format('YYYY-MM-DD')
        && appliedRange[1] === dayjs().endOf('month').format('YYYY-MM-DD');
    // Quattro card affiancate solo da xl: fra 992 e 1199px la Sider da 300px lascia ~600px
    // e gli importi andavano a capo a metà (valore e simbolo su righe diverse).
    const statCols = showCrypto ? { xs: 24, sm: 12, xl: 6 } : { xs: 24, sm: 8 };

    const currency = useDefaultCurrency();
    const moneyFormatter = (v: string | number) => formatMoney(Number(v), currency);

    const breakdownColumns: ColumnsType<CategoryBreakdownItem> = [
        { title: t('reports.categoryName'), dataIndex: 'categoryName', key: 'categoryName', ellipsis: { showTitle: true } },
        {
            title: t('reports.net'), dataIndex: 'net', key: 'net', width: 110, align: 'right',
            render: (v: number) => formatMoney(v, currency),
            defaultSortOrder: 'ascend',
            sorter: (a, b) => b.net - a.net,
        },
        { title: t('reports.percentage'), dataIndex: 'percentage', key: 'percentage', width: 100, align: 'right', render: (v: number) => formatPercent(v) },
    ];

    // Ripartizione per categoria. Con il modulo grafici mobile (scelto al caricamento,
    // vedi `_isMobileAtLoad`) GenericPieChart è già un elenco a barre con importo e
    // percentuale: la tabella sotto ripeteva gli stessi dati, quindi lì si mostrano solo
    // le barre. La torta desktop invece non riporta gli importi e resta affiancata alla tabella.
    const renderBreakdown = (chartData: { type: string; value: number }[], tableData: CategoryBreakdownItem[]) => (
        _isMobileAtLoad ? (
            <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
                <GenericPieChart data={chartData} />
            </Suspense>
        ) : (
            <Row gutter={[16, 16]}>
                <Col xs={24} md={10} lg={24} xxl={10}>
                    <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
                        <GenericPieChart data={chartData} />
                    </Suspense>
                </Col>
                <Col xs={24} md={14} lg={24} xxl={14}>
                    <Table
                        tableLayout="fixed"
                        columns={breakdownColumns}
                        dataSource={tableData}
                        rowKey={(record) => record.categoryId ?? 'uncategorized'}
                        size="small"
                        pagination={false}
                        locale={{ emptyText: <EmptyState description={t('charts.noData')} /> }}
                    />
                </Col>
            </Row>
        )
    );

    const budgetProgressColor = (pct: number) => budgetUsageColor(pct, semantic);

    const renderBudgetSummaryItem = (item: MonthlySummaryResponse) => (
        <Col key={item.budgetId} xs={24}>
            <div style={{ marginBottom: 4 }}>
                <Flex justify="space-between" align="center">
                    <Text strong style={{ fontSize: FONT_SIZE.md }}>{item.categoryName}</Text>
                    <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                        {formatMoney(item.spent, currency)} / {formatMoney(item.limit, currency)}
                    </Text>
                </Flex>
                {/* La barra si ferma al 100%, l'etichetta no: un budget al 140% deve leggersi 140%. */}
                <Progress
                    aria-label={`${t('budgets.used')}: ${formatPercent(item.percentageUsed, 0)}`}
                    percent={Math.min(item.percentageUsed, 100)}
                    size="small"
                    strokeColor={budgetProgressColor(item.percentageUsed)}
                    format={() => <Text style={{ fontSize: FONT_SIZE.xs }}>{formatPercent(item.percentageUsed, 0)}</Text>}
                />
                <Flex justify="space-between">
                    {item.remaining < 0 ? (
                        <Text type="danger" style={{ fontSize: FONT_SIZE.xs }}>
                            {t('dashboard.budgetSummary.overBy')}: {formatMoney(-item.remaining, currency)}
                        </Text>
                    ) : (
                        <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>
                            {t('dashboard.budgetSummary.remaining')}: {formatMoney(item.remaining, currency)}
                        </Text>
                    )}
                </Flex>
            </div>
        </Col>
    );

    if (loading) {
        return (
            <>
                <PageHeader title={t('dashboard.title')} />
                <Skeleton active paragraph={{ rows: 1 }} />
                <Row gutter={[SPACING.md, SPACING.md]} style={{ marginTop: SPACING.md }}>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                </Row>
                <Row gutter={[SPACING.md, SPACING.md]} style={{ marginTop: SPACING.md }}>
                    <Col xs={24} md={12}><Skeleton active paragraph={{ rows: 6 }} /></Col>
                    <Col xs={24} md={12}><Skeleton active paragraph={{ rows: 6 }} /></Col>
                </Row>
                <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: SPACING.md }} />
                {/* Montate anche durante il caricamento: hanno una query propria, e
                    l'early-return globale le teneva smontate finché il Promise.all da 6
                    chiamate non era interamente risolto — il loro TTFB diventava "la più
                    lenta delle sei" più la propria latenza. Entrambe hanno già uno stato
                    di caricamento interno. */}
                <div style={{ marginTop: SPACING.md }}>
                    <Suspense fallback={<Skeleton active paragraph={{ rows: 2 }} />}>
                        <AiAnalysisCard />
                    </Suspense>
                </div>
                <div style={{ marginTop: SPACING.md }}>
                    <BalanceTrendSection showTable={false} />
                </div>
            </>
        );
    }

    const filterControls = (
        <div style={{ width: isMobile ? '100%' : 'auto' }}>
            {isMobile ? (
                        <DatePresetPicker
                            presets={PRESETS(t)}
                            value={[dateRange?.[0] ?? null, dateRange?.[1] ?? null]}
                            onChange={(range) => setDateRange(range)}
                            customLabel={t('dashboard.presets.custom')}
                            startPlaceholder={t('dashboard.presets.startDate')}
                            endPlaceholder={t('dashboard.presets.endDate')}
                        />
                    ) : (
                        <Flex gap={6} align="center" justify="flex-end" wrap>
                            {PRESETS(t).map(p => {
                                const isActive = dateRange?.[0]?.isSame(p.value[0], 'day') && dateRange?.[1]?.isSame(p.value[1], 'day');
                                return (
                                    <Button
                                        key={p.key}
                                        size="small"
                                        type={isActive ? 'primary' : 'default'}
                                        onClick={() => setDateRange(p.value)}
                                    >
                                        {p.label}
                                    </Button>
                                );
                            })}
                            <RangePicker
                                value={dateRange}
                                onChange={(dates) => setDateRange(dates)}
                                style={{ maxWidth: 280 }}
                                allowClear={false}
                            />
                        </Flex>
                    )}
        </div>
    );

    return (
        <>
            <PageHeader title={t('dashboard.title')} actions={filterControls} />

            {/* Con dati mancanti la checklist segnerebbe come "da fare" passi già completati. */}
            {emptyIsKnown && !budgetsFailed && (
                <OnboardingChecklist
                    hasAccounts={accounts.length > 0}
                    hasTransactions={hasData}
                    hasBudgets={budgetSummary.length > 0}
                    onCreateAccount={onOpenCreateAccount}
                    onAddTransaction={() => navigate('/transactions')}
                    onCreateBudget={() => navigate('/budgets')}
                />
            )}

            {coreFailed ? (
                <InlineError message={t('dashboard.loadErrorFull')} onRetry={retryDashboard} />
            ) : !hasData && emptyIsKnown ? (
                <EmptyState
                    description={
                        accounts.length === 0
                            ? t('dashboard.emptyNoAccounts')
                            : t('dashboard.empty')
                    }
                    actions={
                        accounts.length === 0
                            ? [
                                { label: t('dashboard.emptyCtaAccount'), onClick: onOpenCreateAccount },
                                { label: t('dashboard.emptyCtaBankLink'), onClick: onOpenCreateAccount, type: 'default' },
                              ]
                            : [
                                { label: t('dashboard.emptyCtaTransaction'), onClick: () => navigate('/transactions') },
                              ]
                    }
                />
            ) : (
                <div
                    aria-busy={refreshing}
                    style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity 0.2s ease' }}
                >
                    {/* Statistiche mese corrente */}
                    <Row gutter={[16, 16]}>
                        {breakdownFailed ? (
                            <Col xs={24} xl={showCrypto ? 18 : 24}>
                                <InlineError message={t('dashboard.totalsLoadError')} onRetry={retryDashboard} />
                            </Col>
                        ) : (
                            <>
                                <Col {...statCols}>
                                    <StatCard
                                        title={t('dashboard.netBalance')}
                                        value={netBalance}
                                        currency={currency}
                                        gradient={balanceGradient}
                                        prefix={netBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                        footer={
                                            <Suspense fallback={<div style={{ height: SPARKLINE_HEIGHT + SPACING.xs }} />}>
                                                <Sparkline values={netSparkline} color={ON_GRADIENT_SPARKLINE} />
                                            </Suspense>
                                        }
                                    />
                                </Col>
                                <Col {...statCols}>
                                    <StatCard
                                        title={<NetBasisTitle title={t('dashboard.totalIncome')} hint={netBasisHint} />}
                                        value={totalIncome}
                                        currency={currency}
                                        color={semantic.positive}
                                        prefix={<ArrowUpOutlined />}
                                        footer={
                                            <Suspense fallback={<div style={{ height: SPARKLINE_HEIGHT + SPACING.xs }} />}>
                                                <Sparkline values={incomeSparkline} color={semantic.positive} />
                                            </Suspense>
                                        }
                                    />
                                </Col>
                                <Col {...statCols}>
                                    <StatCard
                                        title={<NetBasisTitle title={t('dashboard.totalExpenses')} hint={netBasisHint} />}
                                        value={totalExpenses}
                                        currency={currency}
                                        color={semantic.negative}
                                        prefix={<ArrowDownOutlined />}
                                        footer={
                                            <>
                                                {expenseComparison && isCurrentMonthRange && (
                                                    <div style={{ marginTop: SPACING.xs, fontSize: FONT_SIZE.sm }}>
                                                        <Text type={expenseComparison.percentageChange > 0 ? 'danger' : expenseComparison.percentageChange < 0 ? 'success' : 'secondary'}>
                                                            {formatPercent(expenseComparison.percentageChange, 2, true)}
                                                        </Text>
                                                        <Text type="secondary"> {t('dashboard.thisMonthVsPrevious')}</Text>
                                                    </div>
                                                )}
                                                <Suspense fallback={<div style={{ height: SPARKLINE_HEIGHT + SPACING.xs }} />}>
                                                    <Sparkline values={expenseSparkline} color={semantic.negative} />
                                                </Suspense>
                                        </>
                                    }
                                />
                            </Col>
                            </>
                        )}
                        {showCrypto && (
                            <Col {...statCols}>
                                <StatCard
                                    title={t('dashboard.cryptoPortfolio')}
                                    value={portfolioValue.totalValue}
                                    currency={portfolioValue.currency}
                                    color={token.colorPrimary}
                                />
                            </Col>
                        )}
                    </Row>

                    {/* Bento: analytics a sinistra, budget + proiezione + confronto a destra.
                        Su mobile la colonna destra viene prima (order): budget e proiezione
                        rispondono a "come sto andando questo mese?" e stavano sotto due grafici. */}
                    <Row gutter={[16, 16]} style={{ marginTop: SPACING.md }}>
                        <Col xs={{ span: 24, order: 2 }} lg={{ span: 15, order: 1 }}>
                            <Flex vertical gap={16}>
                                <Card title={<NetBasisTitle title={t('reports.categoryBreakdown')} hint={netBasisHint} />}>
                                    {breakdownFailed ? (
                                        <InlineError onRetry={retryDashboard} />
                                    ) : (
                                        <Tabs
                                            items={[
                                                {
                                                    key: 'OUT',
                                                    label: t('reports.typeOut'),
                                                    children: renderBreakdown(expensesByCategory, expenseBreakdown),
                                                },
                                                {
                                                    key: 'IN',
                                                    label: t('reports.typeIn'),
                                                    children: renderBreakdown(incomeByCategory, incomeBreakdown),
                                                },
                                            ]}
                                        />
                                    )}
                                </Card>

                                <Card
                                    title={<NetBasisTitle title={t('dashboard.monthlyTrend')} hint={netBasisHint} />}
                                    {...(!isMobile && {
                                        extra: (
                                            <Flex gap="small" align="center">
                                                <Text type="secondary">{t('reports.trendMonths')}:</Text>
                                                <Select
                                                    value={trendMonths}
                                                    onChange={setTrendMonths}
                                                    size="small"
                                                    style={{ width: 110 }}
                                                    options={[
                                                        { value: 6, label: t('reports.months6') },
                                                        { value: 12, label: t('reports.months12') },
                                                        { value: 24, label: t('reports.months24') },
                                                    ]}
                                                    getPopupContainer={trigger => trigger.parentElement ?? document.body}
                                                />
                                            </Flex>
                                        )
                                    })}
                                >
                                    {isMobile && (
                                        <Flex justify="flex-end" gap={6} style={{ marginBottom: SPACING.xs }}>
                                            {[6, 12, 24].map(m => (
                                                <Button
                                                    key={m}
                                                    size="small"
                                                    type={trendMonths === m ? 'primary' : 'default'}
                                                    onClick={() => setTrendMonths(m)}
                                                >
                                                    {t(`reports.months${m}`)}
                                                </Button>
                                            ))}
                                        </Flex>
                                    )}
                                    {trendFailed ? (
                                        <InlineError onRetry={retryDashboard} />
                                    ) : (
                                        <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
                                            <TrendDualChart points={trendPoints} />
                                        </Suspense>
                                    )}
                                </Card>
                            </Flex>
                        </Col>

                        <Col xs={{ span: 24, order: 1 }} lg={{ span: 9, order: 2 }}>
                            <Flex vertical gap={16}>
                                {budgetsFailed ? (
                                    <Card title={t('dashboard.budgetSummary.title')}>
                                        <InlineError onRetry={retryDashboard} />
                                    </Card>
                                ) : budgetSummary.length > 0 && (
                                    <Card title={t('dashboard.budgetSummary.title')}>
                                        <Row gutter={[16, 16]}>
                                            {budgetSummary.map(renderBudgetSummaryItem)}
                                        </Row>
                                    </Card>
                                )}

                                {projectionFailed ? (
                                    <Card title={<NetBasisTitle title={t('dashboard.projection')} hint={netBasisHint} />}>
                                        <InlineError onRetry={retryDashboard} />
                                    </Card>
                                ) : projection && (
                                    <Card title={<NetBasisTitle title={t('dashboard.projection')} hint={netBasisHint} />}>
                                        {/* Nella colonna destra (9/24) fra lg e xl tre importi affiancati non ci stanno:
                                            il simbolo € andava a capo. Due per riga finché non c'è spazio. */}
                                        <Row gutter={[16, 8]} align="middle">
                                            <Col xs={12} sm={8} lg={12} xxl={8}>
                                                <Statistic title={t('reports.projectedIncome')} value={projection.projectedMonthlyIncome} formatter={moneyFormatter} styles={{ content: { color: semantic.positive, fontSize: FONT_SIZE.xl } }} />
                                            </Col>
                                            <Col xs={12} sm={8} lg={12} xxl={8}>
                                                <Statistic title={t('reports.projectedExpense')} value={projection.projectedMonthlyExpense} formatter={moneyFormatter} styles={{ content: { color: semantic.negative, fontSize: FONT_SIZE.xl } }} />
                                            </Col>
                                            <Col xs={12} sm={8} lg={12} xxl={8}>
                                                <Statistic
                                                    title={t('reports.projectedSavings')}
                                                    value={projection.projectedMonthlySavings}
                                                    formatter={moneyFormatter}
                                                    styles={{ content: { color: projection.projectedMonthlySavings >= 0 ? semantic.positive : semantic.negative, fontSize: FONT_SIZE.xl } }}
                                                />
                                            </Col>
                                            <Col xs={24}>
                                                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                                                    {t('dashboard.projectionDay', { elapsed: projection.daysElapsed, total: projection.daysInMonth })}
                                                </Text>
                                                <Progress aria-label={t('dashboard.projectionDay', { elapsed: projection.daysElapsed, total: projection.daysInMonth })} percent={Math.round((projection.daysElapsed / projection.daysInMonth) * 100)} size="small" />
                                            </Col>
                                        </Row>
                                    </Card>
                                )}

                                <Card
                                    title={<NetBasisTitle title={t('reports.comparison')} hint={netBasisHint} />}
                                    extra={
                                        <SafeDatePicker
                                            picker="month"
                                            value={comparisonMonth}
                                            onChange={m => { if (m) setComparisonMonth(m); }}
                                            getPopupContainer={trigger => trigger.parentElement ?? document.body}
                                            size="small"
                                        />
                                    }
                                >
                                    {loadingComparison ? (
                                        <Skeleton active paragraph={{ rows: 2 }} />
                                    ) : comparisonFailed ? (
                                        <InlineError onRetry={() => { void refetchComparison(); }} />
                                    ) : customComparison ? (
                                        <Suspense fallback={<Skeleton active paragraph={{ rows: 2 }} />}>
                                            <ComparisonBars
                                                currentLabel={comparisonMonth.format('MMM YYYY')}
                                                previousLabel={comparisonMonth.subtract(1, 'month').format('MMM YYYY')}
                                                currentIncome={customComparison.currentMonth?.income ?? 0}
                                                previousIncome={customComparison.previousMonth?.income ?? 0}
                                                currentExpense={customComparison.currentMonth?.expense ?? 0}
                                                previousExpense={customComparison.previousMonth?.expense ?? 0}
                                            />
                                        </Suspense>
                                    ) : (
                                        <EmptyState description={t('charts.noData')} />
                                    )}
                                </Card>
                            </Flex>
                        </Col>
                    </Row>

                    {/* Analisi AI: dopo i dati, non sopra. È una card su richiesta (vuota finché
                        l'utente non avvia un'analisi) e su mobile spingeva budget e proiezione
                        sotto la piega. */}
                    <Row gutter={[16, 16]} style={{ marginTop: SPACING.md }}>
                        <Col xs={24}>
                            <Suspense fallback={<Skeleton active paragraph={{ rows: 2 }} />}>
                                <AiAnalysisCard />
                            </Suspense>
                        </Col>
                    </Row>

                    {/* Andamento saldo netto cumulato */}
                    <Row gutter={[16, 16]} style={{ marginTop: SPACING.md }}>
                        <Col xs={24}>
                            <BalanceTrendSection showTable={false} />
                        </Col>
                    </Row>
                </div>
            )}
        </>
    );
};
