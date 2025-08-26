/// <reference types="vite/client" />
import React, { useRef, useState, useEffect } from 'react'
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
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimestampRef = useRef<string | null>(null)
  const [isPolling, setIsPolling] = useState(true)
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

  useEffect(() => {
    function handleVisibility() {
      setIsPolling(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Load chat history when session is ready
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)
  
  useEffect(() => {
    if (!user || !session?.access_token || !sessionId) return
    
    const loadHistory = async () => {
      console.log('🔄 [CHAT] Loading history for session:', sessionId)
      try {
        const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/chat/history`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            user_id: user.id,
            session_id: sessionId
          })
        })
        
        if (res.ok) {
          const result = await res.json()
          console.log('📥 [CHAT] History response:', result)
          if (result.success && Array.isArray(result.messages) && result.messages.length > 0) {
            console.log('✅ [CHAT] Loaded', result.messages.length, 'messages')
            setMessages(result.messages)
            if (result.messages.length > 0) {
              lastTimestampRef.current = result.messages[result.messages.length - 1].timestamp
            }
            setHasLoadedHistory(true)
            return
          }
        }
        console.log('ℹ️ [CHAT] No history found, will show briefing')
      } catch (err) {
        console.error('Error loading chat history:', err)
      }
      
      setHasLoadedHistory(true)
    }
    
    // Always try to load history, don't gate on hasLoadedHistory
    loadHistory()
  }, [user, session, sessionId])

  // Show briefing only if no history was loaded
  useEffect(() => {
    if (!user || !session?.access_token || !sessionId || !hasLoadedHistory || messages.length > 0) return
    
    const showBriefing = async () => {
      try {
        // Get weekly analysis from backend
        const analysisRes = await fetch(`${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/analysis/week`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            user_id: user.id
          })
        })
        
        if (analysisRes.ok) {
          const analysis = await analysisRes.json()
          
          if (analysis.success && analysis.analysis) {
            // Build the briefing message from the analysis
            let briefingMessage = analysis.analysis.greeting
            
            // Add key insights if any
            if (analysis.analysis.insights && analysis.analysis.insights.length > 0) {
              briefingMessage += '\n\n📊 Key Insights:\n'
              analysis.analysis.insights.forEach((insight: any) => {
                const icon = insight.type === 'warning' ? '⚠️' : 
                            insight.type === 'health' ? '💪' :
                            insight.type === 'productivity' ? '🎯' : '💡'
                briefingMessage += `${icon} ${insight.message}\n`
              })
            }
            
            // Add quick action suggestions if any
            if (analysis.analysis.quickActions && analysis.analysis.quickActions.length > 0) {
              briefingMessage += '\n🚀 Quick Actions:\n'
              analysis.analysis.quickActions.forEach((action: any, index: number) => {
                briefingMessage += `${index + 1}. ${action.label}\n`
              })
            }
            
            briefingMessage += '\nWhat would you like to work on today?'
            
            setMessages([{
              id: 'briefing-' + Date.now(),
              content: briefingMessage,
              sender: 'assistant',
              timestamp: new Date().toISOString()
            }])
            
            return
          }
        }
        
        // Fallback to simple briefing if analysis fails
        const today = new Date()
        const currentHour = today.getHours()
        const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening'
        
        setMessages([{
          id: 'welcome-' + Date.now(),
          content: `${greeting}! I'm your personal assistant. How can I help you manage your day?`,
          sender: 'assistant',
          timestamp: new Date().toISOString()
        }])
        
      } catch (err) {
        console.error('Error showing briefing:', err)
        // If briefing fails, show a simple time-aware message
        const hour = new Date().getHours()
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
        setMessages([{
          id: 'welcome-' + Date.now(),
          content: `${greeting}! I'm your personal assistant. How can I help you manage your day?`,
          sender: 'assistant',
          timestamp: new Date().toISOString()
        }])
      }
    }
    
    showBriefing()
  }, [user, session, sessionId, hasLoadedHistory, messages.length])

  useEffect(() => {
    if (!isPolling) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      return
    }
    async function fetchMessages() {
      if (!user || !session?.access_token || !sessionId) return
      try {
        const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/chat/history`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            user_id: user.id,
            session_id: sessionId
          })
        })
        if (!res.ok) {
          console.error('Error fetching messages: HTTP', res.status)
          return
        }
        const result = await res.json()
        if (result.success && Array.isArray(result.messages)) {
          setMessages(result.messages)
          if (result.messages.length > 0) {
            lastTimestampRef.current = result.messages[result.messages.length - 1].timestamp
          }
        } else {
          console.error('Error fetching messages:', result.error)
        }
      } catch (err) {
        console.error('Error fetching messages:', err)
      }
    }
    // Load messages initially, but don't poll since we have streaming
    fetchMessages()
    
    // Only poll if streaming is disabled
    if (!isPolling) {
      pollingRef.current = setInterval(fetchMessages, 10000) // Reduced to 10 seconds
    }
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [isPolling, user, sessionId])

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
          if (typeof result.response === 'object' && result.response.content) {
            responseContent = result.response.content
          } else if (typeof result.response === 'string') {
            responseContent = result.response
          }
        } else if (result.content) {
          responseContent = result.content
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
                {msg.content}
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