import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/authContext';
import { useStreamingChat, ChatMessage } from './hooks/useStreamingChat';
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
  const { user, session, isAuthenticated } = useAuth();

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

  // Load chat history when session is ready
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  
  const loadChatHistory = useCallback(async () => {
    if (!user || !sessionId) return;
    
    console.log('🔄 [CHAT] Loading history for session:', sessionId);
    try {
      const userSchema = `u_${user.id.replace(/-/g, '')}`;
      const { data: chatHistory, error } = await supabase
        .schema(userSchema)
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .limit(50);
      
      if (error) {
        console.log('ℹ️ [CHAT] No history found or schema not ready:', error.message);
      } else if (chatHistory && chatHistory.length > 0) {
        console.log('✅ [CHAT] Loaded', chatHistory.length, 'messages from realtime');
        const formattedMessages = chatHistory.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp
        }));
        setMessages(formattedMessages);
        if (chatHistory.length > 0) {
          lastTimestampRef.current = chatHistory[chatHistory.length - 1].timestamp;
        }
      }
      
      setHasLoadedHistory(true);
    } catch (err) {
      console.error('Error loading chat history:', err);
      setHasLoadedHistory(true);
    }
  }, [user, sessionId, setMessages]);
  
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Set up realtime subscription for new chat messages
  useEffect(() => {
    if (!user || !sessionId) return;

    console.log('🔄 [CHAT] Setting up realtime subscription for session:', sessionId);
    const userSchema = `u_${user.id.replace(/-/g, '')}`;
    
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: userSchema,
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('📨 [CHAT] New message via realtime:', payload.new);
          const newMessage = {
            id: payload.new.id,
            content: payload.new.content,
            sender: payload.new.sender,
            timestamp: payload.new.timestamp
          };
          
          // Only add if it's not already in our messages (avoid duplicates)
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
          
          lastTimestampRef.current = newMessage.timestamp;
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 [CHAT] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user, sessionId, setMessages]);

  // Show briefing only if no history was loaded
  useEffect(() => {
    if (!user || !session?.access_token || !sessionId || !hasLoadedHistory || messages.length > 0) return;
    
    const showBriefing = async () => {
      try {
        await sendMessage("Please give me a brief greeting with the current time, how many events I have today, and any key insights about my schedule.");
      } catch (err) {
        console.error('Error showing briefing:', err);
      }
    };
    
    showBriefing();
  }, [user, session, sessionId, hasLoadedHistory, messages.length, sendMessage]);

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
        <h2 className="text-lg font-medium text-gray-900">AI Assistant</h2>
        <p className="text-sm text-gray-500">Your intelligent calendar companion</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => <MessageComponent key={message.id} message={message} />)}
        
        {/* Current streaming message */}
        {isStreaming && currentStreamingMessage && (
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
                  {currentStreamingMessage}
                </ReactMarkdown>
                {/* Typing cursor */}
                <span className="inline-block w-2 h-5 bg-gray-600 ml-1 animate-pulse" />
              </div>
            </div>
          </div>
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

 