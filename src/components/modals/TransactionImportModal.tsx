import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Checkbox,
    Descriptions,
    Flex,
    Form,
    Input,
    message,
    Modal,
    Radio,
    Select,
    Steps,
    Table,
    Tag,
    Typography,
} from 'antd';
import { FileSearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type {
    Category,
    CsvColumnMapping,
    ImportFileFormat,
    ImportPreviewResponse,
    ImportResultResponse,
} from '../../types/api';
import type { ColumnsType } from 'antd/es/table';
import { COLOR_NEGATIVE, COLOR_POSITIVE } from '../../theme/tokens';
import { getCurrencySymbol } from '../../utils/currency';

const { Text } = Typography;
const { Option } = Select;

interface TransactionImportModalProps {
    open: boolean;
    accountId: string;
    categories: Category[];
    currency?: string;
    onClose: () => void;
    onImported: () => void;
}

type CsvSampleRow = {
    key: string;
    [key: string]: string;
};

export const TransactionImportModal = ({
    open,
    accountId,
    categories,
    currency,
    onClose,
    onImported,
}: TransactionImportModalProps) => {
    const { t } = useTranslation();

    const [importStep, setImportStep] = useState(0);
    const [importFormat, setImportFormat] = useState<ImportFileFormat>('CSV');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [csvMapping, setCsvMapping] = useState<CsvColumnMapping>({
        dateColumn: 0,
        amountColumn: 2,
        descriptionColumn: 1,
        typeColumn: null,
        dateFormat: 'yyyy-MM-dd',
        delimiter: ',',
        hasHeader: true,
    });
    const [csvSampleRows, setCsvSampleRows] = useState<string[][]>([]);
    const [previewResult, setPreviewResult] = useState<ImportPreviewResponse | null>(null);
    const [selectedImportHashes, setSelectedImportHashes] = useState<string[]>([]);
    const [defaultImportCategoryId, setDefaultImportCategoryId] = useState<string | undefined>(undefined);
    const [importResult, setImportResult] = useState<ImportResultResponse | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [confirmImportLoading, setConfirmImportLoading] = useState(false);

    const resetImportState = () => {
        setImportStep(0);
        setImportFormat('CSV');
        setImportFile(null);
        setCsvMapping({
            dateColumn: 0,
            amountColumn: 2,
            descriptionColumn: 1,
            typeColumn: null,
            dateFormat: 'yyyy-MM-dd',
            delimiter: ',',
            hasHeader: true,
        });
        setCsvSampleRows([]);
        setPreviewResult(null);
        setSelectedImportHashes([]);
        setDefaultImportCategoryId(undefined);
        setImportResult(null);
        setPreviewLoading(false);
        setConfirmImportLoading(false);
    };

    const parseCsvLine = (line: string, delimiter: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const next = line[i + 1];

            if (char === '"') {
                if (inQuotes && next === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (!inQuotes && char === delimiter) {
                result.push(current.trim());
                current = '';
                continue;
            }

            current += char;
        }

        result.push(current.trim());
        return result;
    };

    const readCsvSampleRows = async (file: File, delimiter: string) => {
        const text = await file.text();
        const parsedDelimiter = delimiter === '\t' ? '\t' : delimiter;
        const rows = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 12)
            .map(line => parseCsvLine(line, parsedDelimiter));

        setCsvSampleRows(rows);
    };

    const csvMaxColumns = useMemo(() => {
        const detected = csvSampleRows.reduce((max, row) => Math.max(max, row.length), 0);
        return Math.max(detected, 4);
    }, [csvSampleRows]);

    const csvColumnOptions = useMemo(() => {
        return Array.from({ length: csvMaxColumns }, (_, idx) => {
            const header = csvMapping.hasHeader ? csvSampleRows[0]?.[idx] : undefined;
            const label = header ? `${idx} - ${header}` : String(idx);
            return { value: idx, label };
        });
    }, [csvMaxColumns, csvMapping.hasHeader, csvSampleRows]);

    const csvPreviewData = useMemo(() => {
        const baseRows = csvMapping.hasHeader ? csvSampleRows.slice(1) : csvSampleRows;
        return baseRows.slice(0, 8).map((row, rowIndex) => {
            const record: CsvSampleRow = { key: `sample-${rowIndex}` };
            for (let colIndex = 0; colIndex < csvMaxColumns; colIndex++) {
                record[String(colIndex)] = row[colIndex] ?? '';
            }
            return record;
        });
    }, [csvSampleRows, csvMapping.hasHeader, csvMaxColumns]);

    const csvPreviewColumns = useMemo<ColumnsType<CsvSampleRow>>(() => {
        return Array.from({ length: csvMaxColumns }, (_, idx) => {
            const header = csvMapping.hasHeader ? csvSampleRows[0]?.[idx] : undefined;
            return {
                title: header || `#${idx}`,
                dataIndex: String(idx),
                key: `csv-col-${idx}`,
                ellipsis: true,
                render: (value: string) => value || '-',
            };
        });
    }, [csvMaxColumns, csvMapping.hasHeader, csvSampleRows]);

    const selectedPreviewCount = selectedImportHashes.length;

    const importPreviewColumns: ColumnsType<NonNullable<ImportPreviewResponse['transactions']>[number]> = [
        {
            title: t('transactions.data'),
            dataIndex: 'date',
            key: 'date',
            render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
        },
        {
            title: t('transactions.description'),
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: t('transactions.amount'),
            dataIndex: 'amount',
            key: 'amount',
            render: (value: number, record) => (
                <span style={{ color: record.type === 'IN' ? COLOR_POSITIVE : COLOR_NEGATIVE }}>
                    {value.toFixed(2)} {getCurrencySymbol(currency ?? 'EUR')}
                </span>
            ),
        },
        {
            title: t('transactions.type'),
            dataIndex: 'type',
            key: 'type',
            render: (value: 'IN' | 'OUT') => (
                <Tag color={value === 'IN' ? 'success' : 'error'}>
                    {value === 'IN' ? t('transactions.typeIn') : t('transactions.typeOut')}
                </Tag>
            ),
        },
        {
            title: t('transactions.import.duplicateColumn'),
            dataIndex: 'duplicate',
            key: 'duplicate',
            render: (duplicate: boolean) => (
                duplicate
                    ? <Tag color="warning">{t('transactions.import.duplicateYes')}</Tag>
                    : <Tag color="success">{t('transactions.import.duplicateNo')}</Tag>
            ),
        },
    ];

    const isValidCsvMapping = () => {
        const requiredColumns = [csvMapping.dateColumn, csvMapping.amountColumn, csvMapping.descriptionColumn];
        if (requiredColumns.some(col => Number.isNaN(col) || col < 0)) {
            return false;
        }

        const unique = new Set(requiredColumns);
        return unique.size === requiredColumns.length;
    };

    const handleRunImportPreview = async () => {
        if (!importFile) {
            message.error(t('transactions.import.fileRequired'));
            return;
        }

        if (importFormat === 'CSV' && !isValidCsvMapping()) {
            message.error(t('transactions.import.invalidMapping'));
            return;
        }

        setPreviewLoading(true);
        try {
            const response = importFormat === 'CSV'
                ? await api.previewCsvImport(accountId, importFile, csvMapping)
                : await api.previewOfxImport(accountId, importFile);

            const preview = response.data;
            setPreviewResult(preview);
            setSelectedImportHashes(preview.transactions.filter(tx => !tx.duplicate).map(tx => tx.importHash));
            setImportStep(1);
        } catch (error) {
            console.error('Failed to preview import', error);
            message.error(t('transactions.import.previewError'));
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!importFile || !previewResult) {
            message.error(t('transactions.import.previewRequired'));
            return;
        }

        if (selectedImportHashes.length === 0) {
            message.warning(t('transactions.import.selectAtLeastOne'));
            return;
        }

        setConfirmImportLoading(true);
        try {
            const confirmPayload = {
                selectedHashes: selectedImportHashes,
                defaultCategoryId: defaultImportCategoryId,
            };

            const response = importFormat === 'CSV'
                ? await api.confirmCsvImport(accountId, importFile, csvMapping, confirmPayload)
                : await api.confirmOfxImport(accountId, importFile, confirmPayload);

            setImportResult(response.data);
            setImportStep(2);
            message.success(t('transactions.import.completed'));
            onImported();
        } catch (error) {
            console.error('Failed to import transactions', error);
            message.error(t('transactions.import.confirmError'));
        } finally {
            setConfirmImportLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        resetImportState();
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        resetImportState();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (importFormat !== 'CSV' || !importFile) {
            setCsvSampleRows([]);
            return;
        }

        readCsvSampleRows(importFile, csvMapping.delimiter ?? ',').catch((error) => {
            console.error('Failed to parse CSV sample rows', error);
            setCsvSampleRows([]);
        });
    }, [importFormat, importFile, csvMapping.delimiter]);

    return (
        <Modal
            title={t('transactions.import.title')}
            open={open}
            onCancel={handleClose}
            width={900}
            destroyOnClose
            maskClosable={!previewLoading && !confirmImportLoading}
            footer={
                importStep === 0
                    ? [
                        <Button key="cancel" onClick={handleClose} disabled={previewLoading}>
                            {t('common.cancel')}
                        </Button>,
                        <Button key="preview" type="primary" icon={<FileSearchOutlined />} loading={previewLoading} onClick={handleRunImportPreview}>
                            {t('transactions.import.runPreview')}
                        </Button>,
                    ]
                    : importStep === 1
                        ? [
                            <Button
                                key="back"
                                onClick={() => {
                                    setImportStep(0);
                                    setImportResult(null);
                                }}
                                disabled={confirmImportLoading}
                            >
                                {t('transactions.import.backToSetup')}
                            </Button>,
                            <Button key="confirm" type="primary" loading={confirmImportLoading} onClick={handleConfirmImport}>
                                {t('transactions.import.confirmImport')}
                            </Button>,
                        ]
                        : [
                            <Button key="close" type="primary" onClick={handleClose}>
                                {t('common.close')}
                            </Button>,
                        ]
            }
        >
            <Steps
                current={importStep}
                style={{ marginBottom: 20 }}
                items={[
                    { title: t('transactions.import.stepSetup') },
                    { title: t('transactions.import.stepPreview') },
                    { title: t('transactions.import.stepResult') },
                ]}
            />

            {importStep === 0 && (
                <Flex vertical gap="middle">
                    <Form layout="vertical">
                        <Form.Item label={t('transactions.import.formatLabel')}>
                            <Radio.Group
                                value={importFormat}
                                onChange={(e) => {
                                    setImportFormat(e.target.value as ImportFileFormat);
                                    setImportFile(null);
                                    setPreviewResult(null);
                                    setSelectedImportHashes([]);
                                    setImportResult(null);
                                }}
                                optionType="button"
                                buttonStyle="solid"
                            >
                                <Radio.Button value="CSV">CSV</Radio.Button>
                                <Radio.Button value="OFX">OFX / QFX</Radio.Button>
                            </Radio.Group>
                        </Form.Item>

                        <Form.Item label={t('transactions.import.fileLabel')}>
                            <Input
                                type="file"
                                accept={importFormat === 'CSV' ? '.csv,text/csv' : '.ofx,.qfx,application/x-ofx,application/ofx'}
                                onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    setImportFile(file);
                                    setPreviewResult(null);
                                    setSelectedImportHashes([]);
                                    setImportResult(null);
                                }}
                            />
                        </Form.Item>
                    </Form>

                    {importFile && (
                        <Alert
                            type="info"
                            showIcon
                            message={t('transactions.import.fileSelected', { filename: importFile.name })}
                        />
                    )}

                    {importFormat === 'CSV' && (
                        <>
                            <Descriptions bordered size="small" column={1} title={t('transactions.import.csvMappingTitle')}>
                                <Descriptions.Item label={t('transactions.import.dateColumn')}>
                                    <Select
                                        value={csvMapping.dateColumn}
                                        onChange={(value) => setCsvMapping(prev => ({ ...prev, dateColumn: value }))}
                                        options={csvColumnOptions}
                                    />
                                </Descriptions.Item>
                                <Descriptions.Item label={t('transactions.import.amountColumn')}>
                                    <Select
                                        value={csvMapping.amountColumn}
                                        onChange={(value) => setCsvMapping(prev => ({ ...prev, amountColumn: value }))}
                                        options={csvColumnOptions}
                                    />
                                </Descriptions.Item>
                                <Descriptions.Item label={t('transactions.import.descriptionColumn')}>
                                    <Select
                                        value={csvMapping.descriptionColumn}
                                        onChange={(value) => setCsvMapping(prev => ({ ...prev, descriptionColumn: value }))}
                                        options={csvColumnOptions}
                                    />
                                </Descriptions.Item>
                                <Descriptions.Item label={t('transactions.import.typeColumn')}>
                                    <Select
                                        value={csvMapping.typeColumn ?? undefined}
                                        onChange={(value) => setCsvMapping(prev => ({ ...prev, typeColumn: value ?? null }))}
                                        options={csvColumnOptions}
                                        allowClear
                                        placeholder={t('transactions.import.optional')}
                                    />
                                </Descriptions.Item>
                                <Descriptions.Item label={t('transactions.import.dateFormat')}>
                                    <Input
                                        value={csvMapping.dateFormat}
                                        onChange={(event) => setCsvMapping(prev => ({ ...prev, dateFormat: event.target.value }))}
                                        placeholder="yyyy-MM-dd"
                                    />
                                </Descriptions.Item>
                                <Descriptions.Item label={t('transactions.import.delimiter')}>
                                    <Select
                                        value={csvMapping.delimiter}
                                        onChange={(value) => setCsvMapping(prev => ({ ...prev, delimiter: value }))}
                                        options={[
                                            { value: ',', label: ',' },
                                            { value: ';', label: ';' },
                                            { value: '\t', label: 'TAB' },
                                            { value: '|', label: '|' },
                                        ]}
                                    />
                                </Descriptions.Item>
                                <Descriptions.Item label={t('transactions.import.hasHeader')}>
                                    <Checkbox
                                        checked={csvMapping.hasHeader}
                                        onChange={(event) => setCsvMapping(prev => ({ ...prev, hasHeader: event.target.checked }))}
                                    >
                                        {t('common.yes')}
                                    </Checkbox>
                                </Descriptions.Item>
                            </Descriptions>

                            <Flex vertical gap={8}>
                                <Text strong>{t('transactions.import.csvSampleTitle')}</Text>
                                {csvPreviewData.length === 0 && (
                                    <Text type="secondary">{t('transactions.import.csvSampleEmpty')}</Text>
                                )}
                                {csvPreviewData.length > 0 && (
                                    <Table
                                        size="small"
                                        rowKey="key"
                                        columns={csvPreviewColumns}
                                        dataSource={csvPreviewData}
                                        pagination={false}
                                        scroll={{ x: true }}
                                    />
                                )}
                            </Flex>
                        </>
                    )}
                </Flex>
            )}

            {importStep === 1 && previewResult && (
                <Flex vertical gap="middle">
                    <Descriptions bordered size="small" column={3}>
                        <Descriptions.Item label={t('transactions.import.totalFound')}>{previewResult.total}</Descriptions.Item>
                        <Descriptions.Item label={t('transactions.import.duplicatesFound')}>{previewResult.duplicates}</Descriptions.Item>
                        <Descriptions.Item label={t('transactions.import.selectedToImport')}>{selectedPreviewCount}</Descriptions.Item>
                    </Descriptions>

                    <Alert
                        type="info"
                        showIcon
                        message={t('transactions.import.duplicatesInfo')}
                    />

                    <Table
                        size="small"
                        rowKey="importHash"
                        columns={importPreviewColumns}
                        dataSource={previewResult.transactions}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        rowSelection={{
                            selectedRowKeys: selectedImportHashes,
                            onChange: (keys) => setSelectedImportHashes(keys.map(String)),
                        }}
                    />

                    <Select
                        placeholder={t('transactions.import.defaultCategoryPlaceholder')}
                        value={defaultImportCategoryId}
                        onChange={(value) => setDefaultImportCategoryId(value)}
                        allowClear
                    >
                        {categories.map(category => (
                            <Option key={category.id} value={category.id}>{category.name}</Option>
                        ))}
                    </Select>
                </Flex>
            )}

            {importStep === 2 && importResult && (
                <Flex vertical gap="middle">
                    <Alert
                        type={importResult.errors > 0 ? 'warning' : 'success'}
                        showIcon
                        message={t('transactions.import.resultTitle')}
                        description={t('transactions.import.resultDescription')}
                    />
                    <Descriptions bordered size="small" column={3}>
                        <Descriptions.Item label={t('transactions.import.imported')}>{importResult.imported}</Descriptions.Item>
                        <Descriptions.Item label={t('transactions.import.skipped')}>{importResult.skipped}</Descriptions.Item>
                        <Descriptions.Item label={t('transactions.import.errors')}>{importResult.errors}</Descriptions.Item>
                    </Descriptions>
                </Flex>
            )}
        </Modal>
    );
};
