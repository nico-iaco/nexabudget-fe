import {Button, Flex, Form, Modal, Select, Spin, Steps} from 'antd';
import {europeanCountries} from '../../utils/countries';
import type {Account, BankInstitutionDto, BankProvider} from '../../types/api';
import {useTranslation} from 'react-i18next';
import {SPACING} from '../../theme/tokens';

const { Option } = Select;

interface BankLinkModalProps {
    open: boolean;
    onCancel: () => void;
    account: Account | null;
    currentStep: number;
    selectedProvider: BankProvider | null;
    selectedCountry: string | null;
    banks: BankInstitutionDto[];
    loadingBanks: boolean;
    selectedBank: string | null;
    onProviderSelect: (provider: BankProvider) => void;
    onCountrySelect: (countryCode: string) => void;
    onBankSelect: (bankId: string) => void;
    onConfirm: () => void;
}

export const BankLinkModal = ({
    open,
    onCancel,
    account,
    currentStep,
    selectedProvider,
    selectedCountry,
    banks,
    loadingBanks,
    selectedBank,
    onProviderSelect,
    onCountrySelect,
    onBankSelect,
    onConfirm
}: BankLinkModalProps) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={t('bankLink.connectTitle', { name: account?.name ?? '' })}
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="back" onClick={onCancel}>{t('common.cancel')}</Button>,
                <Button
                    key="submit"
                    type="primary"
                    onClick={onConfirm}
                    disabled={!selectedBank}
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
                        <Select
                            placeholder={t('bankLink.selectProviderPlaceholder')}
                            onChange={onProviderSelect}
                            value={selectedProvider ?? undefined}
                        >
                            <Option key="gocardless" value="gocardless">{t('bankLink.providerGoCardless')}</Option>
                            <Option key="enable-banking" value="enable-banking">{t('bankLink.providerEnableBanking')}</Option>
                        </Select>
                    </Form.Item>
                </Form>
            )}

            {currentStep === 1 && (
                <Form layout="vertical">
                    <Form.Item label={t('bankLink.selectYourCountry')}>
                        <Select
                            showSearch
                            placeholder={t('bankLink.selectCountryPlaceholder')}
                            onChange={onCountrySelect}
                            value={selectedCountry}
                            loading={loadingBanks}
                            filterOption={(input, option) =>
                                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {europeanCountries.map(country => (
                                <Option key={country.code} value={country.code} label={country.name}>
                                    {country.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            )}

            {currentStep === 2 && (
                <Form layout="vertical">
                    <Form.Item label={t('bankLink.selectYourBank')}>
                        {loadingBanks ? (
                            <Spin />
                        ) : (
                            <Select
                                showSearch
                                placeholder={t('bankLink.selectBankPlaceholder')}
                                onChange={onBankSelect}
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
                            </Select>
                        )}
                    </Form.Item>
                </Form>
            )}
        </Modal>
    );
};
