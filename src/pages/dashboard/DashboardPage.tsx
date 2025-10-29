// src/pages/dashboard/DashboardPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Row, Col, Typography, Spin, DatePicker, Card, Statistic, Empty } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import * as api from '../../services/api';
import type { Transaction } from '../../types/api';
import { CustomPieChart } from '../../components/CustomPieChart';
import { CustomBarChart } from '../../components/CustomBarChart';

const { Title } = Typography;
const { RangePicker } = DatePicker;

type DateRange = [Dayjs | null, Dayjs | null] | null;

interface OutletContextType {
    transactionRefreshKey: number;
}

interface BarData {
    month: string;
    type: 'Entrate' | 'Uscite';
    value: number;
}

export const DashboardPage = () => {
    const { transactionRefreshKey } = useOutletContext<OutletContextType>();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>([dayjs().startOf('month'), dayjs().endOf('month')]);

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
        const [start, end] = dateRange;
        return transactions.filter(t => {
            const transactionDate = dayjs(t.data);
            return transactionDate.isAfter(start.startOf('day')) && transactionDate.isBefore(end.endOf('day'));
        });
    }, [transactions, dateRange]);

    const { totalIncome, totalExpenses, netBalance } = useMemo(() => {
        return filteredTransactions.reduce((acc, t) => {
            if (t.type === 'IN') {
                acc.totalIncome += t.importo;
            } else {
                acc.totalExpenses += t.importo;
            }
            acc.netBalance = acc.totalIncome - acc.totalExpenses;
            return acc;
        }, { totalIncome: 0, totalExpenses: 0, netBalance: 0 });
    }, [filteredTransactions]);

    const expensesByCategory = useMemo(() => {
        const expenseMap: { [key: string]: number } = {};
        const expenseTransactions = filteredTransactions.filter(t => t.type === 'OUT');

        expenseTransactions.forEach(t => {
            const categoryName = t.categoryName || 'Senza Categoria';
            if (expenseMap[categoryName]) {
                expenseMap[categoryName] += t.importo;
            } else {
                expenseMap[categoryName] = t.importo;
            }
        });

        return Object.entries(expenseMap)
            .map(([type, value]) => ({ type, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredTransactions]);

    const monthlyTrend = useMemo(() => {
        const trends: { [key: string]: { income: number; expense: number } } = {};

        filteredTransactions.forEach(t => {
            const month = dayjs(t.data).format('MMM');
            if (!trends[month]) {
                trends[month] = { income: 0, expense: 0 };
            }
            if (t.type === 'IN') {
                trends[month].income += t.importo;
            } else {
                trends[month].expense += t.importo;
            }
        });

        const barChartData: BarData[] = Object.entries(trends).flatMap(([month, values]) => [
            { month, type: 'Entrate', value: values.income },
            { month, type: 'Uscite', value: values.expense },
        ]);

        const monthOrder = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        return barChartData.sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));
    }, [filteredTransactions]);

    if (loading) {
        return <Spin size="large" style={{ display: 'block', marginTop: '50px' }} />;
    }

    return (
        <>
            <Row justify="space-between" align="middle">
                <Title level={2}>Dashboard</Title>
                <RangePicker value={dateRange} onChange={setDateRange} />
            </Row>

            <Row gutter={16} style={{ marginTop: 24 }}>
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
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="Bilancio Netto"
                            value={netBalance}
                            precision={2}
                            valueStyle={{ color: netBalance >= 0 ? '#3f8600' : '#cf1322' }}
                            suffix="€"
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} style={{ marginTop: 24 }}>
                <Col xs={24} lg={12}>
                    <Card title="Uscite per Categoria">
                        {expensesByCategory.length > 0 ? (
                            <CustomPieChart data={expensesByCategory} />
                        ) : (
                            <Empty description="Nessuna spesa nel periodo selezionato" />
                        )}
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="Andamento Mensile (Entrate vs Uscite)">
                        {monthlyTrend.length > 0 ? (
                            <CustomBarChart data={monthlyTrend} />
                        ) : (
                            <Empty description="Nessun dato nel periodo selezionato" />
                        )}
                    </Card>
                </Col>
            </Row>
        </>
    );
};
