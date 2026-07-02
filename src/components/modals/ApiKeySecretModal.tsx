import { App, Modal, Typography, Button, Alert } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { SPACING, RADIUS, FONT_SIZE } from '../../theme/tokens';

const { Text, Paragraph } = Typography;

interface ApiKeySecretModalProps {
    open: boolean;
    onClose: () => void;
    plaintextKey: string;
}

export const ApiKeySecretModal = ({ open, onClose, plaintextKey }: ApiKeySecretModalProps) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(plaintextKey).then(() => {
            setCopied(true);
            message.success(t('settings.apiKeys.copiedSuccess'));
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <Modal
            title={t('settings.apiKeys.secretModalTitle')}
            open={open}
            onCancel={onClose}
            footer={[
                <Button key="close" type="primary" onClick={onClose}>
                    {t('settings.apiKeys.close')}
                </Button>
            ]}
            maskClosable={false}
            keyboard={false}
        >
            <Alert
                message={t('settings.apiKeys.secretWarningTitle')}
                description={t('settings.apiKeys.secretWarningDesc')}
                type="warning"
                showIcon
                style={{ marginBottom: SPACING.md }}
            />
            <div style={{ padding: `${SPACING.md}px`, background: 'var(--ant-color-bg-layout)', borderRadius: RADIUS.lg, textAlign: 'center' }}>
                <Paragraph style={{ marginBottom: SPACING.md }}>
                    <Text strong>{t('settings.apiKeys.yourKey')}:</Text>
                </Paragraph>
                <Paragraph
                    copyable={{
                        text: plaintextKey,
                        icon: copied ? <CheckOutlined style={{ color: 'var(--ant-color-success)' }} /> : <CopyOutlined />,
                        onCopy: handleCopy
                    }}
                    style={{
                        background: 'var(--ant-color-bg-container)',
                        padding: `${SPACING.sm}px`,
                        borderRadius: `${RADIUS.md}px`,
                        border: '1px solid var(--ant-color-border)',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        fontSize: `${FONT_SIZE.xl}px`
                    }}
                >
                    {plaintextKey}
                </Paragraph>
                <Button type="default" icon={<CopyOutlined />} onClick={handleCopy} block>
                    {t('settings.apiKeys.copy')}
                </Button>
            </div>
        </Modal>
    );
};
