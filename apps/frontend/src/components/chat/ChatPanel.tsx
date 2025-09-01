/// <reference types="vite/client" />
import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useAuth } from '../../lib/authContext'
import { supabase } from '../../lib/supabase'

function generateSessionId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getOrCreateSessionId(userId: string): string {
  const storageKey = `chat_session_${userId}`
  let sessionId = localStorage.getItem(storageKey)
  
  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem(storageKey, sessionId)
  }
  
  return sessionId
}

interface ChatPanelProps {
  onEventCreated?: () => void;
}

export function ChatPanel({ onEventCreated }: ChatPanelProps = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  // Removed isProcessing state
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const lastTimestampRef = useRef<string | null>(null)
  const { user, session, isAuthenticated } = useAuth()

  // Initialize session ID when user is available
  useEffect(() => {
    if (user?.id) {
      const persistentSessionId = getOrCreateSessionId(user.id)
      setSessionId(persistentSessionId)
    }
  }, [user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load chat history when session is ready
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)
  
  const loadChatHistory = useCallback(async () => {
    if (!user || !sessionId) return
    
    console.log('🔄 [CHAT] Loading history for session:', sessionId)
    try {
      // Load chat history directly from user's schema table
      const userSchema = `u_${user.id.replace(/-/g, '')}`
      const { data: chatHistory, error } = await supabase
        .schema(userSchema)
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .limit(50)
      
      if (error) {
        console.log('ℹ️ [CHAT] No history found or schema not ready:', error.message)
      } else if (chatHistory && chatHistory.length > 0) {
        console.log('✅ [CHAT] Loaded', chatHistory.length, 'messages from realtime')
        const formattedMessages = chatHistory.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp
        }))
        setMessages(formattedMessages)
        if (chatHistory.length > 0) {
          lastTimestampRef.current = chatHistory[chatHistory.length - 1].timestamp
        }
      }
      
      setHasLoadedHistory(true)
    } catch (err) {
      console.error('Error loading chat history:', err)
      setHasLoadedHistory(true)
    }
  }, [user, sessionId])

  // Realtime will handle persistence automatically, no need for visibility change handlers
  
  useEffect(() => {
    loadChatHistory()
  }, [loadChatHistory])

  // Set up realtime subscription for new chat messages
  useEffect(() => {
    if (!user || !sessionId) return

    console.log('🔄 [CHAT] Setting up realtime subscription for session:', sessionId)
    const userSchema = `u_${user.id.replace(/-/g, '')}`
    
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
          console.log('📨 [CHAT] New message via realtime:', payload.new)
          const newMessage = {
            id: payload.new.id,
            content: payload.new.content,
            sender: payload.new.sender,
            timestamp: payload.new.timestamp
          }
          
          // Only add if it's not already in our messages (avoid duplicates)
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === newMessage.id)
            if (exists) return prev
            return [...prev, newMessage]
          })
          
          lastTimestampRef.current = newMessage.timestamp
        }
      )
      .subscribe()

    return () => {
      console.log('🔄 [CHAT] Cleaning up realtime subscription')
      supabase.removeChannel(channel)
    }
  }, [user, sessionId])

  // Show briefing only if no history was loaded
  useEffect(() => {
    if (!user || !session?.access_token || !sessionId || !hasLoadedHistory || messages.length > 0) return
    
    const showBriefing = async () => {
      try {
        // Just send a message to the agent asking for a greeting
        const response = await fetch(`${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/agent/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            context: {
              userId: user.id,
              sessionId: sessionId,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              conversationHistory: [],
              userProfile: null
            },
            message: "Please give me a brief greeting with the current time, how many events I have today, and any key insights about my schedule."
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.response) {
            setMessages([{
              id: 'briefing-' + Date.now(),
              content: data.response,
              sender: 'assistant',
              timestamp: new Date().toISOString()
            }])
          }
        }
        
      } catch (err) {
        console.error('Error showing briefing:', err)
      }
    }
    
    showBriefing()
  }, [user, session, sessionId, hasLoadedHistory, messages.length])


  async function handleSend() {
    if (!input.trim()) return
    if (!user || !session?.access_token) {
      console.error('User not authenticated or missing session token')
      return
    }
    // Embedding generation will be handled by the agent service
    const msg: ChatMessage = {
      id: `${Date.now()}`,
      content: input,
      sender: 'user',
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, msg])
    lastTimestampRef.current = msg.timestamp
    setInput('')
    // Use agent/process endpoint for better context awareness
    try {
      const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/agent/process`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          context: {
            userId: user.id,
            sessionId: sessionId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            conversationHistory: messages.map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.content
            }))
          },
          message: input
        })
      })

      if (response.ok) {
        const result = await response.json()
        let responseContent = ''
        
        // Handle different response formats
        if (result.success && result.response) {
          if (typeof result.response === 'object') {
            // Handle object responses - extract content field
            responseContent = result.response.content || JSON.stringify(result.response)
          } else if (typeof result.response === 'string') {
            responseContent = result.response
          } else {
            responseContent = String(result.response)
          }
        } else if (result.content) {
          responseContent = String(result.content)
        } else {
          responseContent = 'No response received'
        }
        
        if (responseContent) {
          const aiMsg: ChatMessage = {
            id: `${Date.now()}-ai`,
            content: responseContent,
            sender: 'assistant',
            timestamp: new Date().toISOString()
          }
          setMessages(prev => [...prev, aiMsg])
          lastTimestampRef.current = aiMsg.timestamp
          
          // Check if the response indicates an event was created
          // Look for common indicators in the response
          const eventIndicators = [
            'scheduled', 'created', 'added to your calendar', 
            'event has been', 'booked', 'meeting set',
            'appointment made', 'added the event'
          ];
          
          const lowerResponse = responseContent.toLowerCase();
          const eventWasCreated = eventIndicators.some(indicator => 
            lowerResponse.includes(indicator)
          );
          
          if (eventWasCreated && onEventCreated) {
            // Give the backend a moment to process
            setTimeout(() => {
              onEventCreated();
            }, 1000);
          }
        }
      } else {
        console.error('Chat response failed:', response.status, response.statusText)
      }
    } catch (err) {
      console.error('Failed to send message', err)
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg overflow-hidden" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Messages Area with fixed height */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxWidth: '100%' }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[70%]`}>
              <div
                className={`inline-block px-4 py-3 rounded-2xl shadow-sm ${
                  msg.sender === 'user' 
                    ? 'rounded-br-md' 
                    : 'rounded-bl-md'
                }`}
                style={{
                  wordBreak: 'break-word',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  backgroundColor: msg.sender === 'user' 
                    ? '#2563EB' // Nice blue for user messages
                    : '#10B981', // Nice green for assistant messages
                  color: '#FFFFFF',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                }}
              >
                {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
              </div>
              <div className={`text-xs mt-1 px-1 ${
                msg.sender === 'user' ? 'text-right text-gray-500' : 'text-left text-gray-500'
              }`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-200">
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a message..."
              className="bg-gray-100 border-0 text-gray-800 placeholder-gray-500 rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2.5 min-w-[40px] h-[40px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Types and static content ---

interface ChatMessage {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: string
} 