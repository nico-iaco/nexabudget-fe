import React, { useState, useEffect } from 'react';
import { Card, Button, DatePicker, Typography, Spin, Space, message, Flex, Select } from 'antd';
import { RobotOutlined, DownloadOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { COLOR_ACCENT } from '../../theme/tokens';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const PRESETS = (t: (k: string) => string) => [
    { label: t('dashboard.presets.lastWeek'), value: [dayjs().subtract(1, 'week').startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
    { label: t('dashboard.presets.lastMonth'), value: [dayjs().startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
    { label: t('dashboard.presets.last6Months'), value: [dayjs().subtract(6, 'month').startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
    { label: t('dashboard.presets.lastYear'), value: [dayjs().subtract(1, 'year').startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
];

export const AiAnalysisCard: React.FC = () => {
    const { t } = useTranslation();
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    // By default, let's select "lastMonth" as a nice starting point, but user starts with null null originally.
    // Let's keep it null null to avoid triggering generation accidentally on mount.
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [completedJobId, setCompletedJobId] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);

    const disabledDate = (current: Dayjs) => {
        if (!current) return false;
        return current.isAfter(dayjs().endOf('month'), 'day');
    };

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
                endDate: end.format('YYYY-MM-DD')
            });
            setJobId(res.data.jobId);
        } catch (error: any) {
            setLoading(false);
            if (error.response?.status === 400) {
                message.error(t('dashboard.aiAnalysis.invalidRequest'));
            } else {
                message.error(t('dashboard.aiAnalysis.errorRequest'));
            }
        }
    };

    useEffect(() => {
        if (!jobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await api.getAiAnalysisStatus(jobId);
                const { status, content } = res.data;

                if (status === 'COMPLETED') {
                    setResult(content || t('dashboard.aiAnalysis.emptyResult'));
                    setLoading(false);
                    setCompletedJobId(jobId);
                    setJobId(null);
                    clearInterval(interval);
                } else if (status === 'FAILED') {
                    message.error(t('dashboard.aiAnalysis.failed'));
                    setLoading(false);
                    setJobId(null);
                    clearInterval(interval);
                }
            } catch (error) {
                console.error(error);
                // Non fermo il polling al primo errore di rete, ma potrei aggiungere un contatore di retry.
            }
        }, 3000);

        // Timeout di sicurezza (es. 5 minuti = 300000 ms)
        const timeout = setTimeout(() => {
            clearInterval(interval);
            if (loading) {
                message.error(t('dashboard.aiAnalysis.timeout'));
                setLoading(false);
                setJobId(null);
            }
        }, 300000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [jobId, loading, t]);

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
            message.error(t('dashboard.aiAnalysis.downloadError'));
        }
    };

    return (
        <Card title={
            <Space>
                <RobotOutlined style={{ color: COLOR_ACCENT }} />
                <span>{t('dashboard.aiAnalysis.title')}</span>
            </Space>
        }>
            <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">
                    {t('dashboard.aiAnalysis.description')}
                </Text>
                
                <Flex gap={8} vertical={isMobile} align={isMobile ? 'stretch' : 'center'} wrap="wrap">
                    {isMobile ? (
                        <Flex vertical gap={8} style={{ flex: 1 }}>
                            <Select
                                value={showCustomPicker ? 'custom' : (PRESETS(t).findIndex(p =>
                                    dateRange?.[0]?.isSame(p.value[0], 'day') &&
                                    dateRange?.[1]?.isSame(p.value[1], 'day')
                                ) === -1 && (!dateRange[0] && !dateRange[1]) ? undefined : (
                                    PRESETS(t).findIndex(p =>
                                        dateRange?.[0]?.isSame(p.value[0], 'day') &&
                                        dateRange?.[1]?.isSame(p.value[1], 'day')
                                    ) !== -1 ? PRESETS(t).findIndex(p =>
                                        dateRange?.[0]?.isSame(p.value[0], 'day') &&
                                        dateRange?.[1]?.isSame(p.value[1], 'day')
                                    ) : 'custom'
                                ))}
                                onChange={(idx: number | 'custom') => {
                                    if (idx === 'custom') {
                                        setShowCustomPicker(true);
                                        setDateRange([null, null]);
                                    } else {
                                        setShowCustomPicker(false);
                                        setDateRange(PRESETS(t)[idx].value);
                                    }
                                }}
                                placeholder={t('dashboard.presets.custom')}
                                style={{ width: '100%' }}
                                disabled={loading}
                                options={[
                                    ...PRESETS(t).map((p, i) => ({ value: i, label: p.label })),
                                    { value: 'custom', label: t('dashboard.presets.custom') },
                                ]}
                            />
                            {showCustomPicker && (
                                <Flex gap={8}>
                                    <DatePicker
                                        value={dateRange?.[0] ?? null}
                                        onChange={d => setDateRange([d, dateRange?.[1] ?? null])}
                                        disabledDate={disabledDate}
                                        disabled={loading}
                                        placeholder={t('dashboard.aiAnalysis.startDate')}
                                        style={{ flex: 1 }}
                                    />
                                    <DatePicker
                                        value={dateRange?.[1] ?? null}
                                        onChange={d => setDateRange([dateRange?.[0] ?? null, d])}
                                        disabledDate={disabledDate}
                                        disabled={loading}
                                        placeholder={t('dashboard.aiAnalysis.endDate')}
                                        style={{ flex: 1 }}
                                    />
                                </Flex>
                            )}
                        </Flex>
                    ) : (
                        <RangePicker
                            value={dateRange as any}
                            onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
                            disabledDate={disabledDate}
                            disabled={loading}
                            style={{ flex: 1 }}
                            presets={PRESETS(t)}
                        />
                    )}
                    <Button 
                        type="primary" 
                        icon={<RobotOutlined />} 
                        onClick={handleGenerate} 
                        loading={loading}
                        disabled={!dateRange[0] || !dateRange[1]}
                        style={isMobile ? { width: '100%' } : {}}
                    >
                        {t('dashboard.aiAnalysis.button')}
                    </Button>
                </Flex>

                {loading && (
                    <div style={{ textAlign: 'center', margin: '24px 0' }}>
                        <Spin size="large" />
                        <Title level={5} style={{ marginTop: 16 }}>
                            {t('dashboard.aiAnalysis.analyzingTitle')}
                        </Title>
                        <Text type="secondary">{t('dashboard.aiAnalysis.analyzingSub')}</Text>
                    </div>
                )}

                {result && !loading && (
                    <div style={{ marginTop: 16, padding: 16, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                        <Flex justify="flex-end" style={{ marginBottom: 16 }}>
                            <Button type="default" icon={<DownloadOutlined />} onClick={handleDownload}>
                                {t('dashboard.aiAnalysis.downloadReport')}
                            </Button>
                        </Flex>
                        <ReactMarkdown>
                            {result}
                        </ReactMarkdown>
                    </div>
                )}
            </Space>
        </Card>
    );
};
