import { useState } from 'react';
import { Alert, Button, Card, Space, Steps, Typography } from 'antd';
import {
    BankOutlined,
    CloseOutlined,
    ContainerOutlined,
    TransactionOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const STORAGE_KEY = 'onboarding_dismissed';

interface OnboardingChecklistProps {
    hasAccounts: boolean;
    hasTransactions: boolean;
    hasBudgets: boolean;
    onCreateAccount: () => void;
    onAddTransaction: () => void;
    onCreateBudget: () => void;
}

/**
 * Checklist di onboarding mostrata ai nuovi utenti finché non hanno
 * completato i passi fondamentali o non la scartano manualmente.
 * Il dismiss viene persistito in localStorage.
 */
export const OnboardingChecklist = ({
    hasAccounts,
    hasTransactions,
    hasBudgets,
    onCreateAccount,
    onAddTransaction,
    onCreateBudget,
}: OnboardingChecklistProps) => {
    const { t } = useTranslation();

    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(STORAGE_KEY) === 'true'
    );

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setDismissed(true);
    };

    // Non mostrare se tutto è completato o se l'utente ha scartato
    const allDone = hasAccounts && hasTransactions && hasBudgets;
    if (dismissed || allDone) return null;

    const currentStep = hasAccounts ? (hasTransactions ? 2 : 1) : 0;

    const steps = [
        {
            title: t('onboarding.step1Title'),
            description: t('onboarding.step1Desc'),
            icon: <BankOutlined />,
            action: onCreateAccount,
            actionLabel: t('onboarding.step1Cta'),
            done: hasAccounts,
        },
        {
            title: t('onboarding.step2Title'),
            description: t('onboarding.step2Desc'),
            icon: <TransactionOutlined />,
            action: onAddTransaction,
            actionLabel: t('onboarding.step2Cta'),
            done: hasTransactions,
            disabled: !hasAccounts,
            disabledHint: t('onboarding.needAccountFirst'),
        },
        {
            title: t('onboarding.step3Title'),
            description: t('onboarding.step3Desc'),
            icon: <ContainerOutlined />,
            action: onCreateBudget,
            actionLabel: t('onboarding.step3Cta'),
            done: hasBudgets,
        },
    ];

    const currentStepData = steps[currentStep];

    return (
        <Card
            style={{ marginBottom: 24, borderStyle: 'dashed' }}
            styles={{ body: { padding: '16px 20px' } }}
            extra={
                <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={handleDismiss}
                    aria-label={t('onboarding.dismiss')}
                />
            }
            title={t('onboarding.title')}
        >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                {t('onboarding.subtitle')}
            </Text>
            <Steps
                current={currentStep}
                size="small"
                style={{ marginBottom: 16 }}
                items={steps.map(s => ({
                    title: s.title,
                    status: s.done ? 'finish' : undefined,
                    icon: s.icon,
                }))}
            />
            {currentStepData && !currentStepData.done && (
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>{currentStepData.description}</Text>
                    {currentStepData.disabled && currentStepData.disabledHint && (
                        <Alert type="info" message={currentStepData.disabledHint} showIcon style={{ padding: '4px 12px' }} />
                    )}
                    <Button
                        type="primary"
                        icon={currentStepData.icon}
                        onClick={currentStepData.action}
                        disabled={currentStepData.disabled}
                        size="small"
                    >
                        {currentStepData.actionLabel}
                    </Button>
                </Space>
            )}
        </Card>
    );
};
