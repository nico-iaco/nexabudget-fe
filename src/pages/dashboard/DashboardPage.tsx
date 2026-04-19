// src/pages/dashboard/DashboardPage.tsx
import {useOutletContext} from 'react-router-dom';
import {Card, Col, DatePicker, Empty, Progress, Row, Skeleton, Statistic, Typography} from 'antd';
import {ArrowDownOutlined, ArrowUpOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {useDashboardData} from '../../hooks/useDashboardData';
import {GenericPieChart, TrendBarChart} from '../../components/dashboard/DashboardCharts';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface OutletContextType {
    transactionRefreshKey: number;
}

export const DashboardPage = () => {
    const { t } = useTranslation();
    const { transactionRefreshKey } = useOutletContext<OutletContextType>();
    const {
        loading,
        dateRange,
        setDateRange,
        totalIncome,
        totalExpenses,
        netBalance,
        expensesByCategory,
        incomeByCategory,
        monthlyTrend,
        expenseComparison,
        portfolioValue,
        projection,
        hasData,
    } = useDashboardData(transactionRefreshKey);

    const showCrypto = portfolioValue && portfolioValue.totalValue > 0;
    const statCols = showCrypto ? { xs: 24, sm: 12, md: 6 } : { xs: 24, sm: 8 };

    if (loading) {
        return (
            <div style={{ padding: 24 }}>
                <Skeleton active paragraph={{ rows: 1 }} />
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                    <Col xs={24} sm={8}><Skeleton.Button active block style={{ height: 120 }} /></Col>
                </Row>
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col xs={24} md={12}><Skeleton active paragraph={{ rows: 6 }} /></Col>
                    <Col xs={24} md={12}><Skeleton active paragraph={{ rows: 6 }} /></Col>
                </Row>
                <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: 16 }} />
            </div>
        );
    }

    return (
        <>
            <Row justify="space-between" align="middle" gutter={[8, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12}>
                    <Title level={2} style={{ margin: 0 }}>{t('dashboard.title')}</Title>
                </Col>
                <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                    <RangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        style={{ width: '100%', maxWidth: 350 }}
                    />
                </Col>
            </Row>

            {!hasData ? (
                <Empty description={t('dashboard.empty')} style={{ marginTop: 48 }} />
            ) : (
                <>
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col {...statCols}>
                            <Card>
                                <Statistic
                                    title={t('dashboard.netBalance')}
                                    value={netBalance}
                                    precision={2}
                                    valueStyle={{ color: netBalance >= 0 ? '#3f8600' : '#cf1322' }}
                                    prefix={netBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                    suffix="€"
                                />
                            </Card>
                        </Col>
                        <Col {...statCols}>
                            <Card>
                                <Statistic
                                    title={t('dashboard.totalIncome')}
                                    value={totalIncome}
                                    precision={2}
                                    valueStyle={{ color: '#3f8600' }}
                                    prefix={<ArrowUpOutlined />}
                                    suffix="€"
                                />
                            </Card>
                        </Col>
                        <Col {...statCols}>
                            <Card>
                                <Statistic
                                    title={t('dashboard.totalExpenses')}
                                    value={totalExpenses}
                                    precision={2}
                                    valueStyle={{ color: '#cf1322' }}
                                    prefix={<ArrowDownOutlined />}
                                    suffix="€"
                                />
                                {expenseComparison && (
                                    <div style={{ marginTop: 8, fontSize: '12px' }}>
                                        <Text type={expenseComparison.percentageChange >= 0 ? 'danger' : 'success'}>
                                            {expenseComparison.percentageChange.toFixed(2)}%
                                        </Text>
                                        <Text type="secondary"> {t('dashboard.vsPeriod', { period: t('dashboard.previousMonth') })}</Text>
                                    </div>
                                )}
                            </Card>
                        </Col>
                        {showCrypto && (
                            <Col {...statCols}>
                                <Card>
                                    <Statistic
                                        title={t('dashboard.cryptoPortfolio')}
                                        value={portfolioValue.totalValue}
                                        precision={2}
                                        valueStyle={{ color: '#1890ff' }}
                                        prefix={portfolioValue.currency === 'EUR' ? '€' : '$'}
                                    />
                                </Card>
                            </Col>
                        )}
                    </Row>

                    {projection && (
                        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                            <Col xs={24}>
                                <Card title={t('dashboard.projection')}>
                                    <Row gutter={[16, 8]} align="middle">
                                        <Col xs={24} sm={6}>
                                            <Statistic
                                                title={t('reports.projectedIncome')}
                                                value={projection.projectedIncome}
                                                precision={2}
                                                valueStyle={{ color: '#3f8600', fontSize: '18px' }}
                                                suffix="€"
                                            />
                                        </Col>
                                        <Col xs={24} sm={6}>
                                            <Statistic
                                                title={t('reports.projectedExpense')}
                                                value={projection.projectedExpense}
                                                precision={2}
                                                valueStyle={{ color: '#cf1322', fontSize: '18px' }}
                                                suffix="€"
                                            />
                                        </Col>
                                        <Col xs={24} sm={6}>
                                            <Statistic
                                                title={t('reports.projectedSavings')}
                                                value={projection.projectedSavings}
                                                precision={2}
                                                valueStyle={{ color: projection.projectedSavings >= 0 ? '#3f8600' : '#cf1322', fontSize: '18px' }}
                                                suffix="€"
                                            />
                                        </Col>
                                        <Col xs={24} sm={6}>
                                            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                                                {t('dashboard.projectionDay', {
                                                    elapsed: projection.daysElapsed,
                                                    total: projection.daysInMonth
                                                })}
                                            </Text>
                                            <Progress
                                                percent={Math.round((projection.daysElapsed / projection.daysInMonth) * 100)}
                                                size="small"
                                            />
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24} md={12}>
                            <Card title={t('dashboard.incomeByCategory')}>
                                <GenericPieChart data={incomeByCategory} />
                            </Card>
                        </Col>
                        <Col xs={24} md={12}>
                            <Card title={t('dashboard.expensesByCategory')}>
                                <GenericPieChart data={expensesByCategory} />
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24}>
                            <Card title={t('dashboard.monthlyTrend')}>
                                <TrendBarChart data={monthlyTrend} />
                            </Card>
                        </Col>
                    </Row>
                </>
            )}
        </>
    );
};
