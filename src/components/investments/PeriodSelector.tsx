import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { PERIOD_MONTHS, type PeriodMonths } from '../../utils/investments';

interface Props {
    value: PeriodMonths;
    onChange: (months: PeriodMonths) => void;
    disabled?: boolean;
}

/** Selettore 6/12/24 mesi condiviso da storico portafoglio, performance e patrimonio. */
export const PeriodSelector = ({ value, onChange, disabled }: Props) => {
    const { t } = useTranslation();
    return (
        <Segmented<PeriodMonths>
            value={value}
            onChange={onChange}
            disabled={disabled}
            options={PERIOD_MONTHS.map(m => ({ value: m, label: t(`reports.months${m}`) }))}
        />
    );
};
