import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { AppLogo } from '../components/common/AppLogo';

export const NotFoundPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    usePageTitle('404');

    return (
        <Result
            icon={
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <AppLogo size={64} radius={16} />
                </div>
            }
            title="404"
            subTitle={t('common.notFound')}
            extra={
                <Button type="primary" onClick={() => navigate('/dashboard')}>
                    {t('common.backToDashboard')}
                </Button>
            }
        />
    );
};
