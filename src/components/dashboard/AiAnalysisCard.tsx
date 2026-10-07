import React, { useState, useEffect, useRef } from 'react';
import { App, Card, Button, DatePicker, Typography, Spin, Space, Flex, theme } from 'antd';
import { RobotOutlined, DownloadOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dayjs, { Dayjs } from 'dayjs';
import { getRangePresets } from '../../utils/datePresets';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePreferences } from '../../contexts/PreferencesContext';
import { RADIUS, SPACING } from '../../theme/tokens';
import { getApiErrorMessage, getApiErrorStatus } from '../../utils/apiError';

const AI_CARD_GRADIENT_LIGHT = 'linear-gradient(135deg, oklch(96% 0.02 260), oklch(93% 0.03 250))';
const AI_CARD_GRADIENT_DARK = 'linear-gradient(135deg, oklch(24% 0.02 260), oklch(28% 0.03 250))';
const AI_CARD_BORDER_LIGHT = 'oklch(88% 0.03 250)';
const AI_CARD_BORDER_DARK = 'oklch(32% 0.03 250)';
import { DatePresetPicker } from '../common/DatePresetPicker';

const { RangePicker } = DatePicker;

// 3 s erano fino a 100 richieste per analisi su un job che dura decine di secondi.
const AI_ANALYSIS_POLL_INTERVAL_MS = 5_000;
const AI_ANALYSIS_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const { Title, Text } = Typography;

// Preset condivisi (utils/datePresets): stessi intervalli della dashboard e dei report.
const PRESETS = (t: (k: string) => string) =>
    getRangePresets(t, ['last7Days', 'thisMonth', 'last6Months', 'last12Months']);

export const AiAnalysisCard: React.FC = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const { preferences } = usePreferences();
    const { token } = theme.useToken();
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    // By default, let's select "lastMonth" as a nice starting point, but user starts with null null originally.
    // Let's keep it null null to avoid triggering generation accidentally on mount.
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
    
    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [completedJobId, setCompletedJobId] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);

    // Data massima selezionabile: fine del mese corrente
    const maxDate = dayjs().endOf('month').format('YYYY-MM-DD');

    const handleGenerate = async () => {
        if (!dateRange[0] || !dateRange[1]) {
            message.warning(t('dashboard.aiAnalysis.invalidRange'));
            return;
        }

        const start = dateRange[0];
        const end = dateRange[1];

        if (end.diff(start, 'month', true) > 12) {
            message.error(t('dashboard.aiAnalysis.maxRange'));
            return;
        }

        try {
            setLoading(true);
            setResult(null);
            setCompletedJobId(null);
            const res = await api.requestAiAnalysis({
                startDate: start.format('YYYY-MM-DD'),
                endDate: end.format('YYYY-MM-DD'),
                userLanguage: preferences.language
            });
            const { jobId: newJobId, status, content } = res.data;
            if (status === 'COMPLETED') {
                // 200 + COMPLETED: report già in cache per periodo e lingua. Niente polling:
                // risultato e download sono subito disponibili. Se la POST non porta il
                // contenuto, lo si legge una volta dallo stato del job.
                const text = content ?? (await api.getAiAnalysisStatus(newJobId)).data.content;
                setResult(text || t('dashboard.aiAnalysis.emptyResult'));
                setCompletedJobId(newJobId);
                setLoading(false);
            } else if (status === 'FAILED') {
                message.error(t('dashboard.aiAnalysis.failed'));
                setLoading(false);
            } else {
                setJobId(newJobId);
            }
        } catch (error: unknown) {
            setLoading(false);
            const status = getApiErrorStatus(error);
            if (status === 403) {
                message.error(t('dashboard.aiAnalysis.expired'));
            } else if (status === 400) {
                message.error(getApiErrorMessage(error) ?? t('dashboard.aiAnalysis.invalidRequest'));
            } else {
                message.error(getApiErrorMessage(error) ?? t('dashboard.aiAnalysis.errorRequest'));
            }
        }
    };

    // `loading`, `t` e `message` letti da ref e non dalle dipendenze: erano fra le deps
    // dell'effetto, ma `loading` viene modificato dall'effetto stesso e `t` cambia al
    // cambio lingua — quindi intervallo e timeout venivano distrutti e ricreati,
    // azzerando ogni volta il tetto di sicurezza dei 5 minuti.
    const loadingRef = useRef(loading);
    const tRef = useRef(t);
    const messageRef = useRef(message);
    // Assegnazione in effetto, non in render: i ref non si possono scrivere durante il
    // render (react-hooks/refs). Stesso pattern di useAccountSync.
    useEffect(() => {
        loadingRef.current = loading;
        tRef.current = t;
        messageRef.current = message;
    });

    useEffect(() => {
        if (!jobId) return;

        const interval = setInterval(async () => {
            // Niente richieste mentre la tab è in background.
            if (document.hidden) return;
            try {
                const res = await api.getAiAnalysisStatus(jobId);
                const { status, content } = res.data;

                if (status === 'COMPLETED') {
                    setResult(content || tRef.current('dashboard.aiAnalysis.emptyResult'));
                    setLoading(false);
                    setCompletedJobId(jobId);
                    setJobId(null);
                    clearInterval(interval);
                } else if (status === 'FAILED') {
                    messageRef.current.error(tRef.current('dashboard.aiAnalysis.failed'));
                    setLoading(false);
                    setJobId(null);
                    clearInterval(interval);
                }
            } catch (error) {
                console.error(error);
                // 403: il job non è dell'utente o le sue informazioni sono scadute. Ritentare
                // non serve: si ferma il polling e si chiede di rigenerare il report.
                if (getApiErrorStatus(error) === 403) {
                    messageRef.current.error(tRef.current('dashboard.aiAnalysis.expired'));
                    setLoading(false);
                    setJobId(null);
                    clearInterval(interval);
                }
                // Altri errori (rete): il polling continua fino al timeout.
            }
        }, AI_ANALYSIS_POLL_INTERVAL_MS);

        // Timeout di sicurezza
        const timeout = setTimeout(() => {
            clearInterval(interval);
            if (loadingRef.current) {
                messageRef.current.error(tRef.current('dashboard.aiAnalysis.timeout'));
                setLoading(false);
                setJobId(null);
            }
        }, AI_ANALYSIS_POLL_TIMEOUT_MS);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [jobId]);

    const handleDownload = async () => {
        if (!completedJobId) return;
        try {
            const response = await api.downloadAiAnalysis(completedJobId);
            
            let filename = 'ai_report.md';
            const disposition = response.headers['content-disposition'];
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }
            
            const contentType = response.headers['content-type'];
            const blob = new Blob([response.data as BlobPart], { type: typeof contentType === 'string' ? contentType : 'text/markdown' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            if (getApiErrorStatus(error) === 403) {
                // Job scaduto: il download non tornerà disponibile, va rigenerato.
                setCompletedJobId(null);
                message.error(t('dashboard.aiAnalysis.expired'));
            } else {
                message.error(t('dashboard.aiAnalysis.downloadError'));
            }
        }
    };

    const isDark = preferences.theme === 'dark';

    return (
        <Card
            style={{
                background: isDark ? AI_CARD_GRADIENT_DARK : AI_CARD_GRADIENT_LIGHT,
                borderColor: isDark ? AI_CARD_BORDER_DARK : AI_CARD_BORDER_LIGHT,
            }}
            title={
                <Space>
                    <RobotOutlined style={{ color: token.colorPrimary }} />
                    <span>{t('dashboard.aiAnalysis.title')}</span>
                </Space>
            }
        >
            <Space orientation="vertical" style={{ width: '100%' }}>
                <Text type="secondary">
                    {t('dashboard.aiAnalysis.description')}
                </Text>
                
                {isMobile ? (
                    // Su mobile: chip + bottone in colonna separata, nessun overflow condiviso
                    <Flex vertical gap={10}>
                        <DatePresetPicker
                            presets={PRESETS(t)}
                            value={dateRange}
                            onChange={setDateRange}
                            customLabel={t('dashboard.presets.custom')}
                            startPlaceholder={t('dashboard.aiAnalysis.startDate')}
                            endPlaceholder={t('dashboard.aiAnalysis.endDate')}
                            disabled={loading}
                            maxDate={maxDate}
                        />
                        <Button
                            type="primary"
                            icon={<RobotOutlined />}
                            onClick={handleGenerate}
                            loading={loading}
                            disabled={!dateRange[0] || !dateRange[1]}
                            block
                        >
                            {t('dashboard.aiAnalysis.button')}
                        </Button>
                    </Flex>
                ) : (
                    <Flex gap={8} align="center" wrap="wrap">
                        <RangePicker
                            value={dateRange}
                            onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
                            disabledDate={(current: Dayjs) => current.isAfter(dayjs().endOf('month'), 'day')}
                            disabled={loading}
                            style={{ flex: 1 }}
                           
                            presets={PRESETS(t)}
                        />
                        <Button
                            type="primary"
                            icon={<RobotOutlined />}
                            onClick={handleGenerate}
                            loading={loading}
                            disabled={!dateRange[0] || !dateRange[1]}
                        >
                            {t('dashboard.aiAnalysis.button')}
                        </Button>
                    </Flex>
                )}

                {loading && (
                    <div style={{ textAlign: 'center', margin: `${SPACING.lg}px 0` }}>
                        <Spin size="large" />
                        <Title level={5} style={{ marginTop: SPACING.md }}>
                            {t('dashboard.aiAnalysis.analyzingTitle')}
                        </Title>
                        <Text type="secondary">{t('dashboard.aiAnalysis.analyzingSub')}</Text>
                    </div>
                )}

                {result && !loading && (
                    <div style={{ marginTop: SPACING.md, padding: SPACING.md, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: RADIUS.lg }}>
                        {completedJobId && (
                            <Flex justify="flex-end" style={{ marginBottom: SPACING.md }}>
                                <Button type="default" icon={<DownloadOutlined />} onClick={handleDownload}>
                                    {t('dashboard.aiAnalysis.downloadReport')}
                                </Button>
                            </Flex>
                        )}
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {result}
                        </ReactMarkdown>
                    </div>
                )}
            </Space>
        </Card>
    );
};
