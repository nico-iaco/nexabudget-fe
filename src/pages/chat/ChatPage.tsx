// src/pages/chat/ChatPage.tsx
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { App, Button, Drawer, Flex, Spin, Tag, Typography, theme } from 'antd';
import { DeleteOutlined, MenuOutlined, PlusOutlined, ReloadOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { GlobalToken } from 'antd/es/theme/interface';
import dayjs from 'dayjs';
import * as api from '../../services/api';
import type { ChatSession } from '../../types/api';
import { useBreakpoints } from '../../hooks/useBreakpoints';
import { usePageTitle } from '../../hooks/usePageTitle';
import { FONT_HEADING, FONT_SIZE, RADIUS, SPACING } from '../../theme/tokens';
import { ItemList } from '../../components/common/ItemList';
import { EmptyState } from '../../components/common/EmptyState';
import { InlineError } from '../../components/common/InlineError';
import { useConfirm } from '../../hooks/useConfirm';
import { apiErrorText, getApiErrorStatus } from '../../utils/apiError';
import { formatDateTime } from '../../utils/format';

const { TextArea } = Input;
const { Text } = Typography;

interface DisplayMessage {
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    createdAt: string;
    toolsUsed?: string[];
    isLoading?: boolean;
    /**
     * Scambio non salvato dal backend (modello AI non raggiungibile su una chat nuova):
     * resta a video finché l'utente non invia di nuovo, ma non fa parte dello storico.
     */
    ephemeral?: boolean;
    /** Testo da reinviare con "Riprova" (solo sulla risposta di ripiego). */
    retryText?: string;
}

// I plugin remark vanno in una costante di modulo: come array literal inline
// cambiavano identità a ogni render, forzando ReactMarkdown a rifare il lavoro.
const REMARK_PLUGINS = [remarkGfm];

interface ChatMessageBubbleProps {
    msg: DisplayMessage;
    isMobile: boolean;
    token: GlobalToken;
    toolsUsedLabel: string;
    notSavedLabel: string;
    retryLabel: string;
    onRetry: (text: string) => void;
}

/**
 * Bolla di un singolo messaggio, memoizzata.
 * Serve perché `inputText` vive nello stesso componente che rende la lista: senza memo
 * ogni carattere digitato ri-renderizzava tutti i messaggi e faceva ri-parsare a
 * remark/remark-gfm il markdown di ogni risposta dell'assistente, con latenza di
 * digitazione crescente al crescere della conversazione.
 * Le prop sono tutte stabili fra una battitura e l'altra.
 */
const ChatMessageBubble = memo(({ msg, isMobile, token, toolsUsedLabel, notSavedLabel, retryLabel, onRetry }: ChatMessageBubbleProps) => (
    <Flex justify={msg.role === 'USER' ? 'flex-end' : 'flex-start'}>
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
                    color: msg.role === 'USER' ? token.colorTextLightSolid : token.colorText,
                    padding: isMobile ? '10px 13px' : '10px 14px',
                    borderRadius: msg.role === 'USER'
                        ? '16px 16px 4px 16px'
                        : '16px 16px 16px 4px',
                    boxShadow: token.boxShadowSecondary,
                    // Scambio non salvato: attenuato, per distinguerlo dallo storico.
                    opacity: msg.ephemeral ? 0.75 : 1,
                    border: msg.ephemeral ? `1px dashed ${token.colorWarningBorder}` : undefined,
                    lineHeight: 1.55,
                    fontSize: isMobile ? FONT_SIZE.lg : FONT_SIZE.base,
                    wordBreak: 'break-word',
                }}
            >
                {msg.isLoading ? (
                    <Flex align="center" gap={8}>
                        <Spin size="small" />
                        <Text style={{ color: token.colorTextSecondary, fontSize: FONT_SIZE.md }}>
                            NexaBot…
                        </Text>
                    </Flex>
                ) : msg.role === 'ASSISTANT' ? (
                    <div className="chat-markdown">
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                            {msg.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                )}
            </div>

            {msg.retryText !== undefined && (
                <Flex align="center" gap={8} wrap="wrap" style={{ marginTop: 4, paddingLeft: 4 }}>
                    <Text style={{ fontSize: FONT_SIZE.xs, color: token.colorWarningText }}>
                        {notSavedLabel}
                    </Text>
                    <Button size="small" icon={<ReloadOutlined />} onClick={() => onRetry(msg.retryText ?? '')}>
                        {retryLabel}
                    </Button>
                </Flex>
            )}

            {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <Flex gap={4} wrap="wrap" style={{ marginTop: 4, paddingLeft: 4 }}>
                    <Text style={{ fontSize: FONT_SIZE.xxs, color: token.colorTextTertiary }}>
                        {toolsUsedLabel}:
                    </Text>
                    {msg.toolsUsed.map(tool => (
                        <Tag
                            key={tool}
                            style={{ fontSize: FONT_SIZE.xxs, margin: 0, padding: '0 5px', lineHeight: '18px' }}
                        >
                            {tool}
                        </Tag>
                    ))}
                </Flex>
            )}

            <Text
                style={{
                    fontSize: FONT_SIZE.xs,
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
));
ChatMessageBubble.displayName = 'ChatMessageBubble';

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
    // Estratta qui: passata come stringa già risolta, la bolla memoizzata non ha
    // bisogno di `t` fra le prop (che cambierebbe identità al cambio lingua).
    const toolsUsedLabel = t('chat.toolsUsed');
    const notSavedLabel = t('chat.notSavedHint');
    const retryLabel = t('common.retry');
    const { isMobile, isSmallMobile } = useBreakpoints();

    usePageTitle(t('chat.title'));

    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Errori di caricamento: mostrati al posto della lista, non come "nessuna chat" o come
    // una conversazione vuota.
    const [sessionsLoadFailed, setSessionsLoadFailed] = useState(false);
    const [messagesLoadFailed, setMessagesLoadFailed] = useState(false);
    // "Vista" corrente: cresce a ogni cambio di sessione o nuova chat. Una risposta (invio
    // o caricamento messaggi) partita in una vista precedente non deve toccare quella
    // attuale: prima i messaggi della sessione A finivano sotto il titolo di B, e una
    // risposta tardiva rendeva attiva la sessione sbagliata.
    const viewRef = useRef(0);
    const confirm = useConfirm();

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
            setSessionsLoadFailed(false);
        } catch {
            setSessionsLoadFailed(true);
        }
    }, []);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    const loadSessionMessages = useCallback(async (sessionId: string) => {
        const view = viewRef.current;
        setLoadingMessages(true);
        setMessagesLoadFailed(false);
        setMessages([]);
        try {
            const res = await api.getChatSessionMessages(sessionId);
            if (view !== viewRef.current) return;
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
            if (view !== viewRef.current) return;
            setMessagesLoadFailed(true);
        } finally {
            if (view === viewRef.current) setLoadingMessages(false);
        }
    }, []);

    const handleSelectSession = (sessionId: string) => {
        viewRef.current += 1;
        setActiveSessionId(sessionId);
        loadSessionMessages(sessionId);
        if (isMobile) setSidebarOpen(false);
    };

    const handleNewChat = () => {
        viewRef.current += 1;
        setActiveSessionId(null);
        setMessages([]);
        setMessagesLoadFailed(false);
        setLoadingMessages(false);
        if (isMobile) setSidebarOpen(false);
    };

    const handleDeleteSession = async (sessionId: string) => {
        try {
            await api.deleteChatSession(sessionId);
            message.success(t('chat.deleteSuccess'));
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (activeSessionId === sessionId) {
                viewRef.current += 1;
                setActiveSessionId(null);
                setMessages([]);
                setMessagesLoadFailed(false);
            }
        } catch {
            message.error(t('chat.deleteError'));
        }
    };

    const handleSend = async (textOverride?: string) => {
        const text = (textOverride ?? inputText).trim();
        if (!text || sending) return;
        const view = viewRef.current;
        const sessionAtSend = activeSessionId;

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

        // Un nuovo invio sostituisce l'eventuale scambio non salvato rimasto a video.
        setMessages(prev => [...prev.filter(m => !m.ephemeral), userMsg, loadingMsg]);
        if (!textOverride) setInputText('');
        setSending(true);

        try {
            const res = await api.sendChatMessage({ sessionId: sessionAtSend, message: text });
            const { sessionId, reply, toolsUsed } = res.data;

            // L'utente ha cambiato chat mentre attendeva: la risposta è salvata nella sua
            // sessione, che si vedrà riaprendola. Basta aggiornare l'elenco.
            if (view !== viewRef.current) {
                if (!sessionAtSend && sessionId !== null) fetchSessions();
                return;
            }

            // sessionId null: il modello AI non ha risposto su una chat nuova e il backend
            // non ha salvato nulla. Si resta nella "nuova chat": la risposta di ripiego è
            // temporanea, con "Riprova", e il testo torna modificabile nell'input.
            // (Su una sessione esistente il ripiego è indistinguibile: nessun flag esplicito.)
            const notSaved = sessionId === null;

            if (!sessionAtSend && sessionId !== null) {
                setActiveSessionId(sessionId);
                fetchSessions();
            }

            setMessages(prev =>
                prev.map(m => {
                    if (notSaved && m.id === `${tempBase}-user`) return { ...m, ephemeral: true };
                    if (m.id !== `${tempBase}-loading`) return m;
                    return {
                        id: `${sessionId ?? tempBase}-${Date.now()}`,
                        role: 'ASSISTANT' as const,
                        content: reply,
                        createdAt: new Date().toISOString(),
                        toolsUsed: toolsUsed && toolsUsed.length > 0 ? toolsUsed : undefined,
                        ...(notSaved ? { ephemeral: true, retryText: text } : {}),
                    };
                })
            );
            if (notSaved) setInputText(prev => (prev.trim() ? prev : text));
        } catch (error) {
            if (view !== viewRef.current) {
                message.error(apiErrorText(error, t('chat.sendError')));
                return;
            }
            setMessages(prev => prev.filter(m => m.id !== `${tempBase}-loading` && m.id !== `${tempBase}-user`));
            if (getApiErrorStatus(error) === 404 && sessionAtSend) {
                // La sessione è stata eliminata nel frattempo (es. da un altro dispositivo).
                message.warning(t('chat.sessionGone'));
                setSessions(prev => prev.filter(s => s.id !== sessionAtSend));
                viewRef.current += 1;
                setActiveSessionId(null);
                setMessages([]);
            } else {
                message.error(apiErrorText(error, t('chat.sendError')));
            }
            // Il testo era già stato svuotato dall'input: lo rimettiamo lì, così un errore
            // non fa perdere una domanda lunga e basta un invio per riprovare.
            setInputText(prev => (prev.trim() ? prev : text));
        } finally {
            setSending(false);
        }
    };

    // "Riprova" sulla risposta non salvata. Identità stabile (via ref) perché finisce nelle
    // prop della bolla memoizzata; il ref si aggiorna in effetto, non in render.
    const handleSendRef = useRef(handleSend);
    useEffect(() => { handleSendRef.current = handleSend; });
    const handleRetry = useCallback((text: string) => {
        // Il testo era stato rimesso nell'input: lo si svuota, l'invio usa `text`.
        setInputText(prev => (prev.trim() === text.trim() ? '' : prev));
        void handleSendRef.current(text);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Su mobile Enter va a capo (comportamento naturale); solo su desktop invia senza Shift
        // Durante la composizione IME (cinese, giapponese, coreano…) Enter conferma il
        // carattere: non deve inviare il messaggio a metà.
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
    const contentPadding = isMobile ? SPACING.sm : SPACING.lg;
    const containerMargin = isSmallMobile
        ? `-${SPACING.sm}px -${SPACING.sm}px 0 -${SPACING.sm}px`
        : isMobile
            ? `-${SPACING.sm}px`
            : `-${SPACING.lg}px`;

    // dvh si aggiorna quando la tastiera virtuale si apre/chiude (iOS 15.4+, Android Chrome).
    // Questo è il fix corretto per "l'input si nasconde sotto la tastiera".
    const containerHeight = isSmallMobile
        ? 'calc(100dvh - 180px - env(safe-area-inset-bottom, 0px))'
        : isMobile
            ? 'calc(100dvh - 96px)'
            : 'calc(100vh - 112px)';

    const sidebarContent = (
        <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: SPACING.sm, flexShrink: 0 }}>
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
                {sessionsLoadFailed && sessions.length === 0 ? (
                    <div style={{ padding: SPACING.sm }}>
                        <InlineError message={t('chat.loadError')} onRetry={fetchSessions} />
                    </div>
                ) : sessions.length === 0 ? (
                    <EmptyState description={t('chat.noSessions')} style={{ marginTop: SPACING.lg }} />
                ) : (
                    <ItemList
                        items={sessions}
                        rowKey={session => session.id}
                        aria-label={t('chat.sessions')}
                        renderItem={session => (
                            <Flex
                                role="button"
                                tabIndex={0}
                                aria-current={activeSessionId === session.id ? 'true' : undefined}
                                align="center"
                                gap={SPACING.xs}
                                style={{
                                    padding: isMobile ? `${SPACING.sm}px 10px` : `${SPACING.xs}px 10px`,
                                    cursor: 'pointer',
                                    background: activeSessionId === session.id
                                        ? token.colorPrimaryBg
                                        : 'transparent',
                                    borderRadius: RADIUS.md,
                                    margin: '2px 6px',
                                    transition: 'background 0.15s',
                                    minHeight: 52, // touch target ≥ 44px
                                }}
                                onClick={() => handleSelectSession(session.id)}
                                onKeyDown={e => {
                                    if (e.target !== e.currentTarget) return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleSelectSession(session.id);
                                    }
                                }}
                            >
                                <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                                    <Text
                                        style={{
                                            fontSize: FONT_SIZE.md,
                                            fontWeight: activeSessionId === session.id ? 600 : 400,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            display: 'block',
                                            color: token.colorText,
                                        }}
                                    >
                                        {session.title}
                                    </Text>
                                    <Text style={{ fontSize: FONT_SIZE.xs, color: token.colorTextTertiary }}>
                                        {formatDateTime(session.updatedAt)}
                                    </Text>
                                </Flex>
                                <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={e => {
                                        e.stopPropagation();
                                        confirm({
                                            title: t('chat.deleteConfirm'),
                                            okText: t('common.delete'),
                                            danger: true,
                                            onOk: () => handleDeleteSession(session.id),
                                        });
                                    }}
                                    aria-label={t('chat.deleteSession')}
                                    style={{ minWidth: 32, minHeight: 32, flexShrink: 0 }}
                                />
                            </Flex>
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
            {/* Desktop sidebar — cronologia conversazioni, sfondo leggermente distinto dal pannello principale */}
            {!isMobile && (
                <div
                    style={{
                        width: 248,
                        background: token.colorFillAlter,
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
                    size="85%"
                    styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
                >
                    {sidebarContent}
                </Drawer>
            )}

            {/* Main chat area */}
            <Flex vertical style={{ flex: 1, overflow: 'hidden' }}>

                {/* Desktop: barra titolo conversazione attiva (🤖 + nome chat), come da mockup */}
                {!isMobile && (
                    <Flex
                        align="center"
                        gap={8}
                        style={{
                            padding: `0 ${SPACING.md}px`,
                            height: 52,
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            flexShrink: 0,
                        }}
                    >
                        <RobotOutlined style={{ fontSize: FONT_SIZE.lg, color: token.colorPrimary }} />
                        <Text
                            strong
                            style={{
                                fontFamily: FONT_HEADING,
                                fontSize: FONT_SIZE.base,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {activeSession?.title ?? t('chat.title')}
                        </Text>
                    </Flex>
                )}

                {/* Mobile: barra cronologia/nuova chat sotto l'header globale — la pagina attiva
                    è già mostrata dall'header dell'app, qui restano solo le azioni sessione */}
                {isMobile && (
                    <Flex
                        align="center"
                        justify="space-between"
                        style={{
                            padding: `0 ${SPACING.xs}px`,
                            height: 38,
                            background: token.colorFillAlter,
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            flexShrink: 0,
                        }}
                    >
                        <Button
                            type="text"
                            size="small"
                            icon={<MenuOutlined />}
                            onClick={() => setSidebarOpen(true)}
                            style={{ color: token.colorTextSecondary, fontSize: FONT_SIZE.sm, minHeight: 32 }}
                        >
                            {t('chat.sessionListTitle')}
                        </Button>
                        <Button
                            type="text"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={handleNewChat}
                            style={{ color: token.colorPrimary, fontWeight: 700, fontSize: FONT_SIZE.sm, minHeight: 32 }}
                        >
                            {t('chat.newChat')}
                        </Button>
                    </Flex>
                )}

                {/* Messages */}
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: contentPadding,
                        background: isMobile ? token.colorFillQuaternary : undefined,
                        WebkitOverflowScrolling: 'touch',
                    } as React.CSSProperties}
                >
                    {loadingMessages ? (
                        <Flex justify="center" align="center" style={{ height: '100%' }}>
                            <Spin size="large" />
                        </Flex>
                    ) : messagesLoadFailed && activeSessionId ? (
                        <InlineError
                            message={t('chat.loadError')}
                            onRetry={() => loadSessionMessages(activeSessionId)}
                        />
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
                                    fontSize: isMobile ? FONT_SIZE.md : FONT_SIZE.base,
                                    padding: `0 ${SPACING.xs}px`,
                                }}
                            >
                                {t('chat.emptyState')}
                            </Text>

                            {/* Chip di suggerimento — mostrano all'utente cosa può chiedere */}
                            <Flex
                                wrap="wrap"
                                gap={8}
                                justify="center"
                                style={{ maxWidth: 360, padding: `0 ${SPACING.xs}px` }}
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
                                                fontSize: FONT_SIZE.sm,
                                                height: 'auto',
                                                padding: `6px ${SPACING.sm}px`,
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
                                <ChatMessageBubble
                                    key={msg.id}
                                    msg={msg}
                                    isMobile={isMobile}
                                    token={token}
                                    toolsUsedLabel={toolsUsedLabel}
                                    notSavedLabel={notSavedLabel}
                                    retryLabel={retryLabel}
                                    onRetry={handleRetry}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </Flex>
                    )}
                </div>

                {/* Input area */}
                <div
                    style={{
                        padding: isMobile ? `${SPACING.xs}px 10px` : `${SPACING.sm}px ${SPACING.md}px`,
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
                            enterKeyHint="send"
                            style={{ flex: 1, resize: 'none', minHeight: 'unset', fontSize: isMobile ? FONT_SIZE.xl : FONT_SIZE.base }}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={() => handleSend()}
                            aria-label={t('chat.send')}
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
