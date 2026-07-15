// src/components/banking/BankAccountPicker.tsx
// UI condivisa di selezione conto bancario + inserimento saldo corrente,
// usata sia dalla callback GoCardless che da quella Enable Banking.
import {Alert, Flex, Form, InputNumber, List, theme, Typography} from 'antd';
import {BankOutlined} from '@ant-design/icons';
import {FONT_SIZE, RADIUS, SPACING} from '../../theme/tokens';
import {getCurrencySymbol} from '../../utils/currency';

const { Text } = Typography;

export interface BankAccountPickerItem {
    id: string;
    institutionName: string;
    accountName?: string;
    logo?: string;
}

interface BankAccountPickerProps {
    items: BankAccountPickerItem[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    currentBalance: number | null;
    onBalanceChange: (value: number | null) => void;
    currency: string;
    bankUnknownLabel: string;
    accountNameLabel: string;
    balanceWarningTitle: string;
    balanceWarningDescription: string;
    currentBalanceLabel: string;
    currentBalanceHelp: string;
    currentBalancePlaceholder: string;
}

export const BankAccountPicker = ({
    items,
    selectedId,
    onSelect,
    currentBalance,
    onBalanceChange,
    currency,
    bankUnknownLabel,
    accountNameLabel,
    balanceWarningTitle,
    balanceWarningDescription,
    currentBalanceLabel,
    currentBalanceHelp,
    currentBalancePlaceholder,
}: BankAccountPickerProps) => {
    const { token } = theme.useToken();

    return (
        <>
            <List
                dataSource={items}
                renderItem={(item) => (
                    <List.Item
                        onClick={() => onSelect(item.id)}
                        style={{
                            cursor: 'pointer',
                            padding: SPACING.md,
                            border: selectedId === item.id
                                ? `2px solid ${token.colorPrimary}`
                                : `1px solid ${token.colorBorder}`,
                            borderRadius: RADIUS.lg,
                            marginBottom: SPACING.sm,
                            backgroundColor: selectedId === item.id
                                ? token.controlItemBgActive
                                : token.colorBgContainer,
                            transition: 'all 0.3s'
                        }}
                    >
                        <Flex gap="middle" align="center" style={{width: '100%'}}>
                            {item.logo && (
                                <img
                                    src={item.logo}
                                    alt={item.institutionName}
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        objectFit: 'contain',
                                        borderRadius: RADIUS.lg
                                    }}
                                />
                            )}
                            <Flex vertical gap="small" style={{flex: 1}}>
                                <Text strong style={{fontSize: FONT_SIZE.xl}}>
                                    {item.institutionName || bankUnknownLabel}
                                </Text>
                                {item.accountName && (
                                    <Text type="secondary">
                                        {accountNameLabel}: {item.accountName}
                                    </Text>
                                )}
                            </Flex>
                            <BankOutlined style={{fontSize: FONT_SIZE.display, color: token.colorPrimary}}/>
                        </Flex>
                    </List.Item>
                )}
            />

            {selectedId && (
                <>
                    <Alert
                        message={balanceWarningTitle}
                        description={balanceWarningDescription}
                        type="warning"
                        showIcon
                        style={{marginTop: SPACING.lg, marginBottom: SPACING.md}}
                    />
                    <Form.Item
                        label={currentBalanceLabel}
                        help={currentBalanceHelp}
                    >
                        <InputNumber
                            style={{width: '100%'}}
                            value={currentBalance}
                            onChange={(value) => onBalanceChange(value)}
                            placeholder={currentBalancePlaceholder}
                            addonAfter={getCurrencySymbol(currency)}
                            precision={2}
                            parser={(value) => value?.replace(',', '.') as unknown as number}
                        />
                    </Form.Item>
                </>
            )}
        </>
    );
};
