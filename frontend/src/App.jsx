import { useEffect, useMemo, useRef, useState } from 'react';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const API_BASE = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

const STARTER_PROMPTS = [
  {
    icon: '💡',
    category: 'Brainstorm',
    title: 'Creative project ideas',
    prompt: 'Give me 5 creative ideas for an AI-powered productivity app.',
  },
  {
    icon: '💻',
    category: 'Coding',
    title: 'Python async example',
    prompt: 'Write a clean Python script using asyncio to fetch multiple URLs in parallel.',
  },
  {
    icon: '⚡',
    category: 'Explain',
    title: 'Quantum computing',
    prompt: 'Explain how quantum superposition works using a simple analogy.',
  },
  {
    icon: '✍️',
    category: 'Writing',
    title: 'Professional email',
    prompt: 'Draft a polite follow-up email after a job interview.',
  },
];

// Simple markdown formatter helper for code, bold, lists, and paragraphs
function FormattedContent({ text }) {
  if (!text) return null;

  // Split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="formatted-content">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const firstLineBreak = part.indexOf('\n');
          const lang = firstLineBreak > 3 ? part.substring(3, firstLineBreak).trim() : 'code';
          const code = firstLineBreak !== -1 ? part.substring(firstLineBreak + 1, part.length - 3) : part.substring(3, part.length - 3);

          return <CodeSnippet key={index} language={lang} code={code.trim()} />;
        }

        return <TextMarkdown key={index} content={part} />;
      })}
    </div>
  );
}

function CodeSnippet({ language, code }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-container">
      <div className="code-header">
        <span className="code-lang">{language || 'code'}</span>
        <button className="code-copy-btn" onClick={copyCode} type="button">
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TextMarkdown({ content }) {
  const lines = content.split('\n');

  return (
    <div className="text-body">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="line-break" />;
        }

        // Headers
        if (trimmed.startsWith('### ')) {
          return <h4 key={idx} className="md-h4">{renderInline(trimmed.slice(4))}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={idx} className="md-h3">{renderInline(trimmed.slice(3))}</h3>;
        }
        if (trimmed.startsWith('# ')) {
          return <h2 key={idx} className="md-h2">{renderInline(trimmed.slice(2))}</h2>;
        }

        // Bullet list
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="md-list-item">
              <span className="bullet">•</span>
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="md-list-item">
              <span className="num-bullet">{numMatch[1]}.</span>
              <span>{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        return <p key={idx} className="md-paragraph">{renderInline(line)}</p>;
      })}
    </div>
  );
}

// Inline renderer for bold, italic, code
function renderInline(text) {
  const tokens = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(<code key={match.index} className="inline-code">{token.slice(1, -1)}</code>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens.length ? tokens : text;
}

export default function App() {
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_chat_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem('chat_user_id') || `user-${Math.random().toString(36).substring(2, 10)}`;
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync sessions to localStorage
  useEffect(() => {
    localStorage.setItem('ai_chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const startNewChat = () => {
    setCurrentSessionId(null);
    setConversationId(null);
    setMessages([]);
    setError('');
    setInput('');
  };

  const loadSession = (session) => {
    setCurrentSessionId(session.id);
    setConversationId(session.conversationId);
    setMessages(session.messages || []);
    setError('');
  };

  const deleteSession = (e, sessionId) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    if (currentSessionId === sessionId) {
      startNewChat();
    }
  };

  const handleCopyReply = (content, messageId) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const sendMessage = async (overridePrompt) => {
    const textToSend = (overridePrompt || input).trim();
    if (!textToSend || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          conversation_id: conversationId || undefined,
          user_id: userId,
          user_name: 'User',
        }),
      });

      let data = {};
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text.slice(0, 160) || `Server error (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.detail || data.message || `Request failed (${response.status})`);
      }

      const activeConvId = data.conversation_id;
      setConversationId(activeConvId);

      if (data.user_id) {
        setUserId(data.user_id);
        localStorage.setItem('chat_user_id', data.user_id);
      }

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        model: data.model,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...nextMessages, assistantMessage];
      setMessages(finalMessages);

      // Save/update session in history
      const sessionId = currentSessionId || `session-${Date.now()}`;
      if (!currentSessionId) {
        setCurrentSessionId(sessionId);
      }

      const sessionTitle = textToSend.slice(0, 36).trim() || 'New Chat';
      setSessions((prev) => {
        const existingIndex = prev.findIndex((s) => s.id === sessionId);
        const updatedItem = {
          id: sessionId,
          conversationId: activeConvId,
          title: existingIndex >= 0 ? prev[existingIndex].title : sessionTitle,
          messages: finalMessages,
          updatedAt: Date.now(),
        };

        if (existingIndex >= 0) {
          const copy = [...prev];
          copy[existingIndex] = updatedItem;
          return copy;
        }
        return [updatedItem, ...prev];
      });
    } catch (err) {
      const errorMsg = err.message || 'Unable to connect to the server.';
      setError(errorMsg);
      setMessages([
        ...nextMessages,
        {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Error:** ${errorMsg}\n\nPlease verify that the backend service is running.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`chat-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {/* Sidebar */}
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a10 10 0 0 1-10-10C2 6.477 6.477 2 12 2z"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <span className="brand-title">Chatbot</span>
          </div>
          <button
            className="icon-btn close-sidebar-btn"
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <button className="new-chat-action-btn" onClick={startNewChat} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>New chat</span>
        </button>

        <div className="history-section">
          <div className="history-heading">Recent chats</div>
          <div className="history-list">
            {sessions.length === 0 ? (
              <div className="empty-history">No recent conversations</div>
            ) : (
              sessions.map((sess) => (
                <div
                  key={sess.id}
                  className={`history-thread-item ${currentSessionId === sess.id ? 'active' : ''}`}
                  onClick={() => loadSession(sess)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span className="thread-title">{sess.title}</span>
                  <button
                    className="delete-thread-btn"
                    onClick={(e) => deleteSession(e, sess.id)}
                    title="Delete chat"
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="user-info">
              <span className="user-name">User Account</span>
              <span className="user-status">Online • Ready</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Panel */}
      <main className="chat-main">
        {/* Top Navbar */}
        <header className="chat-navbar">
          <div className="navbar-left">
            {!sidebarOpen && (
              <button
                className="icon-btn open-sidebar-btn"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            )}
            <div className="model-indicator">
              <span className="model-dot" />
              <span className="model-text">Chatbot</span>
              <span className="model-chip">GPT-OSS 120B</span>
            </div>
          </div>

          <div className="navbar-right">
            {messages.length > 0 && (
              <button className="clear-chat-btn" onClick={startNewChat} title="Start new conversation" type="button">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                <span>New chat</span>
              </button>
            )}
          </div>
        </header>

        {/* Message Area */}
        <div className="chat-scroll-area">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-hero">
                <div className="welcome-icon-glow">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </div>
                <h1 className="welcome-title">How can I help you today?</h1>
                <p className="welcome-subtitle">Ask questions, write code, analyze data, or brainstorm new ideas.</p>
              </div>

              <div className="starter-grid">
                {STARTER_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    className="starter-card"
                    onClick={() => sendMessage(item.prompt)}
                    type="button"
                  >
                    <div className="starter-card-top">
                      <span className="starter-card-icon">{item.icon}</span>
                      <span className="starter-card-category">{item.category}</span>
                    </div>
                    <div className="starter-card-title">{item.title}</div>
                    <div className="starter-card-desc">{item.prompt}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages-container">
              {messages.map((msg) => (
                <div key={msg.id} className={`message-row ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'assistant' ? (
                      <div className="avatar-ai">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                      </div>
                    ) : (
                      <div className="avatar-user">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="message-content-wrapper">
                    <div className="message-header-line">
                      <span className="sender-name">{msg.role === 'assistant' ? 'Chatbot' : 'You'}</span>
                      {msg.timestamp && <span className="message-time">{msg.timestamp}</span>}
                    </div>

                    <div className="message-bubble">
                      <FormattedContent text={msg.content} />
                    </div>

                    {/* Copy option at the end of each assistant reply */}
                    {msg.role === 'assistant' && (
                      <div className="message-toolbar">
                        <button
                          className={`toolbar-btn copy-reply-btn ${copiedId === msg.id ? 'copied' : ''}`}
                          onClick={() => handleCopyReply(msg.content, msg.id)}
                          title="Copy response"
                          type="button"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                              <span>Copy reply</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-row assistant">
                  <div className="message-avatar">
                    <div className="avatar-ai thinking">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                    </div>
                  </div>
                  <div className="message-content-wrapper">
                    <div className="message-header-line">
                      <span className="sender-name">Chatbot</span>
                    </div>
                    <div className="typing-indicator">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {error && (
          <div className="error-toast">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
            <button className="close-toast-btn" onClick={() => setError('')} type="button">×</button>
          </div>
        )}

        {/* Input Bar */}
        <div className="composer-wrapper">
          <div className="composer-box">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask anything..."
              disabled={loading}
            />
            <button
              className={`send-action-btn ${input.trim() && !loading ? 'active' : ''}`}
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              type="button"
              title="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div className="composer-footer-note">
            <span>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for a new line</span>
          </div>
        </div>
      </main>
    </div>
  );
}
