import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../lib/authContext';
import { useStreamingChat, ChatMessage } from './hooks/useStreamingChat';
import { useStreamExample } from '@llm-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send } from 'lucide-react';

// Generate session ID function
function generateSessionId(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${userId.substring(0, 8)}_${timestamp}_${random}`;
}

function getOrCreateSessionId(userId: string): string {
  const storageKey = `glyde_chat_session_${userId}`;
  let sessionId = localStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = generateSessionId(userId);
    localStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
}

interface ChatPanelProps {
  onEventCreated?: () => void;
}

export function ChatPanel({ onEventCreated }: ChatPanelProps = {}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const lastTimestampRef = useRef<string | null>(null);
  const { user, isAuthenticated, session } = useAuth();

  // Initialize session ID when user is available
  useEffect(() => {
    if (user?.id) {
      const persistentSessionId = getOrCreateSessionId(user.id);
      setSessionId(persistentSessionId);
    }
  }, [user?.id]);

  // Use the streaming chat hook
  const {
    messages,
    isStreaming,
    currentStreamingMessage,
    isStreamFinished,
    setMessages,
    sendMessage,
  } = useStreamingChat({
    sessionId,
    onEventCreated,
  });

  // Direct markdown rendering - no need for complex llm-ui processing

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingMessage]);

  // Load chat history when session is ready using backend API
  
  const loadChatHistory = useCallback(async () => {
    if (!user || !sessionId || !session?.access_token) return;

    try {
      const agentServiceUrl = (import.meta as any).env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000';
      const response = await fetch(`${agentServiceUrl}/api/chat/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          session_id: sessionId,
          limit: 50
        })
      });

      if (!response.ok) {
        return;
      }

      const result = await response.json();
      
      if (result.success && result.messages && result.messages.length > 0) {
        
        // Filter out internal greeting messages - check for multiple variations
        const filteredHistory = result.messages.filter((msg: { role: string; content: string; timestamp?: string }) => {
          if (msg.sender !== 'user') return true; // Keep all assistant messages
          
          const content = msg.content.toLowerCase();
          const isGreetingMessage = 
            content.includes('please give me a brief greeting') ||
            content.includes('brief greeting') ||
            content.includes('current time') && content.includes('events') && content.includes('schedule');
          
          if (isGreetingMessage) {
          }
          
          return !isGreetingMessage;
        });
        
        const formattedMessages = filteredHistory.map((msg: { role: string; content: string; timestamp?: string }) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp
        }));
        
        setMessages(formattedMessages);
        if (filteredHistory.length > 0) {
          lastTimestampRef.current = filteredHistory[filteredHistory.length - 1].timestamp;
        }
        
      } else {
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  }, [user, sessionId, setMessages]);
  
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Note: Removed realtime subscription since we're using backend API
  // Messages will be handled via local state in useStreamingChat hook

  // Auto-greeting disabled - users can start conversations manually
  // useEffect(() => {
  //   if (!user || !session?.access_token || !sessionId || !hasLoadedHistory || messages.length > 0) return;
  //   
  //   const showBriefing = async () => {
  //     try {
  //       await sendInternalMessage("Please give me a brief greeting with the current time, how many events I have today, and any key insights about my schedule.");
  //     } catch (err) {
  //       console.error('Error showing briefing:', err);
  //     }
  //   };
  //   
  //   showBriefing();
  // }, [user, session, sessionId, hasLoadedHistory, messages.length, sendInternalMessage]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const messageContent = input.trim();
    setInput('');
    await sendMessage(messageContent);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Streaming message component using llm-ui
  const StreamingMessage = ({ content }: { content: string }) => {
    const { output } = useStreamExample(content, {
      autoStart: true,
      delayMultiplier: 0.5,
      startIndex: 0,
    });

    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[85%] rounded-lg px-4 py-3 bg-gray-100 text-gray-900 mr-4">
          <div className="text-sm prose prose-sm max-w-none text-gray-900">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
              }}
            >
              {output}
            </ReactMarkdown>
            {/* Typing cursor */}
            <span className="inline-block w-2 h-5 bg-gray-600 ml-1 animate-pulse" />
          </div>
        </div>
      </div>
    );
  };

  // Simple message rendering component  
  const MessageComponent = ({ message }: { message: ChatMessage }) => {
    return (
      <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-[85%] rounded-lg px-4 py-3 ${
          message.sender === 'user' 
            ? 'bg-blue-600 text-white ml-4' 
            : 'bg-gray-100 text-gray-900 mr-4'
        }`}>
          <div className="text-sm prose prose-sm max-w-none">
            {message.sender === 'user' ? (
              <div className="text-white">{message.content}</div>
            ) : (
              <div className="text-gray-900">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    code: ({ children }) => <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
          <div className="text-xs opacity-70 mt-2">
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg overflow-hidden" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <div className="bg-white p-4 border-b border-gray-200 rounded-t-lg">
        <h2 className="text-lg font-medium text-gray-900">Chat</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => <MessageComponent key={message.id} message={message} />)}
        
        {/* Current streaming message with llm-ui */}
        {isStreaming && currentStreamingMessage && (
          <StreamingMessage content={currentStreamingMessage} />
        )}
        
        {/* Typing indicator when starting */}
        {isStreaming && !currentStreamingMessage && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[85%] rounded-lg px-4 py-3 bg-gray-100 text-gray-900 mr-4">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-gray-500">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white p-4 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isStreaming}
            placeholder={isStreaming ? "AI is responding..." : "Type your message..."}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

 