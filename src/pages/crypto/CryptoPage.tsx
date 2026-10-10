import React, {useEffect, useState} from 'react';
import {App, Button, Dropdown, Flex, Space} from 'antd';
import type {MenuProps} from 'antd';
import {KeyOutlined, MoreOutlined, PlusOutlined, ReloadOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {deleteManualHolding, getPortfolioValue, syncFromBinance, syncFromCoinbase} from '../../services/api';
import {useBreakpoints} from '../../hooks/useBreakpoints';
import { usePageTitle } from '../../hooks/usePageTitle';
import type {CryptoAsset, PortfolioValueResponse} from '../../types/api';
import {PortfolioSummary} from '../../components/PortfolioSummary';
import {BinanceKeysModal} from '../../components/modals/BinanceKeysModal';
import {CoinbaseKeysModal} from '../../components/modals/CoinbaseKeysModal';
import {ManualHoldingModal} from '../../components/modals/ManualHoldingModal';
import {PageHeader} from '../../components/common/PageHeader';
import {InlineError} from '../../components/common/InlineError';
import {useDefaultCurrency} from '../../hooks/useDefaultCurrency';
import {useQueryClient} from '@tanstack/react-query';
import {invalidateDerivedData} from '../../queryKeys';

export const CryptoPage: React.FC = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    usePageTitle(t('crypto.title'));
    const currency = useDefaultCurrency();
    const queryClient = useQueryClient();
    const [portfolioData, setPortfolioData] = useState<PortfolioValueResponse | null>(null);
    // true dal primo render: il fetch parte nell'effetto, e con false la card del totale
    // mostrava per un frame un valore non ancora caricato.
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [syncingBinance, setSyncingBinance] = useState(false);
    const [syncingCoinbase, setSyncingCoinbase] = useState(false);
    const [showBinanceModal, setShowBinanceModal] = useState(false);
    const [showCoinbaseModal, setShowCoinbaseModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState<CryptoAsset | null>(null);

    const fetchPortfolio = async () => {
        setLoading(true);
        try {
            // Valori nella valuta di base dell'utente, come il resto degli aggregati.
            const response = await getPortfolioValue(currency);
            setPortfolioData(response.data);
            setLoadError(false);
        } catch (error) {
            console.error('Failed to fetch portfolio:', error);
            // Senza dati precedenti l'errore prende il posto del riepilogo (InlineError);
            // con dati già a schermo basta il toast, il riepilogo resta valido.
            setLoadError(true);
            message.error(t('crypto.loadError'));
        } finally {
            setLoading(false);
        }
    };

    // Dopo una modifica agli holding: anche la card crypto della dashboard è da rifare.
    const refreshPortfolio = () => {
        fetchPortfolio();
        invalidateDerivedData(queryClient);
    };

    useEffect(() => {
        fetchPortfolio();
    }, []);

    const handleSyncBinance = async () => {
        setSyncingBinance(true);
        try {
            await syncFromBinance();
            message.success(t('crypto.syncStarted'));
            // Refresh portfolio after a short delay to allow sync to process (or just immediately, depending on backend)
            // Ideally backend returns updated data or we poll, but for now let's just re-fetch
            setTimeout(refreshPortfolio, 2000);
        } catch (error) {
            console.error('Failed to sync Binance:', error);
            message.error(t('crypto.syncError'));
        } finally {
            setSyncingBinance(false);
        }
    };

    const handleSyncCoinbase = async () => {
        setSyncingCoinbase(true);
        try {
            await syncFromCoinbase();
            message.success(t('crypto.syncStartedCoinbase'));
            setTimeout(refreshPortfolio, 2000);
        } catch (error) {
            console.error('Failed to sync Coinbase:', error);
            message.error(t('crypto.syncErrorCoinbase'));
        } finally {
            setSyncingCoinbase(false);
        }
    };

    const handleEditAsset = (asset: CryptoAsset) => {
        setEditingAsset(asset);
        setShowManualModal(true);
    };

    const handleDeleteAsset = async (asset: CryptoAsset) => {
        try {
            await deleteManualHolding(asset.id);
            message.success(t('crypto.holdingDeleted'));
            refreshPortfolio();
        } catch (error) {
            console.error('Failed to delete holding:', error);
            message.error(t('crypto.holdingDeleteError'));
        }
    };

    const handleCloseManualModal = () => {
        setShowManualModal(false);
        setEditingAsset(null);
    };

    const { isSmallMobile: isMobile } = useBreakpoints();

    const mobileActions: MenuProps['items'] = [
        { key: 'syncBinance', icon: <ReloadOutlined />, label: t('crypto.syncBinance'), disabled: syncingBinance, onClick: handleSyncBinance },
        { key: 'syncCoinbase', icon: <ReloadOutlined />, label: t('crypto.syncCoinbase'), disabled: syncingCoinbase, onClick: handleSyncCoinbase },
        { type: 'divider' },
        { key: 'binance', icon: <KeyOutlined />, label: t('crypto.connectBinance'), onClick: () => setShowBinanceModal(true) },
        { key: 'coinbase', icon: <KeyOutlined />, label: t('crypto.connectCoinbase'), onClick: () => setShowCoinbaseModal(true) },
    ];

    return (
        <>
            <PageHeader
                title={t('crypto.title')}
                actions={isMobile ? (
                    // Su mobile i cinque bottoni a tutta larghezza occupavano tre righe: resta
                    // visibile l'aggiunta manuale, sincronizzazioni e collegamenti nel menu.
                    <Flex gap="small" style={{ width: '100%' }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowManualModal(true)} style={{ flex: 1 }}>
                            {t('crypto.addHolding')}
                        </Button>
                        <Dropdown menu={{ items: mobileActions }} trigger={['click']} placement="bottomRight">
                            <Button icon={<MoreOutlined />} aria-label={t('common.actions')} loading={syncingBinance || syncingCoinbase} />
                        </Dropdown>
                    </Flex>
                ) : (
                    <Space wrap style={{ justifyContent: 'flex-end' }}>
                        <Button
                            icon={<KeyOutlined />}
                            onClick={() => setShowBinanceModal(true)}
                        >
                            {t('crypto.connectBinance')}
                        </Button>
                        <Button
                            icon={<KeyOutlined />}
                            onClick={() => setShowCoinbaseModal(true)}
                        >
                            {t('crypto.connectCoinbase')}
                        </Button>
                        <Button
                            icon={<PlusOutlined />}
                            onClick={() => setShowManualModal(true)}
                        >
                            {t('crypto.addHolding')}
                        </Button>
                        <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            loading={syncingBinance}
                            onClick={handleSyncBinance}
                        >
                            {t('crypto.syncBinance')}
                        </Button>
                        <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            loading={syncingCoinbase}
                            onClick={handleSyncCoinbase}
                        >
                            {t('crypto.syncCoinbase')}
                        </Button>
                    </Space>
                )}
            />

            {loadError && !portfolioData && !loading ? (
                <InlineError message={t('crypto.loadError')} onRetry={fetchPortfolio} />
            ) : (
                <PortfolioSummary
                    data={portfolioData}
                    loading={loading}
                    onEditAsset={handleEditAsset}
                    onDeleteAsset={handleDeleteAsset}
                />
            )}

            <BinanceKeysModal
                open={showBinanceModal}
                onClose={() => setShowBinanceModal(false)}
                onSuccess={refreshPortfolio}
            />

            <CoinbaseKeysModal
                open={showCoinbaseModal}
                onClose={() => setShowCoinbaseModal(false)}
                onSuccess={refreshPortfolio}
            />

            <ManualHoldingModal
                open={showManualModal}
                onClose={handleCloseManualModal}
                onSuccess={refreshPortfolio}
                editingAsset={editingAsset}
            />
        </>
    );
};
