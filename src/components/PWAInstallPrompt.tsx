// src/components/PWAInstallPrompt.tsx
import {useEffect, useState} from 'react';
import {Button, Card, Flex, Typography} from 'antd';
import {CloseOutlined, DownloadOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import { FONT_SIZE, SHADOW, SPACING, aboveBottomNav } from '../theme/tokens';
import { useBreakpoints } from '../hooks/useBreakpoints';

const DISMISSED_KEY = 'pwa-install-dismissed';

const isDismissed = () => {
    try { return !!localStorage.getItem(DISMISSED_KEY); } catch { return false; }
};
const rememberDismissed = () => {
    try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* storage non disponibile */ }
};

const { Text } = Typography;

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt = () => {
    const { t } = useTranslation();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const { isSmallMobile } = useBreakpoints();

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);

            // Non riproporlo a chi l'ha già chiuso (dalla card o dal dialog del browser).
            if (!isDismissed()) {
                setShowPrompt(true);
            }
        };
        // Installata da un'altra via (menu del browser): la card non serve più.
        const onInstalled = () => {
            setDeferredPrompt(null);
            setShowPrompt(false);
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', onInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        // Rifiutato dal dialog del browser: come la X della card, non va riproposto a
        // ogni caricamento.
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'dismissed') rememberDismissed();

        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        rememberDismissed();
    };

    if (!showPrompt) return null;

    return (
        <Card
            style={{
                position: 'fixed',
                // Su mobile resta sopra la bottom nav invece di coprirla.
                bottom: isSmallMobile ? aboveBottomNav(SPACING.md) : SPACING.md,
                left: 16,
                right: 16,
                maxWidth: 400,
                margin: '0 auto',
                zIndex: 1000,
                boxShadow: SHADOW.floating,
            }}
            styles={{ body: { padding: SPACING.md } }}
        >
            <Flex justify="space-between" align="center" gap="middle">
                <Flex vertical gap="small" style={{ flex: 1 }}>
                    <Text strong>{t('pwa.title')}</Text>
                    <Text type="secondary" style={{ fontSize: `${FONT_SIZE.sm}px` }}>
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
                        aria-label={t('common.close')}
                    />
                </Flex>
            </Flex>
        </Card>
    );
};
