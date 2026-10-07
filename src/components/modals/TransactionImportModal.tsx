import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Checkbox,
    Descriptions,
    Flex,
    Form,
    message,
    Modal,
    Radio,
    Select,
    Steps,
    Table,
    Tag,
    Typography,
    Upload,
} from 'antd';
import { FileSearchOutlined, InboxOutlined } from '@ant-design/icons';
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
import { getSemanticColors } from '../../theme/tokens';
import { usePreferences } from '../../contexts/PreferencesContext';
import { formatMoney } from '../../utils/format';

const { Text } = Typography;

// Default pensati per gli export delle banche italiane (";" e date gg/mm/aaaa): prima erano
// "," e yyyy-MM-dd, quindi quasi ogni import richiedeva di correggere il mapping a mano.
const DEFAULT_CSV_MAPPING: CsvColumnMapping = {
    dateColumn: 0,
    amountColumn: 2,
    descriptionColumn: 1,
    typeColumn: null,
    dateFormat: 'dd/MM/yyyy',
    delimiter: ';',
    hasHeader: true,
};

const DELIMITERS = [';', ',', '\t', '|'] as const;

// Formati data supportati (pattern Java, letti dal backend) con l'equivalente Day.js per
// mostrare un esempio leggibile: prima il formato era un campo di testo libero.
const DATE_FORMATS: { java: string; dayjs: string; pattern: RegExp }[] = [
    { java: 'dd/MM/yyyy', dayjs: 'DD/MM/YYYY', pattern: /^\d{1,2}\/\d{1,2}\/\d{4}$/ },
    { java: 'dd-MM-yyyy', dayjs: 'DD-MM-YYYY', pattern: /^\d{1,2}-\d{1,2}-\d{4}$/ },
    { java: 'dd.MM.yyyy', dayjs: 'DD.MM.YYYY', pattern: /^\d{1,2}\.\d{1,2}\.\d{4}$/ },
    { java: 'dd/MM/yy', dayjs: 'DD/MM/YY', pattern: /^\d{1,2}\/\d{1,2}\/\d{2}$/ },
    { java: 'yyyy-MM-dd', dayjs: 'YYYY-MM-DD', pattern: /^\d{4}-\d{2}-\d{2}/ },
    { java: 'yyyyMMdd', dayjs: 'YYYYMMDD', pattern: /^\d{8}$/ },
    { java: 'MM/dd/yyyy', dayjs: 'MM/DD/YYYY', pattern: /^$/ }, // mai rilevato: ambiguo con dd/MM
];

/** Separatore più frequente fuori dalle virgolette nelle prime righe del file. */
const detectDelimiter = (lines: string[]): string => {
    const counts = new Map<string, number>(DELIMITERS.map(d => [d, 0]));
    for (const line of lines) {
        let inQuotes = false;
        for (const char of line) {
            if (char === '"') inQuotes = !inQuotes;
            else if (!inQuotes && counts.has(char)) counts.set(char, (counts.get(char) ?? 0) + 1);
        }
    }
    let best: string = DEFAULT_CSV_MAPPING.delimiter ?? ';';
    let bestCount = 0;
    counts.forEach((count, delimiter) => {
        if (count > bestCount) {
            best = delimiter;
            bestCount = count;
        }
    });
    return best;
};

/** Primo formato che riconosce il valore; dd/MM ha la precedenza su MM/dd (banche italiane). */
const detectDateFormat = (value: string | undefined): string | undefined =>
    value ? DATE_FORMATS.find(f => f.pattern.test(value.trim()))?.java : undefined;

const errorMessage = (error: unknown): string | undefined => {
    const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
    return typeof data?.message === 'string' ? data.message : undefined;
};

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
    const { preferences } = usePreferences();
    const semantic = getSemanticColors(preferences.theme === 'dark');

    const [importStep, setImportStep] = useState(0);
    const [importFormat, setImportFormat] = useState<ImportFileFormat>('CSV');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [csvMapping, setCsvMapping] = useState<CsvColumnMapping>(DEFAULT_CSV_MAPPING);
    const [csvSampleRows, setCsvSampleRows] = useState<string[][]>([]);
    const [previewResult, setPreviewResult] = useState<ImportPreviewResponse | null>(null);
    const [selectedImportHashes, setSelectedImportHashes] = useState<string[]>([]);
    const [defaultImportCategoryId, setDefaultImportCategoryId] = useState<string | undefined>(undefined);
    const [importResult, setImportResult] = useState<ImportResultResponse | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [confirmImportLoading, setConfirmImportLoading] = useState(false);
    const [autoDetected, setAutoDetected] = useState(false);
    // Data d'esempio per le opzioni del formato (31 dicembre: giorno e mese non ambigui).
    const [dateExample] = useState(() => dayjs().month(11).date(31));

    const resetImportState = () => {
        setImportStep(0);
        setImportFormat('CSV');
        setImportFile(null);
        setCsvMapping(DEFAULT_CSV_MAPPING);
        setCsvSampleRows([]);
        setPreviewResult(null);
        setSelectedImportHashes([]);
        setDefaultImportCategoryId(undefined);
        setImportResult(null);
        setPreviewLoading(false);
        setConfirmImportLoading(false);
        setAutoDetected(false);
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
        // Le colonne mappate sono marcate nell'anteprima, così si vede subito se il mapping
        // punta ai dati giusti.
        const roles = new Map<number, string>([
            [csvMapping.dateColumn, t('transactions.import.roleDate')],
            [csvMapping.amountColumn, t('transactions.import.roleAmount')],
            [csvMapping.descriptionColumn, t('transactions.import.roleDescription')],
            ...(csvMapping.typeColumn != null ? [[csvMapping.typeColumn, t('transactions.import.roleType')] as [number, string]] : []),
        ]);
        return Array.from({ length: csvMaxColumns }, (_, idx) => {
            const header = csvMapping.hasHeader ? csvSampleRows[0]?.[idx] : undefined;
            const role = roles.get(idx);
            return {
                title: (
                    <Flex vertical gap={2}>
                        <span>{header || `#${idx}`}</span>
                        {role && <Tag color="blue" style={{ margin: 0, width: 'fit-content' }}>{role}</Tag>}
                    </Flex>
                ),
                dataIndex: String(idx),
                key: `csv-col-${idx}`,
                ellipsis: true,
                render: (value: string) => value || '-',
            };
        });
    }, [csvMaxColumns, csvMapping, csvSampleRows, t]);

    const selectedPreviewCount = selectedImportHashes.length;

    // Descrizione senza larghezza: prende lo spazio rimanente in ellissi, così le descrizioni
    // bancarie lunghe non allargano la tabella oltre il modale. Data e tipo spariscono sugli
    // schermi stretti (il tipo è già nel colore dell'importo).
    const importPreviewColumns: ColumnsType<NonNullable<ImportPreviewResponse['transactions']>[number]> = [
        {
            title: t('transactions.data'),
            dataIndex: 'date',
            key: 'date',
            width: 110,
            responsive: ['sm'],
            render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
        },
        {
            title: t('transactions.description'),
            dataIndex: 'description',
            key: 'description',
            ellipsis: { showTitle: true },
        },
        {
            title: t('transactions.amount'),
            dataIndex: 'amount',
            key: 'amount',
            width: 120,
            render: (value: number, record) => (
                <span style={{ color: record.type === 'IN' ? semantic.positive : semantic.negative }}>
                    {formatMoney(value, currency ?? 'EUR')}
                </span>
            ),
        },
        {
            title: t('transactions.type'),
            dataIndex: 'type',
            key: 'type',
            width: 90,
            responsive: ['md'],
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
            width: 100,
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
            const detail = errorMessage(error);
            message.error(detail ? `${t('transactions.import.previewError')} ${detail}` : t('transactions.import.previewError'));
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!importFile || !previewResult) {
            message.error(t('transactions.import.previewRequired'));
            return;
        }

        // Il backend tratta `selectedHashes` vuoto come "importa tutte le righe non
        // duplicate": con zero righe selezionate la conferma non deve mai partire.
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
            const detail = errorMessage(error);
            message.error(detail ? `${t('transactions.import.confirmError')} ${detail}` : t('transactions.import.confirmError'));
        } finally {
            setConfirmImportLoading(false);
        }
    };

    // Alla scelta del file CSV: separatore e formato data vengono dedotti dalle prime righe.
    const handleFileSelected = async (file: File) => {
        setImportFile(file);
        setPreviewResult(null);
        setSelectedImportHashes([]);
        setImportResult(null);
        setAutoDetected(false);
        if (importFormat !== 'CSV') return;
        try {
            const lines = (await file.text()).split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 12);
            if (lines.length === 0) return;
            const delimiter = detectDelimiter(lines);
            const rows = lines.map(line => parseCsvLine(line, delimiter));
            const firstDataRow = csvMapping.hasHeader ? rows[1] : rows[0];
            const dateFormat = detectDateFormat(firstDataRow?.[csvMapping.dateColumn]);
            setCsvMapping(prev => ({ ...prev, delimiter, ...(dateFormat ? { dateFormat } : {}) }));
            setAutoDetected(true);
        } catch (error) {
            console.error('Failed to inspect CSV file', error);
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
            destroyOnHidden
            mask={{ closable: !previewLoading && !confirmImportLoading }}
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
                            <Button
                                key="confirm"
                                type="primary"
                                loading={confirmImportLoading}
                                disabled={selectedPreviewCount === 0}
                                title={selectedPreviewCount === 0 ? t('transactions.import.selectAtLeastOne') : undefined}
                                onClick={handleConfirmImport}
                            >
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
                            {/* Dragger: trascina il file o tocca per sceglierlo. beforeUpload
                                restituisce false: il file resta in memoria, nessun upload automatico. */}
                            <Upload.Dragger
                                accept={importFormat === 'CSV' ? '.csv,text/csv' : '.ofx,.qfx,application/x-ofx,application/ofx'}
                                maxCount={1}
                                showUploadList={false}
                                beforeUpload={(file) => {
                                    void handleFileSelected(file);
                                    return false;
                                }}
                            >
                                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                                <p className="ant-upload-text">
                                    {importFile
                                        ? t('transactions.import.fileSelected', { filename: importFile.name })
                                        : t('transactions.import.dropHint')}
                                </p>
                            </Upload.Dragger>
                        </Form.Item>
                    </Form>

                    {autoDetected && (
                        <Alert type="info" showIcon title={t('transactions.import.autoDetected')} />
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
                                    <Select
                                        value={csvMapping.dateFormat}
                                        onChange={(value) => setCsvMapping(prev => ({ ...prev, dateFormat: value }))}
                                        options={DATE_FORMATS.map(f => ({
                                            value: f.java,
                                            label: `${f.java} — ${dateExample.format(f.dayjs)}`,
                                        }))}
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
                    <Descriptions bordered size="small" column={{ xs: 1, sm: 3 }}>
                        <Descriptions.Item label={t('transactions.import.totalFound')}>{previewResult.total}</Descriptions.Item>
                        <Descriptions.Item label={t('transactions.import.duplicatesFound')}>{previewResult.duplicates}</Descriptions.Item>
                        <Descriptions.Item label={t('transactions.import.selectedToImport')}>{selectedPreviewCount}</Descriptions.Item>
                    </Descriptions>

                    <Alert
                        type="info"
                        showIcon
                        title={t('transactions.import.duplicatesInfo')}
                    />

                    {selectedPreviewCount === 0 && (
                        <Alert type="warning" showIcon title={t('transactions.import.selectAtLeastOne')} />
                    )}

                    <Table
                        size="small"
                        rowKey="importHash"
                        tableLayout="fixed"
                        columns={importPreviewColumns}
                        dataSource={previewResult.transactions}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        rowSelection={{
                            selectedRowKeys: selectedImportHashes,
                            onChange: (keys) => setSelectedImportHashes(keys.map(String)),
                        }}
                    />

                    <Form layout="vertical">
                        <Form.Item
                            label={t('transactions.import.defaultCategoryLabel')}
                            extra={t('transactions.import.defaultCategoryHelp')}
                            style={{ marginBottom: 0 }}
                        >
                            <Select
                                placeholder={t('transactions.import.defaultCategoryPlaceholder')}
                                value={defaultImportCategoryId}
                                onChange={(value) => setDefaultImportCategoryId(value)}
                                allowClear
                                options={categories.map(c => ({ value: c.id, label: c.name }))}
                                showSearch={{ optionFilterProp: 'label' }}
                            />
                        </Form.Item>
                    </Form>
                </Flex>
            )}

            {importStep === 2 && importResult && (
                <Flex vertical gap="middle">
                    <Alert
                        type={importResult.errors > 0 ? 'warning' : 'success'}
                        showIcon
                        title={t('transactions.import.resultTitle')}
                        description={t('transactions.import.resultDescription')}
                    />
                    <Descriptions bordered size="small" column={{ xs: 1, sm: 3 }}>
                        <Descriptions.Item label={t('transactions.import.imported')}>{importResult.imported}</Descriptions.Item>
                        <Descriptions.Item label={t('transactions.import.skipped')}>{importResult.skipped}</Descriptions.Item>
                        <Descriptions.Item label={t('transactions.import.errors')}>{importResult.errors}</Descriptions.Item>
                    </Descriptions>
                </Flex>
            )}
        </Modal>
    );
};
