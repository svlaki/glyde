/// <reference types="vite/client" />
import React, { useRef, useState, useEffect } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useAuth } from '../../lib/authContext'
import { supabase } from '../../lib/supabase'

function generateSessionId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef<string>(generateSessionId())
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimestampRef = useRef<string | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const { user, session, isAuthenticated } = useAuth()

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

  useEffect(() => {
    if (!isPolling) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      return
    }
    async function fetchMessages() {
      if (!user || !session?.access_token) return
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
            session_id: sessionId.current
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
  }, [isPolling, user])

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
    // Use regular chat endpoint for now (streaming has issues)
    try {
      const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/chat`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          message: input,
          session_id: sessionId.current
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.response) {
          const aiMsg: ChatMessage = {
            id: `${Date.now()}-ai`,
            content: result.response,
            sender: 'assistant',
            timestamp: new Date().toISOString()
          }
          setMessages(prev => [...prev, aiMsg])
          lastTimestampRef.current = aiMsg.timestamp
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
    <div className="flex flex-col h-full w-full bg-white rounded-lg">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        {messages.length === 0 && (
          <div className="text-gray-500 text-center py-12">
            <div className="text-lg mb-2">💬</div>
            <div>Start a conversation with your assistant</div>
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[75%] ${msg.sender === 'user' ? 'order-2' : 'order-1'}`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm break-words ${
                  msg.sender === 'user' 
                    ? 'bg-black text-white rounded-br-md' 
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
              <div className={`text-xs mt-1 px-2 ${
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
      <div className="p-4 bg-white">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type your message..."
              className="bg-gray-50 border-gray-200 text-black placeholder-gray-500 rounded-full px-4 py-3 focus:ring-2 focus:ring-black focus:border-transparent"
              autoFocus
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-black hover:bg-gray-800 text-white rounded-full px-6 py-3 min-w-[80px]"
          >
            Send
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