// src/pages/chat/ChatPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { App, Button, Drawer, Flex, List, Popconfirm, Spin, Tag, Typography, theme } from 'antd';
import { DeleteOutlined, MenuOutlined, PlusOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
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

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const fetchSessions = useCallback(async () => {
        try {
            const res = await api.getChatSessions();
            setSessions(res.data);
        } catch {
            message.error(t('chat.loadError'));
        }
    }, [message, t]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

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

    const handleSend = async () => {
        const text = inputText.trim();
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
        setInputText('');
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
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Height and margin calculations to fill the Content area edge-to-edge.
    // For small mobile: do NOT negate the bottom padding (72px + safe area) because
    // that space is reserved for the fixed bottom nav bar. Instead only negate
    // top/left/right padding and compute height to stop above the nav bar.
    const contentPadding = isMobile ? 12 : 24;
    const containerMargin = isSmallMobile
        ? '-12px -12px 0 -12px'
        : isMobile
            ? '-12px'
            : '-24px';
    const containerHeight = isSmallMobile
        ? 'calc(100vh - 180px - env(safe-area-inset-bottom, 0px))'
        : isMobile
            ? 'calc(100vh - 96px)'
            : 'calc(100vh - 112px)';

    const sidebarContent = (
        <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '12px', flexShrink: 0 }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleNewChat}
                    block
                >
                    {t('chat.newChat')}
                </Button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
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
                                    padding: '8px 10px',
                                    cursor: 'pointer',
                                    background: activeSessionId === session.id
                                        ? token.colorPrimaryBg
                                        : 'transparent',
                                    borderRadius: 6,
                                    margin: '2px 6px',
                                    borderBottom: 'none',
                                    transition: 'background 0.15s',
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
                                                maxWidth: 150,
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
                    width={280}
                    styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
                >
                    {sidebarContent}
                </Drawer>
            )}

            {/* Main chat area */}
            <Flex vertical style={{ flex: 1, overflow: 'hidden' }}>
                {/* Mobile toolbar */}
                {isMobile && (
                    <Flex
                        align="center"
                        gap="small"
                        style={{
                            padding: '8px 12px',
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            flexShrink: 0,
                        }}
                    >
                        <Button
                            type="text"
                            icon={<MenuOutlined />}
                            onClick={() => setSidebarOpen(true)}
                            size="small"
                        />
                        <RobotOutlined style={{ fontSize: 16, color: token.colorPrimary }} />
                        <Text strong style={{ fontSize: 14 }}>NexaBot</Text>
                    </Flex>
                )}

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: contentPadding }}>
                    {loadingMessages ? (
                        <Flex justify="center" align="center" style={{ height: '100%' }}>
                            <Spin size="large" />
                        </Flex>
                    ) : messages.length === 0 ? (
                        <Flex
                            vertical
                            justify="center"
                            align="center"
                            gap={16}
                            style={{ height: '100%', minHeight: 200 }}
                        >
                            <RobotOutlined
                                style={{ fontSize: 56, color: token.colorTextQuaternary }}
                            />
                            <Text
                                style={{
                                    color: token.colorTextSecondary,
                                    textAlign: 'center',
                                    maxWidth: 380,
                                    whiteSpace: 'pre-line',
                                    lineHeight: 1.6,
                                }}
                            >
                                {t('chat.emptyState')}
                            </Text>
                        </Flex>
                    ) : (
                        <Flex vertical gap={12}>
                            {messages.map(msg => (
                                <Flex
                                    key={msg.id}
                                    justify={msg.role === 'USER' ? 'flex-end' : 'flex-start'}
                                >
                                    <Flex
                                        vertical
                                        style={{
                                            maxWidth: isMobile ? '88%' : '72%',
                                            alignItems: msg.role === 'USER' ? 'flex-end' : 'flex-start',
                                        }}
                                    >
                                        <div
                                            style={{
                                                background: msg.role === 'USER'
                                                    ? token.colorPrimary
                                                    : token.colorBgElevated,
                                                color: msg.role === 'USER' ? '#fff' : token.colorText,
                                                padding: '10px 14px',
                                                borderRadius: msg.role === 'USER'
                                                    ? '16px 16px 4px 16px'
                                                    : '16px 16px 16px 4px',
                                                boxShadow: token.boxShadowSecondary,
                                                lineHeight: 1.55,
                                                fontSize: 14,
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
                                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
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
                        padding: isMobile ? '8px 12px' : '12px 16px',
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                        flexShrink: 0,
                    }}
                >
                    <Flex gap={8} align="flex-end">
                        <TextArea
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isMobile ? t('chat.inputPlaceholderMobile') : t('chat.inputPlaceholder')}
                            autoSize={{ minRows: 1, maxRows: 5 }}
                            disabled={sending}
                            style={{ flex: 1, resize: 'none', minHeight: 'unset' }}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleSend}
                            disabled={!inputText.trim() || sending}
                            loading={sending}
                            style={{ height: 40, flexShrink: 0 }}
                        >
                            {!isMobile && t('chat.send')}
                        </Button>
                    </Flex>
                </div>
            </Flex>
        </div>
    );
};
