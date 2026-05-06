import React, {useEffect, useState} from 'react';
import {Button, message, Space} from 'antd';
import {KeyOutlined, PlusOutlined, ReloadOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {deleteManualHolding, getPortfolioValue, syncFromBinance} from '../../services/api';
import {useBreakpoints} from '../../hooks/useBreakpoints';
import { usePageTitle } from '../../hooks/usePageTitle';
import type {CryptoAsset, PortfolioValueResponse} from '../../types/api';
import {PortfolioSummary} from '../../components/PortfolioSummary';
import {BinanceKeysModal} from '../../components/BinanceKeysModal';
import {ManualHoldingModal} from '../../components/ManualHoldingModal';
import {PageHeader} from '../../components/PageHeader';

export const CryptoPage: React.FC = () => {
    const { t } = useTranslation();
    usePageTitle(t('crypto.title'));
    const [portfolioData, setPortfolioData] = useState<PortfolioValueResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showBinanceModal, setShowBinanceModal] = useState(false);
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
        setSyncing(true);
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
            setSyncing(false);
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

    return (
        <>
            <PageHeader
                title={t('crypto.title')}
                actions={
                    <Space wrap style={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
                        <Button
                            icon={<KeyOutlined />}
                            onClick={() => setShowBinanceModal(true)}
                            block={isMobile}
                        >
                            {t('crypto.connectBinance')}
                        </Button>
                        <Button
                            icon={<PlusOutlined />}
                            onClick={() => setShowManualModal(true)}
                            block={isMobile}
                        >
                            {t('crypto.addHolding')}
                        </Button>
                        <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            loading={syncing}
                            onClick={handleSyncBinance}
                            block={isMobile}
                        >
                            {t('crypto.syncBinance')}
                        </Button>
                    </Space>
                }
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

            <ManualHoldingModal
                open={showManualModal}
                onClose={handleCloseManualModal}
                onSuccess={fetchPortfolio}
                editingAsset={editingAsset}
            />
        </>
    );
};
