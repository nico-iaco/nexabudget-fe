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

export const CryptoPage: React.FC = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    usePageTitle(t('crypto.title'));
    const [portfolioData, setPortfolioData] = useState<PortfolioValueResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncingBinance, setSyncingBinance] = useState(false);
    const [syncingCoinbase, setSyncingCoinbase] = useState(false);
    const [showBinanceModal, setShowBinanceModal] = useState(false);
    const [showCoinbaseModal, setShowCoinbaseModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState<CryptoAsset | null>(null);

    const fetchPortfolio = async () => {
        setLoading(true);
        try {
            // Defaulting to EUR for now, could be a user preference later
            const response = await getPortfolioValue('EUR');
            setPortfolioData(response.data);
        } catch (error) {
            console.error('Failed to fetch portfolio:', error);
            message.error(t('crypto.loadError'));
        } finally {
            setLoading(false);
        }
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
            setTimeout(fetchPortfolio, 2000);
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
            setTimeout(fetchPortfolio, 2000);
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
            fetchPortfolio();
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

            <PortfolioSummary
                data={portfolioData}
                loading={loading}
                onEditAsset={handleEditAsset}
                onDeleteAsset={handleDeleteAsset}
            />

            <BinanceKeysModal
                open={showBinanceModal}
                onClose={() => setShowBinanceModal(false)}
                onSuccess={fetchPortfolio}
            />

            <CoinbaseKeysModal
                open={showCoinbaseModal}
                onClose={() => setShowCoinbaseModal(false)}
                onSuccess={fetchPortfolio}
            />

            <ManualHoldingModal
                open={showManualModal}
                onClose={handleCloseManualModal}
                onSuccess={fetchPortfolio}
                editingAsset={editingAsset}
            />
        </>
    );
};
