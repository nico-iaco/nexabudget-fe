import { useMemo } from 'react';
import { Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { InlineError } from '../common/InlineError';
import { EmptyState } from '../common/EmptyState';
import { SeriesLineChart, type LineChartPoint, type LineSeries } from './SeriesLineChart';
import { useInvestmentHistory } from '../../hooks/useInvestments';
import { CHART_CATEGORICAL, FONT_SIZE, SPACING } from '../../theme/tokens';
import { formatDate } from '../../utils/format';
import { firstAvailableDate, hasLeadingGap } from '../../utils/investments';

/** Storico del portafoglio (valore di mercato e costo) sugli ultimi `months` mesi. */
export const PortfolioHistorySection = ({ months }: { months: number }) => {
    const { t } = useTranslation();
    const { data, isPending, isError, refetch } = useInvestmentHistory(months);

    const series: LineSeries[] = useMemo(() => [
        { key: 'marketValue', label: t('investments.history.marketValue'), color: CHART_CATEGORICAL[0], width: 3 },
        { key: 'costBasis', label: t('investments.history.costBasis'), color: CHART_CATEGORICAL[2], width: 2 },
    ], [t]);

    const points: LineChartPoint[] = useMemo(
        () => (data?.points ?? []).map(p => ({ date: p.date, values: { marketValue: p.marketValue, costBasis: p.costBasis } })),
        [data],
    );

    if (isPending) return <Skeleton active paragraph={{ rows: 6 }} />;
    if (!data) {
        return isError
            ? <InlineError message={t('investments.history.loadError')} onRetry={() => { void refetch(); }} />
            : null;
    }
    // Gli snapshot partono dal giorno di attivazione, senza backfill: lista vuota possibile.
    if (points.length === 0) {
        return <EmptyState description={t('investments.history.empty')} style={{ marginTop: SPACING.md }} />;
    }
    // Prima del primo snapshot i valori sono null (non zero): la linea parte dopo.
    const from = hasLeadingGap(data.points, 'marketValue') ? firstAvailableDate(data.points, 'marketValue') : null;
    return (
        <>
            <SeriesLineChart
                points={points}
                series={series}
                currency={data.currency}
                ariaLabel={t('investments.history.title')}
            />
            {from && (
                <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                    {t('investments.history.availableFrom', { date: formatDate(from) })}
                </Typography.Text>
            )}
        </>
    );
};
