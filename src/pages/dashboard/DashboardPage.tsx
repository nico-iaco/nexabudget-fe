// src/pages/dashboard/DashboardPage.tsx
import { useOutletContext } from 'react-router-dom';
import { Card, Col, DatePicker, Empty, Row, Skeleton, Statistic, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useDashboardData } from '../../hooks/useDashboardData';
import { ExpensePieChart, IncomePieChart, NetBalanceLineChart, TrendBarChart } from '../../components/dashboard/DashboardCharts';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface OutletContextType {
    transactionRefreshKey: number;
}

export const DashboardPage = () => {
    const { transactionRefreshKey } = useOutletContext<OutletContextType>();
    const {
        loading,
        dateRange,
        setDateRange,
        filteredTransactions,
        totalIncome,
        totalExpenses,
        netBalance,
        expensesByCategory,
        incomeByCategory,
        monthlyTrend,
        monthlyNetBalance,
        expenseComparison
    } = useDashboardData(transactionRefreshKey);

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
                    <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
                </Col>
                <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                    <RangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        style={{ width: '100%', maxWidth: 350 }}
                    />
                </Col>
            </Row>

            {filteredTransactions.length === 0 ? (
                <Empty description="Nessuna transazione trovata per il periodo selezionato." style={{ marginTop: 48 }} />
            ) : (
                <>
                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24} sm={8}>
                            <Card>
                                <Statistic
                                    title="Saldo Netto"
                                    value={netBalance}
                                    precision={2}
                                    valueStyle={{ color: netBalance >= 0 ? '#3f8600' : '#cf1322' }}
                                    prefix={netBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                    suffix="€"
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card>
                                <Statistic
                                    title="Entrate Totali"
                                    value={totalIncome}
                                    precision={2}
                                    valueStyle={{ color: '#3f8600' }}
                                    prefix={<ArrowUpOutlined />}
                                    suffix="€"
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card>
                                <Statistic
                                    title="Uscite Totali"
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
                                        <Text type="secondary"> vs {expenseComparison.period}</Text>
                                    </div>
                                )}
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24} md={12}>
                            <Card title="Entrate per Categoria">
                                <IncomePieChart data={incomeByCategory} />
                            </Card>
                        </Col>
                        <Col xs={24} md={12}>
                            <Card title="Uscite per Categoria">
                                <ExpensePieChart data={expensesByCategory} />
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24}>
                            <Card title="Andamento Mensile (Entrate/Uscite)">
                                <TrendBarChart data={monthlyTrend} />
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                        <Col xs={24}>
                            <Card title="Andamento Saldo Netto Mensile">
                                <NetBalanceLineChart data={monthlyNetBalance} />
                            </Card>
                        </Col>
                    </Row>
                </>
            )}
        </>
    );
};

