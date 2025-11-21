import { Button, Flex, Form, Modal, Select, Spin, Steps } from 'antd';
import { europeanCountries } from '../../utils/countries';
import type { Account, GoCardlessBank } from '../../types/api';

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
    return (
        <Modal
            title={`Collega "${account?.name}" a GoCardless`}
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="back" onClick={onCancel}>Annulla</Button>,
                <Button
                    key="submit"
                    type="primary"
                    onClick={onConfirm}
                    disabled={!selectedBank}
                >
                    Collega Banca
                </Button>,
            ]}
            width={700}
        >
            <Steps
                current={currentStep}
                style={{ marginBottom: 24 }}
                items={[
                    { title: 'Seleziona Nazione' },
                    { title: 'Seleziona Banca' },
                ]}
            />

            {currentStep === 0 && (
                <Form layout="vertical">
                    <Form.Item label="Seleziona la tua nazione">
                        <Select
                            showSearch
                            placeholder="Seleziona una nazione"
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
                    <Form.Item label="Seleziona la tua banca">
                        {loadingBanks ? (
                            <Spin />
                        ) : (
                            <Select
                                showSearch
                                placeholder="Seleziona una banca"
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
