import { useMemo } from 'react';
import { Col, Row, Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { InlineError } from '../common/InlineError';
import { StatCard } from '../common/StatCard';
import { useInvestmentPerformance } from '../../hooks/useInvestments';
import { usePreferences } from '../../contexts/PreferencesContext';
import { FONT_SIZE, SPACING, getSemanticColors } from '../../theme/tokens';
import { formatDate, formatMoneyOrNA } from '../../utils/format';
import { periodRange, plColor } from '../../utils/investments';

const { Text } = Typography;

/**
 * Riquadro performance sugli ultimi `months` mesi (fine = oggi, mai nel futuro). Tutti i
 * valori possono essere null: "n/d", mai 0.
 */
export const PerformanceSection = ({ months }: { months: number }) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');
    const { startDate, endDate } = useMemo(() => periodRange(months), [months]);
    const { data, isPending, isError, refetch } = useInvestmentPerformance(startDate, endDate);

    if (isPending) return <Skeleton active paragraph={{ rows: 3 }} />;
    if (!data) {
        return isError
            ? <InlineError message={t('investments.performance.loadError')} onRetry={() => { void refetch(); }} />
            : null;
    }

    const c = data.currency;
    const money = (label: string, value: number | null) => (
        <Col xs={12} md={8} lg={6}>
            <StatCard size="small" title={label} value={value ?? undefined}
                      formatter={() => formatMoneyOrNA(value, c)} />
        </Col>
    );
    const pl = (label: string, value: number | null) => (
        <Col xs={12} md={8} lg={6}>
            <StatCard size="small" title={label} value={value ?? undefined}
                      color={plColor(value, semantic)}
                      formatter={() => formatMoneyOrNA(value, c, { signed: true })} />
        </Col>
    );

    return (
        <>
            <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
                {t('investments.performance.range', { start: formatDate(data.startDate), end: formatDate(data.endDate) })}
            </Text>
            <Row gutter={[SPACING.sm, SPACING.sm]} style={{ marginTop: SPACING.xs }}>
                {money(t('investments.performance.startValue'), data.startValue)}
                {money(t('investments.performance.endValue'), data.endValue)}
                {money(t('investments.performance.invested'), data.invested)}
                {money(t('investments.performance.divested'), data.divested)}
                {pl(t('investments.performance.realizedPl'), data.realizedPl)}
                {money(t('investments.performance.income'), data.income)}
                {pl(t('investments.performance.totalGain'), data.totalGain)}
            </Row>
        </>
    );
};
