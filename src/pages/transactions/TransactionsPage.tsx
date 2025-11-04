// src/pages/transactions/TransactionsPage.tsx
import {useEffect, useState, useMemo} from 'react';
import {useParams, useOutletContext} from 'react-router-dom';
import {
    Table,
    Typography,
    Spin,
    Tag,
    Button,
    Flex,
    Modal,
    Form,
    InputNumber,
    Select,
    Input,
    DatePicker,
    List,
    Space,
    message,
    Radio,
    Alert
} from 'antd';
import {PlusOutlined, DeleteOutlined, EditOutlined, RetweetOutlined, SwapOutlined} from '@ant-design/icons';
import * as api from '../../services/api';
import type {Transaction, Account, TransactionRequest, Category, LinkTransferRequest} from '../../types/api';
import {useAuth} from '../../contexts/AuthContext';
import dayjs, {type Dayjs} from 'dayjs';
import {useMediaQuery} from '../../hooks/useMediaQuery';
import {TransactionCard} from '../../components/TransactionCard';
import type {ColumnsType, TableProps} from 'antd/es/table';
import type {SorterResult} from 'antd/es/table/interface';

const {Title, Text} = Typography;
const {Option} = Select;

interface OutletContextType {
    accounts: Account[];
    fetchAccounts: () => void;
    transactionRefreshKey: number;
    categories: Category[];
    handleOpenTransferModal: () => void;
}

interface FormValues extends Omit<TransactionRequest, 'data'> {
    data?: Dayjs | null;
}

interface TableFilters {
    type?: ('IN' | 'OUT')[];
    data?: [Dayjs | null, Dayjs | null] | null;
    search?: string;
}

export const TransactionsPage = () => {
    const {accountId} = useParams<{ accountId?: string }>();
    const {auth} = useAuth();
    const {
        accounts,
        fetchAccounts: fetchLayoutAccounts,
        transactionRefreshKey,
        categories,
        handleOpenTransferModal
    } = useOutletContext<OutletContextType>();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

    const [form] = Form.useForm<FormValues>();
    const transactionType = Form.useWatch('type', form);
    const isMobile = useMediaQuery('(max-width: 768px)');

    // State for sorting and filtering
    const [sortConfig, setSortConfig] = useState<SorterResult<Transaction>>({
        field: 'data',
        order: 'descend',
    });
    const [filters, setFilters] = useState<TableFilters>({});

    // State for "Convert to Transfer" modal
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [sourceTransaction, setSourceTransaction] = useState<Transaction | null>(null);
    const [destinationAccountId, setDestinationAccountId] = useState<number | null>(null);
    const [destinationTransactions, setDestinationTransactions] = useState<Transaction[]>([]);
    const [loadingDestTransactions, setLoadingDestTransactions] = useState(false);
    const [selectedDestTransactionId, setSelectedDestTransactionId] = useState<number | null>(null);

    const [syncingTransactions, setSyncingTransactions] = useState(false);

    const handleSyncGoCardlessTransactions = async () => {
        if (!accountId) return;

        setSyncingTransactions(true);
        const hideMessage = message.loading('Sincronizzazione transazioni in corso...', 0);

        try {
            await api.syncGoCardlessBankAccount(parseInt(accountId));
            message.success('Transazioni sincronizzate con successo!');
            fetchTransactions();
            fetchLayoutAccounts();
        } catch (error) {
            console.error(error);
            message.error('Errore durante la sincronizzazione delle transazioni');
        } finally {
            hideMessage();
            setSyncingTransactions(false);
        }
    };


    const fetchTransactions = () => {
        if (!auth) return;
        setLoading(true);

        const apiCall = accountId
            ? api.getTransactionsByAccountId(parseInt(accountId))
            : api.getTransactionsByUserId();

        apiCall
            .then(response => setTransactions(response.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTransactions();
    }, [accountId, auth, transactionRefreshKey]);

    useEffect(() => {
        if (!destinationAccountId || !sourceTransaction) return;

        const fetchDestinationTransactions = async () => {
            setLoadingDestTransactions(true);
            try {
                const response = await api.getTransactionsByAccountId(destinationAccountId);
                const sourceDate = dayjs(sourceTransaction.date);
                const startDate = sourceDate.subtract(3, 'day');
                const endDate = sourceDate.add(3, 'day');

                const filtered = response.data.filter(t => {
                    const tDate = dayjs(t.date);
                    // Must be opposite type, same amount, and within date range
                    return t.type !== sourceTransaction.type &&
                        t.amount === sourceTransaction.amount &&
                        !t.transferId &&
                        tDate.isAfter(startDate) && tDate.isBefore(endDate);
                });
                setDestinationTransactions(filtered);
            } catch (error) {
                console.error("Failed to fetch destination transactions", error);
                message.error("Errore nel recupero delle transazioni di destinazione.");
            } finally {
                setLoadingDestTransactions(false);
            }
        };

        fetchDestinationTransactions();
    }, [destinationAccountId, sourceTransaction]);


    const handleDelete = async (id: number) => {
        try {
            await api.deleteTransaction(id);
            fetchTransactions();
            fetchLayoutAccounts();
        } catch (error) {
            console.error("Failed to delete transaction", error);
        }
    };

    const handleOpenCreateModal = () => {
        setEditingRecord(null);
        form.resetFields();
        if (accountId) {
            form.setFieldsValue({accountId: parseInt(accountId)});
        }
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (record: Transaction) => {
        setEditingRecord(record);
        form.setFieldsValue({
            ...record,
            data: record.date ? dayjs(record.date) : null,
        });
        setIsModalOpen(true);
    };

    const handleCancel = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
    };

    const onFinish = async (values: FormValues) => {
        try {
            const dataToSend: TransactionRequest = {
                ...values,
                data: values.data ? values.data.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                importo: values.importo,
                type: values.type,
                descrizione: values.descrizione,
                accountId: values.accountId,
            };

            if (editingRecord) {
                await api.updateTransaction(editingRecord.id, dataToSend);
            } else {
                await api.createTransaction(dataToSend);
            }

            setIsModalOpen(false);
            fetchTransactions();
            fetchLayoutAccounts();
        } catch (error) {
            console.error("Failed to save transaction", error);
        }
    };

    const handleOpenLinkTransferModal = (transaction: Transaction) => {
        setSourceTransaction(transaction);
        setIsLinkModalOpen(true);
    };

    const handleCancelLinkTransferModal = () => {
        setIsLinkModalOpen(false);
        setSourceTransaction(null);
        setDestinationAccountId(null);
        setDestinationTransactions([]);
        setSelectedDestTransactionId(null);
    };

    const handleConfirmLinkTransfer = async () => {
        if (!sourceTransaction || !selectedDestTransactionId) return;

        const request: LinkTransferRequest = {
            sourceTransactionId: sourceTransaction.id,
            destinationTransactionId: selectedDestTransactionId,
        };

        try {
            await api.linkTransactionsAsTransfer(request);
            message.success("Transazioni collegate con successo!");
            handleCancelLinkTransferModal();
            fetchTransactions();
        } catch (error) {
            console.error("Failed to link transactions", error);
            message.error("Errore durante il collegamento delle transazioni.");
        }
    };

    const columns: ColumnsType<Transaction> = [
        {
            title: 'Data',
            dataIndex: 'date',
            key: 'data',
            render: (text: string) => dayjs(text).format('DD/MM/YYYY'),
            sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
            sortOrder: sortConfig.field === 'data' ? sortConfig.order : null,
            defaultSortOrder: 'descend',
        },
        {
            title: 'Descrizione',
            dataIndex: 'description',
            key: 'descrizione',
            sorter: (a, b) => a.description.localeCompare(b.description),
            sortOrder: sortConfig.field === 'descrizione' ? sortConfig.order : null,
        },
        {
            title: 'Conto',
            dataIndex: 'accountName',
            key: 'accountName',
            sorter: (a, b) => a.accountName.localeCompare(b.accountName),
            sortOrder: sortConfig.field === 'accountName' ? sortConfig.order : null,
        },
        {
            title: 'Categoria',
            dataIndex: 'categoryName',
            key: 'categoryName',
            sorter: (a, b) => (a.categoryName || '').localeCompare(b.categoryName || ''),
            sortOrder: sortConfig.field === 'categoryName' ? sortConfig.order : null,
        },
        {
            title: 'Importo',
            dataIndex: 'amount',
            key: 'importo',
            sorter: (a, b) => {
                const amountA = a.type === 'OUT' ? -a.amount : a.amount;
                const amountB = b.type === 'OUT' ? -b.amount : b.amount;
                return amountA - amountB;
            },
            sortOrder: sortConfig.field === 'importo' ? sortConfig.order : null,
            render: (amount: number, record: Transaction) => (
                <span style={{color: record.type === 'IN' ? 'green' : 'red'}}>
            {record.type === 'IN' ? '+' : '-'} {amount.toFixed(2)} €
        </span>
            )
        },
        {
            title: 'Tipo',
            dataIndex: 'type',
            key: 'type',
            render: (type: 'IN' | 'OUT') => (
                <Tag color={type === 'IN' ? 'success' : 'error'}>{type}</Tag>
            ),
            filters: [
                {text: 'Entrata', value: 'IN'},
                {text: 'Uscita', value: 'OUT'},
            ],
        },
        {
            title: 'Azioni',
            key: 'actions',
            render: (_: unknown, record: Transaction) => (
                <Flex gap="small">
                    <Button icon={<EditOutlined/>} onClick={() => handleOpenEditModal(record)}/>
                    {!record.transferId && (
                        <Button icon={<SwapOutlined/>} onClick={() => handleOpenLinkTransferModal(record)}/>
                    )}
                    <Button danger icon={<DeleteOutlined/>} onClick={() => handleDelete(record.id)}/>
                </Flex>
            )
        },
    ];

    const handleTableChange: TableProps<Transaction>['onChange'] = (_, tableFilters, sorter) => {
        const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        setSortConfig({
            field: nextSorter.field as string,
            order: nextSorter.order,
        });
        setFilters(prev => ({
            ...prev,
            type: tableFilters.type as ('IN' | 'OUT')[] | undefined,
        }));
    };

    const processedTransactions = useMemo(() => {
        let data = transactions.map(t => {
            if (!t.accountName) {
                const account = accounts.find(acc => acc.id === t.accountId);
                return {...t, accountName: account?.name || 'N/A'};
            }
            return t;
        });

        // Filtering
        if (filters.search) {
            const lowerCaseSearch = filters.search.toLowerCase();
            data = data.filter(t =>
                t.description.toLowerCase().includes(lowerCaseSearch) ||
                t.accountName.toLowerCase().includes(lowerCaseSearch) ||
                (t.categoryName && t.categoryName.toLowerCase().includes(lowerCaseSearch))
            );
        }
        if (filters.type && filters.type.length > 0) {
            data = data.filter(t => filters.type!.includes(t.type));
        }
        if (filters.data) {
            const [start, end] = filters.data;
            data = data.filter(t => {
                const date = dayjs(t.date);
                const isAfterStart = start ? date.isAfter(start.startOf('day')) : true;
                const isBeforeEnd = end ? date.isBefore(end.endOf('day')) : true;
                return isAfterStart && isBeforeEnd;
            });
        }

        // Sorting
        if (sortConfig.field && sortConfig.order) {
            const sorter = columns.find(c => c.key === sortConfig.field)?.sorter;
            if (typeof sorter === 'function') {
                data.sort((a, b) => {
                    const result = sorter(a, b, sortConfig.order);
                    return sortConfig.order === 'ascend' ? result : -result;
                });
            }
        }

        return data;
    }, [transactions, sortConfig, filters, accounts]);

    const pageTitle = accountId
        ? `Transazioni per ${accounts.find(acc => acc.id === parseInt(accountId))?.name}`
        : 'Tutte le Transazioni';

    if (loading && transactions.length === 0) return <Spin size="large"/>;

    const renderContent = () => {
        if (isMobile) {
            return (
                <List
                    dataSource={processedTransactions}
                    renderItem={item => (
                        <TransactionCard
                            transaction={item}
                            onEdit={handleOpenEditModal}
                            onDelete={handleDelete}
                            onConvertToTransfer={handleOpenLinkTransferModal}
                        />
                    )}
                />
            );
        }
        return <Table columns={columns} dataSource={processedTransactions} rowKey="id" loading={loading}
                      onChange={handleTableChange}/>;
    };

    const filteredCategories = categories.filter(cat => cat.transactionType === transactionType);

    return (
        <>
            <Flex justify="space-between" align="center" style={{marginBottom: 24}} wrap="wrap" gap="small">
                <Title level={2} style={{margin: 0}}>{pageTitle}</Title>
                <Space wrap>
                    {accountId && (
                        <Button
                            icon={<RetweetOutlined/>}
                            onClick={handleSyncGoCardlessTransactions}
                            loading={syncingTransactions}
                        >
                            {isMobile ? '' : 'Sincronizza GoCardless'}
                        </Button>
                    )}
                    <Button icon={<RetweetOutlined/>} onClick={handleOpenTransferModal}>
                        {isMobile ? '' : 'Nuovo Trasferimento'}
                    </Button>
                    <Button type="primary" icon={<PlusOutlined/>} onClick={handleOpenCreateModal}>
                        {isMobile ? '' : 'Nuova Transazione'}
                    </Button>
                </Space>
            </Flex>


            <Flex vertical gap="middle" style={{marginBottom: 24}}>
                <Input.Search
                    placeholder="Cerca per descrizione, conto, categoria"
                    onSearch={(value) => setFilters(prev => ({...prev, search: value}))}
                    onChange={(e) => {
                        if (e.target.value === '') {
                            setFilters(prev => ({...prev, search: undefined}));
                        }
                    }}
                    allowClear
                    enterButton
                />
                <Flex gap="small" wrap="wrap">
                    <Select
                        mode="multiple"
                        placeholder="Filtra per tipo"
                        value={filters.type}
                        onChange={(value) => setFilters(prev => ({...prev, type: value}))}
                        style={{flex: 1, minWidth: 120}}
                        allowClear
                    >
                        <Option value="IN">Entrata</Option>
                        <Option value="OUT">Uscita</Option>
                    </Select>
                    <DatePicker
                        placeholder="Da"
                        style={{flex: 1, minWidth: 120}}
                        onChange={(date) => setFilters(prev => ({...prev, data: [date, prev.data?.[1] ?? null]}))}
                    />
                    <DatePicker
                        placeholder="A"
                        style={{flex: 1, minWidth: 120}}
                        onChange={(date) => setFilters(prev => ({...prev, data: [prev.data?.[0] ?? null, date]}))}
                    />
                    <Select
                        placeholder="Ordina per"
                        value={sortConfig.field as string}
                        onChange={(value) => setSortConfig(prev => ({...prev, field: value}))}
                        style={{flex: 1, minWidth: 120}}
                    >
                        <Option value="data">Data</Option>
                        <Option value="descrizione">Descrizione</Option>
                        <Option value="importo">Importo</Option>
                        <Option value="accountName">Conto</Option>
                        <Option value="categoryName">Categoria</Option>
                    </Select>
                    <Select
                        placeholder="Ordine"
                        value={sortConfig.order}
                        onChange={(value) => setSortConfig(prev => ({...prev, order: value}))}
                        style={{flex: 1, minWidth: 120}}
                    >
                        <Option value="ascend">Crescente</Option>
                        <Option value="descend">Decrescente</Option>
                    </Select>
                </Flex>
            </Flex>

            {renderContent()}

            <Modal title={editingRecord ? "Modifica Transazione" : "Nuova Transazione"} open={isModalOpen}
                   onCancel={handleCancel} footer={null}>
                <Form form={form} layout="vertical" onFinish={onFinish} style={{marginTop: 24}}>
                    <Form.Item name="accountId" label="Conto" rules={[{required: true}]}>
                        <Select placeholder="Seleziona un conto" disabled={!!accountId || !!editingRecord}>
                            {accounts.map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="importo" label="Importo" rules={[{required: true}]}>
                        <InputNumber style={{width: '100%'}} min={0} addonAfter="€"/>
                    </Form.Item>
                    <Form.Item name="type" label="Tipo" rules={[{required: true}]}>
                        <Select placeholder="Entrata o Uscita"
                                onChange={() => form.setFieldsValue({categoryId: undefined})}>
                            <Option value="IN">Entrata</Option>
                            <Option value="OUT">Uscita</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="categoryId" label="Categoria">
                        <Select placeholder="Seleziona una categoria" allowClear disabled={!transactionType}>
                            {filteredCategories.map(cat => <Option key={cat.id} value={cat.id}>{cat.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="descrizione" label="Descrizione" rules={[{required: true}]}>
                        <Input/>
                    </Form.Item>
                    <Form.Item name="data" label="Data" initialValue={dayjs()}>
                        <DatePicker style={{width: '100%'}}/>
                    </Form.Item>
                    <Form.Item name="note" label="Note">
                        <Input.TextArea/>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>Salva</Button>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Collega a Trasferimento"
                open={isLinkModalOpen}
                onCancel={handleCancelLinkTransferModal}
                footer={[
                    <Button key="back" onClick={handleCancelLinkTransferModal}>Annulla</Button>,
                    <Button key="submit" type="primary" onClick={handleConfirmLinkTransfer}
                            disabled={!selectedDestTransactionId}>
                        Salva Collegamento
                    </Button>,
                ]}
                width={600}
            >
                {sourceTransaction && (
                    <Space direction="vertical" style={{width: '100%'}}>
                        <Text strong>Transazione di Origine</Text>
                        <p>
                            {dayjs(sourceTransaction.date).format('DD/MM/YYYY')} - {sourceTransaction.description} ({sourceTransaction.accountName})
                            -
                            <Text
                                type={sourceTransaction.type === 'IN' ? 'success' : 'danger'}> {sourceTransaction.amount.toFixed(2)}€</Text>
                        </p>

                        <Form layout="vertical">
                            <Form.Item label="Seleziona Conto di Destinazione">
                                <Select
                                    placeholder="Seleziona un conto"
                                    onChange={(value) => setDestinationAccountId(value)}
                                    value={destinationAccountId}
                                >
                                    {accounts
                                        .filter(acc => acc.id !== sourceTransaction.accountId)
                                        .map(acc => <Option key={acc.id} value={acc.id}>{acc.name}</Option>)}
                                </Select>
                            </Form.Item>
                        </Form>

                        {loadingDestTransactions ? <Spin/> : (
                            destinationAccountId && (
                                destinationTransactions.length > 0 ? (
                                    <Radio.Group
                                        onChange={(e) => setSelectedDestTransactionId(e.target.value)}
                                        value={selectedDestTransactionId}
                                        style={{width: '100%'}}
                                    >
                                        <List
                                            header={<div>Seleziona la transazione da collegare</div>}
                                            bordered
                                            dataSource={destinationTransactions}
                                            renderItem={item => (
                                                <List.Item>
                                                    <Radio value={item.id}>
                                                        {dayjs(item.date).format('DD/MM/YYYY')} - {item.description} -
                                                        <Text
                                                            type={item.type === 'IN' ? 'success' : 'danger'}> {item.amount.toFixed(2)}€</Text>
                                                    </Radio>
                                                </List.Item>
                                            )}
                                        />
                                    </Radio.Group>
                                ) : (
                                    <Alert
                                        message="Nessuna transazione compatibile trovata nel periodo di ±3 giorni con lo stesso importo e tipo opposto."
                                        type="info" showIcon/>
                                )
                            )
                        )}
                    </Space>
                )}
            </Modal>
        </>
    );
};
