import React, {useEffect, useState} from 'react';
import {Button, message, Space, Typography} from 'antd';
import {KeyOutlined, PlusOutlined, ReloadOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {deleteManualHolding, getPortfolioValue, syncFromBinance} from '../../services/api';
import {useMediaQuery} from '../../hooks/useMediaQuery';
import type {CryptoAsset, PortfolioValueResponse} from '../../types/api';
import {PortfolioSummary} from '../../components/PortfolioSummary';
import {BinanceKeysModal} from '../../components/BinanceKeysModal';
import {ManualHoldingModal} from '../../components/ManualHoldingModal';

const { Title } = Typography;

export const CryptoPage: React.FC = () => {
    const { t } = useTranslation();
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

    const isMobile = useMediaQuery('(max-width: 768px)');

    return (
        <div style={{ padding: isMobile ? '16px' : '24px' }}>
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: '24px',
                gap: isMobile ? '16px' : '0'
            }}>
                <Title level={2} style={{ margin: 0 }}>{t('crypto.title')}</Title>
                <Space wrap style={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
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
            </div>

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
        </div>
    );
};
