// src/pages/chat/ChatPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { App, Button, Drawer, Flex, List, Popconfirm, Spin, Tag, Typography, theme } from 'antd';
import { DeleteOutlined, EditOutlined, MenuOutlined, PlusOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { ChatSession } from '../../types/api';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { usePageTitle } from '../../hooks/usePageTitle';

const { TextArea } = Input;
const { Text } = Typography;

interface DisplayMessage {
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    createdAt: string;
    toolsUsed?: string[];
    isLoading?: boolean;
}

// Chip di suggerimento per lo stato vuoto — aiutano l'utente a iniziare
const SUGGESTION_KEYS = [
    'chat.suggestion1',
    'chat.suggestion2',
    'chat.suggestion3',
    'chat.suggestion4',
] as const;

export const ChatPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const { token } = theme.useToken();
    const { isMobile, isSmallMobile } = useBreakpoints();

    usePageTitle(t('chat.title'));

    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<TextAreaRef>(null);

    const scrollToBottom = useCallback((instant = false) => {
        messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    // Quando la tastiera virtuale si apre (iOS visualViewport), scrolla in fondo
    // così l'ultimo messaggio non rimane nascosto sotto la tastiera.
    useEffect(() => {
        if (!isMobile) return;
        const vv = window.visualViewport;
        if (!vv) return;
        const onResize = () => scrollToBottom(true);
        vv.addEventListener('resize', onResize);
        return () => vv.removeEventListener('resize', onResize);
    }, [isMobile, scrollToBottom]);

    const fetchSessions = useCallback(async () => {
        try {
            const res = await api.getChatSessions();
            setSessions(res.data);
        } catch {
            message.error(t('chat.loadError'));
        }
    }, [message, t]);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    const loadSessionMessages = useCallback(async (sessionId: string) => {
        setLoadingMessages(true);
        try {
            const res = await api.getChatSessionMessages(sessionId);
            const filtered: DisplayMessage[] = res.data
                .filter(m => m.role !== 'TOOL')
                .map(m => ({
                    id: m.id,
                    role: m.role as 'USER' | 'ASSISTANT',
                    content: m.content ?? '',
                    createdAt: m.createdAt,
                }));
            setMessages(filtered);
        } catch {
            message.error(t('chat.loadError'));
        } finally {
            setLoadingMessages(false);
        }
    }, [message, t]);

    const handleSelectSession = (sessionId: string) => {
        setActiveSessionId(sessionId);
        loadSessionMessages(sessionId);
        if (isMobile) setSidebarOpen(false);
    };

    const handleNewChat = () => {
        setActiveSessionId(null);
        setMessages([]);
        if (isMobile) setSidebarOpen(false);
    };

    const handleDeleteSession = async (sessionId: string) => {
        try {
            await api.deleteChatSession(sessionId);
            message.success(t('chat.deleteSuccess'));
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (activeSessionId === sessionId) {
                setActiveSessionId(null);
                setMessages([]);
            }
        } catch {
            message.error(t('chat.deleteError'));
        }
    };

    const handleSend = async (textOverride?: string) => {
        const text = (textOverride ?? inputText).trim();
        if (!text || sending) return;

        const tempBase = `temp-${Date.now()}`;
        const userMsg: DisplayMessage = {
            id: `${tempBase}-user`,
            role: 'USER',
            content: text,
            createdAt: new Date().toISOString(),
        };
        const loadingMsg: DisplayMessage = {
            id: `${tempBase}-loading`,
            role: 'ASSISTANT',
            content: '',
            createdAt: new Date().toISOString(),
            isLoading: true,
        };

        setMessages(prev => [...prev, userMsg, loadingMsg]);
        if (!textOverride) setInputText('');
        setSending(true);

        try {
            const res = await api.sendChatMessage({ sessionId: activeSessionId, message: text });
            const { sessionId, reply, toolsUsed } = res.data;

            if (!activeSessionId) {
                setActiveSessionId(sessionId);
                fetchSessions();
            }

            setMessages(prev =>
                prev.map(m =>
                    m.id === `${tempBase}-loading`
                        ? {
                            id: `${sessionId}-${Date.now()}`,
                            role: 'ASSISTANT' as const,
                            content: reply,
                            createdAt: new Date().toISOString(),
                            toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
                        }
                        : m
                )
            );
        } catch {
            message.error(t('chat.sendError'));
            setMessages(prev => prev.filter(m => m.id !== `${tempBase}-loading` && m.id !== `${tempBase}-user`));
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Su mobile Enter va a capo (comportamento naturale); solo su desktop invia senza Shift
        if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
            e.preventDefault();
            handleSend();
        }
    };

    // Chip di suggerimento: invia il testo al click (senza Shift+Enter)
    const handleSuggestion = (key: string) => {
        const text = t(key, { defaultValue: '' });
        if (text) handleSend(text);
    };

    const activeSession = sessions.find(s => s.id === activeSessionId);

    // Altezza del container: usa 100dvh (dynamic viewport height, si aggiorna con la tastiera iOS)
    // con fallback a 100vh per browser che non supportano dvh.
    const contentPadding = isMobile ? 12 : 24;
    const containerMargin = isSmallMobile
        ? '-12px -12px 0 -12px'
        : isMobile
            ? '-12px'
            : '-24px';

    // dvh si aggiorna quando la tastiera virtuale si apre/chiude (iOS 15.4+, Android Chrome).
    // Questo è il fix corretto per "l'input si nasconde sotto la tastiera".
    const containerHeight = isSmallMobile
        ? 'calc(100dvh - 180px - env(safe-area-inset-bottom, 0px))'
        : isMobile
            ? 'calc(100dvh - 96px)'
            : 'calc(100vh - 112px)';

    const sidebarContent = (
        <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '12px', flexShrink: 0 }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleNewChat}
                    block
                    size={isMobile ? 'large' : 'middle'}
                >
                    {t('chat.newChat')}
                </Button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                {sessions.length === 0 ? (
                    <Text
                        style={{
                            padding: '16px',
                            display: 'block',
                            color: token.colorTextSecondary,
                            fontSize: 12,
                            textAlign: 'center',
                        }}
                    >
                        {t('chat.noSessions')}
                    </Text>
                ) : (
                    <List
                        size="small"
                        dataSource={sessions}
                        renderItem={session => (
                            <List.Item
                                style={{
                                    padding: isMobile ? '12px 10px' : '8px 10px',
                                    cursor: 'pointer',
                                    background: activeSessionId === session.id
                                        ? token.colorPrimaryBg
                                        : 'transparent',
                                    borderRadius: 6,
                                    margin: '2px 6px',
                                    borderBottom: 'none',
                                    transition: 'background 0.15s',
                                    minHeight: 52, // touch target ≥ 44px
                                }}
                                onClick={() => handleSelectSession(session.id)}
                                actions={[
                                    <Popconfirm
                                        key="delete"
                                        title={t('chat.deleteConfirm')}
                                        onConfirm={e => {
                                            e?.stopPropagation();
                                            handleDeleteSession(session.id);
                                        }}
                                        onCancel={e => e?.stopPropagation()}
                                        okText={t('common.yes')}
                                        cancelText={t('common.no')}
                                        placement="right"
                                    >
                                        <Button
                                            type="text"
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={e => e.stopPropagation()}
                                            aria-label={t('chat.deleteSession')}
                                            style={{ minWidth: 32, minHeight: 32 }}
                                        />
                                    </Popconfirm>,
                                ]}
                            >
                                <List.Item.Meta
                                    title={
                                        <Text
                                            style={{
                                                fontSize: 13,
                                                fontWeight: activeSessionId === session.id ? 600 : 400,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                display: 'block',
                                                maxWidth: 160,
                                                color: token.colorText,
                                            }}
                                        >
                                            {session.title}
                                        </Text>
                                    }
                                    description={
                                        <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
                                            {dayjs(session.updatedAt).format('DD/MM/YY HH:mm')}
                                        </Text>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                )}
            </div>
        </Flex>
    );

    return (
        <div
            style={{
                display: 'flex',
                height: containerHeight,
                margin: containerMargin,
                overflow: 'hidden',
                borderRadius: token.borderRadiusLG,
            }}
        >
            {/* Desktop sidebar */}
            {!isMobile && (
                <div
                    style={{
                        width: 248,
                        borderRight: `1px solid ${token.colorBorderSecondary}`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        flexShrink: 0,
                    }}
                >
                    {sidebarContent}
                </div>
            )}

            {/* Mobile sidebar drawer */}
            {isMobile && (
                <Drawer
                    title={t('chat.sessionListTitle')}
                    placement="left"
                    open={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    width="85%"
                    styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
                >
                    {sidebarContent}
                </Drawer>
            )}

            {/* Main chat area */}
            <Flex vertical style={{ flex: 1, overflow: 'hidden' }}>

                {/* Mobile toolbar — hamburger + titolo sessione + bottone nuova chat */}
                {isMobile && (
                    <Flex
                        align="center"
                        gap="small"
                        style={{
                            padding: '0 8px',
                            height: 48,
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            flexShrink: 0,
                        }}
                    >
                        <Button
                            type="text"
                            icon={<MenuOutlined />}
                            onClick={() => setSidebarOpen(true)}
                            aria-label={t('chat.sessionListTitle')}
                            style={{ minWidth: 40, minHeight: 40 }}
                        />
                        <Flex align="center" gap={6} style={{ flex: 1, minWidth: 0 }}>
                            <RobotOutlined style={{ fontSize: 15, color: token.colorPrimary, flexShrink: 0 }} />
                            <Text
                                strong
                                style={{
                                    fontSize: 14,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {activeSession?.title ?? t('chat.title')}
                            </Text>
                        </Flex>
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={handleNewChat}
                            aria-label={t('chat.newChat')}
                            style={{ minWidth: 40, minHeight: 40, flexShrink: 0 }}
                            title={t('chat.newChat')}
                        />
                    </Flex>
                )}

                {/* Messages */}
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: contentPadding,
                        WebkitOverflowScrolling: 'touch',
                    } as React.CSSProperties}
                >
                    {loadingMessages ? (
                        <Flex justify="center" align="center" style={{ height: '100%' }}>
                            <Spin size="large" />
                        </Flex>
                    ) : messages.length === 0 ? (
                        <Flex
                            vertical
                            justify="center"
                            align="center"
                            gap={isMobile ? 12 : 16}
                            style={{ height: '100%', minHeight: 200 }}
                        >
                            <RobotOutlined style={{ fontSize: isMobile ? 44 : 56, color: token.colorTextQuaternary }} />
                            <Text
                                style={{
                                    color: token.colorTextSecondary,
                                    textAlign: 'center',
                                    maxWidth: 340,
                                    whiteSpace: 'pre-line',
                                    lineHeight: 1.6,
                                    fontSize: isMobile ? 13 : 14,
                                    padding: '0 8px',
                                }}
                            >
                                {t('chat.emptyState')}
                            </Text>

                            {/* Chip di suggerimento — mostrano all'utente cosa può chiedere */}
                            <Flex
                                wrap="wrap"
                                gap={8}
                                justify="center"
                                style={{ maxWidth: 360, padding: '0 8px' }}
                            >
                                {SUGGESTION_KEYS.map(key => {
                                    const label = t(key, { defaultValue: '' });
                                    if (!label) return null;
                                    return (
                                        <Button
                                            key={key}
                                            size="small"
                                            onClick={() => handleSuggestion(key)}
                                            disabled={sending}
                                            style={{
                                                borderRadius: 20,
                                                fontSize: 12,
                                                height: 'auto',
                                                padding: '6px 12px',
                                                whiteSpace: 'normal',
                                                textAlign: 'center',
                                                lineHeight: 1.4,
                                                maxWidth: isMobile ? '100%' : 200,
                                            }}
                                        >
                                            {label}
                                        </Button>
                                    );
                                })}
                            </Flex>
                        </Flex>
                    ) : (
                        <Flex vertical gap={isMobile ? 10 : 12}>
                            {messages.map(msg => (
                                <Flex
                                    key={msg.id}
                                    justify={msg.role === 'USER' ? 'flex-end' : 'flex-start'}
                                >
                                    <Flex
                                        vertical
                                        style={{
                                            // clamp() scala con il contenitore reale (non con vw),
                                            // così si adatta a qualsiasi larghezza senza breakpoint fissi.
                                            // USER: più stretto (i messaggi utente sono tipicamente brevi)
                                            // ASSISTANT: più largo (markdown, tabelle, liste)
                                            maxWidth: msg.role === 'USER'
                                                ? 'clamp(200px, 72%, 520px)'
                                                : 'clamp(260px, 88%, 740px)',
                                            alignItems: msg.role === 'USER' ? 'flex-end' : 'flex-start',
                                        }}
                                    >
                                        <div
                                            style={{
                                                background: msg.role === 'USER'
                                                    ? token.colorPrimary
                                                    : token.colorBgElevated,
                                                color: msg.role === 'USER' ? '#fff' : token.colorText,
                                                padding: isMobile ? '10px 13px' : '10px 14px',
                                                borderRadius: msg.role === 'USER'
                                                    ? '16px 16px 4px 16px'
                                                    : '16px 16px 16px 4px',
                                                boxShadow: token.boxShadowSecondary,
                                                lineHeight: 1.55,
                                                fontSize: isMobile ? 15 : 14,
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {msg.isLoading ? (
                                                <Flex align="center" gap={8}>
                                                    <Spin size="small" />
                                                    <Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                                                        NexaBot…
                                                    </Text>
                                                </Flex>
                                            ) : msg.role === 'ASSISTANT' ? (
                                                <div className="chat-markdown">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                                            )}
                                        </div>

                                        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                                            <Flex
                                                gap={4}
                                                wrap="wrap"
                                                style={{ marginTop: 4, paddingLeft: 4 }}
                                            >
                                                <Text style={{ fontSize: 10, color: token.colorTextTertiary }}>
                                                    {t('chat.toolsUsed')}:
                                                </Text>
                                                {msg.toolsUsed.map(tool => (
                                                    <Tag
                                                        key={tool}
                                                        style={{ fontSize: 10, margin: 0, padding: '0 5px', lineHeight: '18px' }}
                                                    >
                                                        {tool}
                                                    </Tag>
                                                ))}
                                            </Flex>
                                        )}

                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color: token.colorTextQuaternary,
                                                marginTop: 3,
                                                paddingLeft: 4,
                                                paddingRight: 4,
                                            }}
                                        >
                                            {dayjs(msg.createdAt).format('HH:mm')}
                                        </Text>
                                    </Flex>
                                </Flex>
                            ))}
                            <div ref={messagesEndRef} />
                        </Flex>
                    )}
                </div>

                {/* Input area */}
                <div
                    style={{
                        padding: isMobile ? '8px 10px' : '12px 16px',
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                        flexShrink: 0,
                        // Garantisce che l'area input stia sopra la tastiera su iOS
                        paddingBottom: isSmallMobile
                            ? 'max(8px, env(safe-area-inset-bottom, 8px))'
                            : isMobile ? '8px' : '12px',
                    }}
                >
                    <Flex gap={8} align="flex-end">
                        <TextArea
                            ref={textAreaRef}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isMobile ? t('chat.inputPlaceholderMobile', { defaultValue: 'Scrivi un messaggio…' }) : t('chat.inputPlaceholder')}
                            autoSize={{ minRows: 1, maxRows: isMobile ? 4 : 5 }}
                            disabled={sending}
                            // enterkeyhint="send" mostra il tasto "Invia" sulla tastiera iOS/Android
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            enterKeyHint="send"
                            style={{ flex: 1, resize: 'none', minHeight: 'unset', fontSize: isMobile ? 16 : 14 }}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={() => handleSend()}
                            disabled={!inputText.trim() || sending}
                            loading={sending}
                            style={{ height: 44, width: isMobile ? 44 : undefined, flexShrink: 0 }}
                        >
                            {!isMobile && t('chat.send')}
                        </Button>
                    </Flex>
                </div>
            </Flex>
        </div>
    );
};
