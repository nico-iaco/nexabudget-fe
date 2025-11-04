// src/pages/dashboard/DashboardPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Row, Col, Typography, Spin, DatePicker, Card, Statistic, Empty } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import * as api from '../../services/api';
import type { Transaction } from '../../types/api';
import { CustomPieChart } from '../../components/CustomPieChart';
import { CustomBarChart, type BarData } from '../../components/CustomBarChart';
import { CustomLineChart, type LineData } from '../../components/CustomLineChart';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type DateRange = [Dayjs | null, Dayjs | null] | null;

interface OutletContextType {
    transactionRefreshKey: number;
}

export const DashboardPage = () => {
    const { transactionRefreshKey } = useOutletContext<OutletContextType>();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>([dayjs().startOf('year'), dayjs().endOf('year')]);

    useEffect(() => {
        setLoading(true);
        api.getTransactionsByUserId()
            .then(response => {
                setTransactions(response.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [transactionRefreshKey]);

    const filteredTransactions = useMemo(() => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) {
            return transactions;
        }
        const [startDate, endDate] = dateRange;
        return transactions.filter(t => {
            const transactionDate = dayjs(t.date);
            return transactionDate.isAfter(startDate) && transactionDate.isBefore(endDate);
        });
    }, [transactions, dateRange]);

    const { totalIncome, totalExpenses, netBalance } = useMemo(() => {
        return filteredTransactions.reduce((acc, t) => {
            if (t.type === 'IN') {
                acc.totalIncome += t.amount;
            } else {
                acc.totalExpenses += t.amount;
            }
            acc.netBalance = acc.totalIncome - acc.totalExpenses;
            return acc;
        }, { totalIncome: 0, totalExpenses: 0, netBalance: 0 });
    }, [filteredTransactions]);

    const expensesByCategory = useMemo(() => {
        const categoryMap: { [key: string]: number } = {};
        filteredTransactions
            .filter(t => t.type === 'OUT' && t.categoryName)
            .forEach(t => {
                const category = t.categoryName!;
                if (!categoryMap[category]) {
                    categoryMap[category] = 0;
                }
                categoryMap[category] += t.amount;
            });

        return Object.entries(categoryMap)
            .map(([type, value]) => ({ type, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredTransactions]);

    const incomeByCategory = useMemo(() => {
        const categoryMap: { [key: string]: number } = {};
        filteredTransactions
            .filter(t => t.type === 'IN' && t.categoryName)
            .forEach(t => {
                const category = t.categoryName!;
                if (!categoryMap[category]) {
                    categoryMap[category] = 0;
                }
                categoryMap[category] += t.amount;
            });

        return Object.entries(categoryMap)
            .map(([type, value]) => ({ type, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredTransactions]);

    const monthlyTrend = useMemo((): BarData[] => {
        const trend: { [month: string]: { income: number; expense: number } } = {};

        filteredTransactions.forEach(t => {
            const month = dayjs(t.date).format('YYYY-MM');
            if (!trend[month]) {
                trend[month] = { income: 0, expense: 0 };
            }
            if (t.type === 'IN') {
                trend[month].income += t.amount;
            } else {
                trend[month].expense += t.amount;
            }
        });

        const result: BarData[] = [];
        Object.keys(trend).forEach(month => {
            result.push({ month: dayjs(month).format('MMM YY'), type: 'Entrate', value: trend[month].income });
            result.push({ month: dayjs(month).format('MMM YY'), type: 'Uscite', value: trend[month].expense });
        });

        return result.sort((a, b) => dayjs(a.month, 'MMM YY').valueOf() - dayjs(b.month, 'MMM YY').valueOf());
    }, [filteredTransactions]);

    const monthlyNetBalance = useMemo((): LineData[] => {
        const balanceByMonth: { [key: string]: number } = {};

        filteredTransactions.forEach(t => {
            const month = dayjs(t.date).format('YYYY-MM');
            if (!balanceByMonth[month]) {
                balanceByMonth[month] = 0;
            }
            balanceByMonth[month] += t.type === 'IN' ? t.amount : -t.amount;
        });

        const sortedMonths = Object.entries(balanceByMonth)
            .map(([month, value]) => ({ month, value }))
            .sort((a, b) => a.month.localeCompare(b.month));

        let cumulativeBalance = 0;
        return sortedMonths.map(item => {
            cumulativeBalance += item.value;
            return {
                label: dayjs(item.month).endOf('month').format('YYYY-MM-DD'),
                value: cumulativeBalance,
                monthlyNet: item.value,
            };
        });
    }, [filteredTransactions]);

    const expenseComparison = useMemo(() => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) return null;

        const [start, end] = dateRange;
        const duration = end.diff(start, 'day');
        const prevStart = start.subtract(duration + 1, 'day');
        const prevEnd = end.subtract(duration + 1, 'day');

        const currentExpenses = filteredTransactions
            .filter(t => t.type === 'OUT')
            .reduce((sum, t) => sum + t.amount, 0);

        const previousExpenses = transactions
            .filter(t => {
                const tDate = dayjs(t.date);
                return t.type === 'OUT' && tDate.isAfter(prevStart) && tDate.isBefore(prevEnd);
            })
            .reduce((sum, t) => sum + t.amount, 0);

        if (previousExpenses === 0) {
            return { percentageChange: currentExpenses > 0 ? 100 : 0, period: 'periodo precedente' };
        }

        const percentageChange = ((currentExpenses - previousExpenses) / previousExpenses) * 100;
        return { percentageChange, period: 'periodo precedente' };
    }, [transactions, dateRange, filteredTransactions]);

    if (loading) {
        return <Spin size="large" style={{ display: 'block', marginTop: 50 }} />;
    }

    return (
        <>
            <Row justify="space-between" align="middle">
                <Col>
                    <Title level={2}>Dashboard</Title>
                </Col>
                <Col>
                    <RangePicker value={dateRange} onChange={setDateRange} />
                </Col>
            </Row>

            {filteredTransactions.length === 0 ? (
                <Empty description="Nessuna transazione trovata per il periodo selezionato." style={{ marginTop: 48 }} />
            ) : (
                <>
                    <Row gutter={16} style={{ marginTop: 24 }}>
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

                    <Row gutter={16} style={{ marginTop: 24 }}>
                        <Col xs={24} md={12}>
                            <Card title="Entrate per Categoria">
                                {incomeByCategory.length > 0 ? <CustomPieChart data={incomeByCategory} /> : <Empty description="Nessuna entrata categorizzata" />}
                            </Card>
                        </Col>
                        <Col xs={24} md={12}>
                            <Card title="Uscite per Categoria">
                                {expensesByCategory.length > 0 ? <CustomPieChart data={expensesByCategory} /> : <Empty description="Nessuna spesa categorizzata" />}
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={16} style={{ marginTop: 24 }}>
                        <Col xs={24}>
                            <Card title="Andamento Mensile (Entrate/Uscite)">
                                {monthlyTrend.length > 0 ? <CustomBarChart data={monthlyTrend} /> : <Empty description="Dati insufficienti" />}
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={16} style={{ marginTop: 24 }}>
                        <Col xs={24}>
                            <Card title="Andamento Saldo Netto Mensile">
                                {monthlyNetBalance.length > 0 ? <CustomLineChart data={monthlyNetBalance} dataKey="label" valueKey="value" /> : <Empty description="Dati insufficienti" />}
                            </Card>
                        </Col>
                    </Row>
                </>
            )}
        </>
    );
};
