import {Button, Flex, Form, Modal, Select, Spin, Steps} from 'antd';
import {europeanCountries} from '../../utils/countries';
import type {Account, GoCardlessBank} from '../../types/api';
import {useTranslation} from 'react-i18next';

const { Option } = Select;

interface GoCardlessModalProps {
    open: boolean;
    onCancel: () => void;
    account: Account | null;
    currentStep: number;
    selectedCountry: string | null;
    banks: GoCardlessBank[];
    loadingBanks: boolean;
    selectedBank: string | null;
    onCountrySelect: (countryCode: string) => void;
    onBankSelect: (bankId: string) => void;
    onConfirm: () => void;
}

export const GoCardlessModal = ({
    open,
    onCancel,
    account,
    currentStep,
    selectedCountry,
    banks,
    loadingBanks,
    selectedBank,
    onCountrySelect,
    onBankSelect,
    onConfirm
}: GoCardlessModalProps) => {
    const { t } = useTranslation();
    return (
        <Modal
            title={t('gocardless.connectTitle', { name: account?.name ?? '' })}
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
                    {t('gocardless.linkBank')}
                </Button>,
            ]}
            width={700}
        >
            <Steps
                current={currentStep}
                style={{ marginBottom: 24 }}
                items={[
                    { title: t('gocardless.selectCountry') },
                    { title: t('gocardless.selectBank') },
                ]}
            />

            {currentStep === 0 && (
                <Form layout="vertical">
                    <Form.Item label={t('gocardless.selectYourCountry')}>
                        <Select
                            showSearch
                            placeholder={t('gocardless.selectCountryPlaceholder')}
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

            {currentStep === 1 && (
                <Form layout="vertical">
                    <Form.Item label={t('gocardless.selectYourBank')}>
                        {loadingBanks ? (
                            <Spin />
                        ) : (
                            <Select
                                showSearch
                                placeholder={t('gocardless.selectBankPlaceholder')}
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
