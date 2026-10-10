import { Flex, Tag, Tooltip, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../contexts/PreferencesContext';
import { FONT_SIZE, getSemanticColors } from '../../theme/tokens';
import { formatDate, formatMoneyOrNA, formatPercentOrNA } from '../../utils/format';
import { formatAssetPrice, isStalePosition, plColor } from '../../utils/investments';
import type { InvestmentPosition } from '../../types/api';

const { Text } = Typography;

/** P/L con importo e percentuale: verde se positivo, rosso se negativo, "n/d" se null. */
export const PlText = ({ value, percent, currency, align = 'right' }: {
    value: number | null | undefined;
    percent?: number | null;
    currency: string;
    align?: 'left' | 'right';
}) => {
    const { preferences } = usePreferences();
    const color = plColor(value, getSemanticColors(preferences.theme === 'dark'));
    return (
        <Flex vertical align={align === 'right' ? 'flex-end' : 'flex-start'}>
            <Text style={{ color }}>{formatMoneyOrNA(value, currency, { signed: true })}</Text>
            {percent !== undefined && (
                <Text style={{ color, fontSize: FONT_SIZE.sm }}>{formatPercentOrNA(percent, 2, true)}</Text>
            )}
        </Flex>
    );
};

/** Badge «Prezzo non aggiornato» con la data dell'ultimo prezzo noto. */
export const StaleBadge = ({ position }: { position: Pick<InvestmentPosition, 'stale' | 'priceAsOf'> }) => {
    const { t } = useTranslation();
    if (!isStalePosition(position)) return null;
    const hint = position.priceAsOf
        ? t('investments.staleHint', { date: formatDate(position.priceAsOf) })
        : t('investments.staleHintNoDate');
    return (
        <Tooltip title={hint}>
            <Tag color="warning" icon={<WarningOutlined />} style={{ margin: 0 }}>
                {t('investments.staleBadge')}
                {position.priceAsOf ? ` · ${formatDate(position.priceAsOf)}` : ''}
            </Tag>
        </Tooltip>
    );
};

/** Prezzo attuale (null → "n/d"; BOND → %) con badge stale e, se manuale, l'etichetta. */
export const PriceCell = ({ position, align = 'right' }: { position: InvestmentPosition; align?: 'left' | 'right' }) => {
    const { t } = useTranslation();
    return (
        <Flex vertical gap={2} align={align === 'right' ? 'flex-end' : 'flex-start'}>
            <Text>{formatAssetPrice(position.price, position.assetType, position.priceCurrency ?? position.currency)}</Text>
            <StaleBadge position={position} />
            {position.priceSource === 'MANUAL' && !isStalePosition(position) && (
                <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>
                    {position.priceAsOf
                        ? t('investments.priceAsOf', { date: formatDate(position.priceAsOf) })
                        : t('investments.manualBadge')}
                </Text>
            )}
        </Flex>
    );
};
