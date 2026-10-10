import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Flex, Row, Skeleton, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InlineError } from '../common/InlineError';
import { EmptyState } from '../common/EmptyState';
import { StatCard } from '../common/StatCard';
import { AllocationBar } from './AllocationBar';
import { PeriodSelector } from './PeriodSelector';
import { SeriesLineChart, type LineChartPoint, type LineSeries } from './SeriesLineChart';
import { useNetWorth, useNetWorthHistory } from '../../hooks/useInvestments';
import { usePreferences } from '../../contexts/PreferencesContext';
import {
    CHART_CATEGORICAL, FONT_SIZE, GRADIENT_BALANCE, GRADIENT_BALANCE_DARK, SPACING,
} from '../../theme/tokens';
import { formatDate, formatMoney, formatMoneyOrNA } from '../../utils/format';
import {
    firstAvailableDate, hasLeadingGap, netWorthComponents, type PeriodMonths,
} from '../../utils/investments';

const { Text } = Typography;

const NetWorthTrend = () => {
    const { t } = useTranslation();
    const [months, setMonths] = useState<PeriodMonths>(12);
    const { data, isPending, isError, refetch } = useNetWorthHistory(months);

    const series: LineSeries[] = useMemo(() => [
        { key: 'total', label: t('netWorth.trend.total'), color: CHART_CATEGORICAL[0], width: 3 },
        { key: 'liquidity', label: t('netWorth.liquidity'), color: CHART_CATEGORICAL[5], width: 1.5 },
        { key: 'crypto', label: t('netWorth.crypto'), color: CHART_CATEGORICAL[2], width: 1.5 },
        { key: 'investments', label: t('netWorth.investments'), color: CHART_CATEGORICAL[3], width: 1.5 },
    ], [t]);

    const points: LineChartPoint[] = useMemo(
        () => (data?.points ?? []).map(p => ({
            date: p.date,
            values: { total: p.total, liquidity: p.liquidity, crypto: p.crypto, investments: p.investments },
        })),
        [data],
    );

    const raw = data?.points;
    // Crypto e investimenti sono null prima del primo snapshot (nel totale contano come 0):
    // si dice da quando c'è lo storico invece di far sembrare un crollo il tratto iniziale.
    const gapFrom = hasLeadingGap(raw, 'investments') || hasLeadingGap(raw, 'crypto')
        ? [firstAvailableDate(raw, 'investments'), firstAvailableDate(raw, 'crypto')]
            .filter((d): d is string => d !== null)
            .sort()[0] ?? null
        : null;

    return (
        <div>
            <Flex justify="space-between" align="center" wrap gap={SPACING.sm} style={{ marginBottom: SPACING.sm }}>
                <Text strong>{t('netWorth.trend.title')}</Text>
                <PeriodSelector value={months} onChange={setMonths} />
            </Flex>

            {isPending && <Skeleton active paragraph={{ rows: 6 }} />}
            {!isPending && !data && isError && (
                <InlineError message={t('netWorth.trend.loadError')} onRetry={() => { void refetch(); }} />
            )}
            {data && (
                <>
                    {points.length === 0 ? (
                        <EmptyState description={t('netWorth.trend.empty')} style={{ marginTop: SPACING.md }} />
                    ) : (
                        <SeriesLineChart
                            points={points}
                            series={series}
                            currency={data.currency}
                            ariaLabel={t('netWorth.trend.title')}
                        />
                    )}
                    <Flex vertical gap={4} style={{ marginTop: SPACING.xs }}>
                        {points.length === 1 && (
                            <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>{t('netWorth.trend.singlePoint')}</Text>
                        )}
                        {gapFrom && (
                            <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                                {t('netWorth.trend.availableFrom', { date: formatDate(gapFrom) })}
                            </Text>
                        )}
                        {!data.cryptoIncludedInHistory && (
                            <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>{t('netWorth.trend.noCrypto')}</Text>
                        )}
                    </Flex>
                </>
            )}
        </div>
    );
};

/** Card della dashboard: totale, ripartizione, avvisi e andamento del patrimonio netto. */
export const NetWorthCard = () => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const { data, isPending, isError, refetch } = useNetWorth();
    const gradient = preferences.theme === 'dark' ? GRADIENT_BALANCE_DARK : GRADIENT_BALANCE;

    const rows = data
        ? netWorthComponents(data).map(c => ({ ...c, label: t(`netWorth.${c.key}`) }))
        : [];

    return (
        <Card
            title={t('netWorth.title')}
            extra={<Link to="/investments"><Button type="link" size="small">{t('netWorth.viewInvestments')}</Button></Link>}
        >
            {isPending && <Skeleton active paragraph={{ rows: 4 }} />}

            {!isPending && !data && isError && (
                <InlineError message={t('netWorth.loadError')} onRetry={() => { void refetch(); }} />
            )}

            {data && (
                <Flex vertical gap={SPACING.md}>
                    {!data.complete && (
                        <Alert
                            type="warning"
                            showIcon
                            title={t('netWorth.partial')}
                            description={data.warnings.length > 0 && (
                                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                                    {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            )}
                        />
                    )}
                    {data.possibleDoubleCounting && (
                        <Alert
                            type="warning"
                            showIcon
                            title={t('netWorth.doubleCounting')}
                            description={data.investmentAccountsBalance !== null && t('netWorth.investmentAccountsBalance', {
                                amount: formatMoney(data.investmentAccountsBalance, data.currency),
                            })}
                        />
                    )}

                    <Row gutter={[SPACING.md, SPACING.md]} align="middle">
                        <Col xs={24} md={10}>
                            <StatCard
                                variant="borderless"
                                gradient={gradient}
                                title={<Flex gap={8} align="center" wrap>
                                    {t('netWorth.total')}
                                    {!data.complete && <Tag color="warning" style={{ margin: 0 }}>{t('netWorth.partialTag')}</Tag>}
                                </Flex>}
                                value={data.total ?? undefined}
                                // Il formatter ignora l'argomento: con total null deve uscire "n/d", non "–".
                                formatter={() => formatMoneyOrNA(data.total, data.currency)}
                            />
                        </Col>
                        <Col xs={24} md={14}>
                            <AllocationBar rows={rows} currency={data.currency} aria-label={t('netWorth.breakdown')} />
                        </Col>
                    </Row>

                    <NetWorthTrend />
                </Flex>
            )}
        </Card>
    );
};
