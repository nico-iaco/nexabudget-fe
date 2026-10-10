import {Button, Flex, Form, Modal, Spin, Steps} from 'antd';
import {getEuropeanCountries} from '../../utils/countries';
import {SafeSelect} from '../common/SafeSelect';
import type {Account, BankInstitutionDto, BankProvider} from '../../types/api';
import {useTranslation} from 'react-i18next';
import {SPACING} from '../../theme/tokens';

// SafeSelect come negli altri modali: il popup di AntD Select è mal posizionato nella PWA iOS.
const { Option } = SafeSelect;

interface BankLinkModalProps {
    open: boolean;
    onCancel: () => void;
    /** Assente quando non si può tornare indietro (primo step raggiungibile). */
    onBack?: () => void;
    account: Account | null;
    currentStep: number;
    selectedProvider: BankProvider | null;
    selectedCountry: string | null;
    banks: BankInstitutionDto[];
    loadingBanks: boolean;
    selectedBank: string | null;
    linking: boolean;
    onProviderSelect: (provider: BankProvider) => void;
    onCountrySelect: (countryCode: string) => void;
    onBankSelect: (bankId: string) => void;
    onConfirm: () => void;
}

export const BankLinkModal = ({
    open,
    onCancel,
    onBack,
    account,
    currentStep,
    selectedProvider,
    selectedCountry,
    banks,
    loadingBanks,
    selectedBank,
    linking,
    onProviderSelect,
    onCountrySelect,
    onBankSelect,
    onConfirm
}: BankLinkModalProps) => {
    const { t } = useTranslation();
    // Nomi dei paesi nella lingua corrente (il componente ri-renderizza al cambio lingua).
    const countries = getEuropeanCountries();
    return (
        <Modal
            title={t('bankLink.connectTitle', { name: account?.name ?? '' })}
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>{t('common.cancel')}</Button>,
                ...(onBack ? [<Button key="back" onClick={onBack}>{t('common.back')}</Button>] : []),
                <Button
                    key="submit"
                    type="primary"
                    onClick={onConfirm}
                    disabled={!selectedBank}
                    loading={linking}
                >
                    {t('bankLink.linkBank')}
                </Button>,
            ]}
            width={700}
        style={{ maxWidth: '95vw' }}
        >
            <Steps
                current={currentStep}
                style={{ marginBottom: SPACING.lg }}
                items={[
                    { title: t('bankLink.selectProvider') },
                    { title: t('bankLink.selectCountry') },
                    { title: t('bankLink.selectBank') },
                ]}
            />

            {currentStep === 0 && (
                <Form layout="vertical">
                    <Form.Item label={t('bankLink.selectYourProvider')}>
                        <SafeSelect
                            placeholder={t('bankLink.selectProviderPlaceholder')}
                            onChange={v => onProviderSelect(v as BankProvider)}
                            value={selectedProvider ?? undefined}
                        >
                            <Option key="gocardless" value="gocardless">{t('bankLink.providerGoCardless')}</Option>
                            <Option key="enable-banking" value="enable-banking">{t('bankLink.providerEnableBanking')}</Option>
                        </SafeSelect>
                    </Form.Item>
                </Form>
            )}

            {currentStep === 1 && (
                <Form layout="vertical">
                    <Form.Item label={t('bankLink.selectYourCountry')}>
                        <SafeSelect
                            showSearch
                            placeholder={t('bankLink.selectCountryPlaceholder')}
                            onChange={v => onCountrySelect(v as string)}
                            value={selectedCountry}
                            loading={loadingBanks}
                            filterOption={(input, option) =>
                                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {countries.map(country => (
                                <Option key={country.code} value={country.code} label={country.name}>
                                    {country.name}
                                </Option>
                            ))}
                        </SafeSelect>
                    </Form.Item>
                </Form>
            )}

            {currentStep === 2 && (
                <Form layout="vertical">
                    <Form.Item label={t('bankLink.selectYourBank')}>
                        {loadingBanks ? (
                            <Spin />
                        ) : (
                            <SafeSelect
                                showSearch
                                placeholder={t('bankLink.selectBankPlaceholder')}
                                onChange={v => onBankSelect(v as string)}
                                value={selectedBank}
                                filterOption={(input, option) =>
                                    (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            >
                                {banks.map(bank => (
                                    <Option key={bank.id} value={bank.id} label={bank.name}>
                                        <Flex align="center" gap="small">
                                            {bank.logo && (
                                                <img
                                                    src={bank.logo}
                                                    alt={bank.name}
                                                    style={{ width: 24, height: 24, objectFit: 'contain' }}
                                                />
                                            )}
                                            <span>{bank.name}</span>
                                        </Flex>
                                    </Option>
                                ))}
                            </SafeSelect>
                        )}
                    </Form.Item>
                </Form>
            )}
        </Modal>
    );
};
