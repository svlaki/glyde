import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
}

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export function ChatBot() {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const [messages, setMessages] = useState<Message[]>([])

  // Reset messages when user changes
  useEffect(() => {
    setMessages([
      {
        id: '1',
        text: 'Hey! I\'m your AI assistant. Ask me anything about your schedule!',
        sender: 'bot',
        timestamp: new Date()
      }
    ])
  }, [user?.id])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user || !session) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      console.log('Sending chat message to:', `${AGENT_SERVICE_URL}/api/agent/process`)
      console.log('Message:', userMessage.text)

      // Build conversation history from messages (excluding the welcome message and current message)
      const conversationHistory = messages
        .filter(msg => msg.id !== '1') // Exclude welcome message
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }))

      console.log('Conversation history length:', conversationHistory.length)

      const response = await fetch(`${AGENT_SERVICE_URL}/api/agent/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          context: {
            userId: user.id,
            sessionId: 'default',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            conversationHistory: conversationHistory
          },
          message: userMessage.text,
          isInternal: false
        })
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', response.status, errorText)
        throw new Error(`API returned ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log('API Response:', data)

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'I received your message!',
        sender: 'bot',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error) {
      console.error('Chat error details:', error)

      let errorText = 'Sorry, I\'m having trouble connecting to the AI service.'

      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorText = '⚠️ Backend server is not running. Start the agent service at localhost:8000'
        } else {
          errorText = `Error: ${error.message}`
        }
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: isDarkMode ? '#1a1a1a' : '#fff'
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px',
        borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
        background: isDarkMode ? '#0a0a0a' : '#fafafa'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
          AI Assistant
        </h3>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '15px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {messages.map(message => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: '12px',
              background: message.sender === 'user' ? (isDarkMode ? '#fff' : '#000') : (isDarkMode ? '#2a2a2a' : '#f0f0f0'),
              color: message.sender === 'user' ? (isDarkMode ? '#000' : '#fff') : (isDarkMode ? '#fff' : '#000'),
              fontSize: '13px',
              lineHeight: '1.4'
            }}>
              {message.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '12px',
              background: isDarkMode ? '#2a2a2a' : '#f0f0f0',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#999',
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: '-0.32s'
                }} />
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#999',
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: '-0.16s'
                }} />
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#999',
                  animation: 'bounce 1.4s infinite ease-in-out both'
                }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '15px',
        borderTop: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask me anything..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
              borderRadius: '6px',
              fontSize: '13px',
              opacity: isLoading ? 0.6 : 1,
              background: isDarkMode ? '#1a1a1a' : '#fff',
              color: isDarkMode ? '#fff' : '#000'
            }}
          />
          <button
            onClick={handleSend}
            className="btn btn-primary"
            disabled={isLoading || !input.trim()}
            style={{
              padding: '10px 16px',
              opacity: (isLoading || !input.trim()) ? 0.5 : 1,
              cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1.0);
          }
        }
      `}</style>
    </div>
  )
}
