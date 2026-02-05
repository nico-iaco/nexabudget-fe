// src/components/PWAInstallPrompt.tsx
import {useEffect, useState} from 'react';
import {Button, Card, Flex, Typography} from 'antd';
import {CloseOutlined, DownloadOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

const { Text } = Typography;

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt = () => {
    const { t } = useTranslation();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);

            // Check if user has dismissed the prompt before
            const dismissed = localStorage.getItem('pwa-install-dismissed');
            if (!dismissed) {
                setShowPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        }

        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <Card
            style={{
                position: 'fixed',
                bottom: 16,
                left: 16,
                right: 16,
                maxWidth: 400,
                margin: '0 auto',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            styles={{ body: { padding: 16 } }}
        >
            <Flex justify="space-between" align="center" gap="middle">
                <Flex vertical gap="small" style={{ flex: 1 }}>
                    <Text strong>{t('pwa.title')}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('pwa.description')}
                    </Text>
                </Flex>
                <Flex gap="small">
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleInstall}
                        size="small"
                    >
                        {t('pwa.install')}
                    </Button>
                    <Button
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={handleDismiss}
                        size="small"
                    />
                </Flex>
            </Flex>
        </Card>
    );
};
