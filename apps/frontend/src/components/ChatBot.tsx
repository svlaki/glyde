import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
}

interface ChatBotProps {
  onSetResponseCallback?: (callback: (message: string) => void) => void;
}

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export function ChatBot({ onSetResponseCallback }: ChatBotProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  // Load messages from localStorage or initialize with welcome message
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!user?.id) return []

    const savedMessages = localStorage.getItem(`chat_messages_${user.id}`)
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        // Convert timestamp strings back to Date objects
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      } catch (e) {
        console.error('Failed to parse saved messages:', e)
      }
    }

    // Default welcome message
    return [{
      id: '1',
      text: 'Hello! Ask me anything about your schedule!',
      sender: 'bot',
      timestamp: new Date()
    }]
  })

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (user?.id && messages.length > 0) {
      localStorage.setItem(`chat_messages_${user.id}`, JSON.stringify(messages))
    }
  }, [messages, user?.id])

  // Reset messages when user changes
  useEffect(() => {
    if (!user?.id) return

    const savedMessages = localStorage.getItem(`chat_messages_${user.id}`)
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        setMessages(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })))
      } catch (e) {
        setMessages([
          {
            id: '1',
            text: 'Hello! Ask me anything about your schedule!',
            sender: 'bot',
            timestamp: new Date()
          }
        ])
      }
    } else {
      setMessages([
        {
          id: '1',
          text: 'Hello! Ask me anything about your schedule!',
          sender: 'bot',
          timestamp: new Date()
        }
      ])
    }
  }, [user?.id])

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Set up callback for interaction responses to be added to chat
  // Only register once on mount - don't re-register when callback changes
  useEffect(() => {
    if (onSetResponseCallback) {
      const addResponseToChat = (message: string) => {
        console.log('[ChatBot] Received message from interaction callback:', message, 'type:', typeof message, 'length:', message?.length)
        if (!message || (typeof message === 'string' && message.trim().length === 0)) {
          console.warn('[ChatBot] Received empty/null message from interaction response')
          return
        }
        const botMessage: Message = {
          id: Date.now().toString(),
          text: String(message),
          sender: 'bot',
          timestamp: new Date()
        }
        console.log('[ChatBot] Adding bot message to chat:', botMessage.text)
        setMessages(prev => [...prev, botMessage])
      }
      console.log('[ChatBot] Registering callback with parent')
      onSetResponseCallback(addResponseToChat)
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
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
          errorText = 'Backend server is not running. Start the agent service at localhost:8000'
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
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        //borderBottom: `1px solid ${colors.borderLight}`,
        background: colors.bgPrimary
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: 0,
          color: colors.textPrimary,
          letterSpacing: '0.02em'
        }}>
          AI Assistant
        </h3>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: colors.bgPrimary
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
              maxWidth: '75%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: message.sender === 'user'
                ? (isDarkMode ? '#f0f0f0' : '#000')
                : colors.bgSecondary,
              color: message.sender === 'user'
                ? (isDarkMode ? '#000' : '#fff')
                : colors.textPrimary,
              fontSize: '14px',
              lineHeight: '1.5',
              fontFamily: 'Georgia, "Times New Roman", serif',
              boxShadow: isDarkMode
                ? '0 1px 2px rgba(0,0,0,0.2)'
                : '0 1px 2px rgba(0,0,0,0.06)',
              border: message.sender === 'bot' ? `1px solid ${colors.borderLight}` : 'none'
            }}>
              {message.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: colors.bgSecondary,
              border: `1px solid ${colors.borderLight}`,
              boxShadow: isDarkMode
                ? '0 1px 2px rgba(0,0,0,0.2)'
                : '0 1px 2px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <div style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: colors.textSecondary,
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: '-0.32s'
                }} />
                <div style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: colors.textSecondary,
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: '-0.16s'
                }} />
                <div style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: colors.textSecondary,
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
        padding: '16px 24px 20px 24px',
        borderTop: `1px solid ${colors.borderLight}`,
        background: colors.bgSecondary,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask me anything..."
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              padding: '12px 14px',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              opacity: isLoading ? 0.6 : 1,
              background: colors.bgPrimary,
              color: colors.textPrimary,
              resize: 'none',
              height: '44px',
              maxHeight: '120px',
              overflowY: 'auto',
              fontFamily: 'inherit',
              lineHeight: '1.5',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = isDarkMode ? '#666' : '#ccc'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = '44px'
              target.style.height = Math.min(target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              padding: '12px 20px',
              background: (isLoading || !input.trim())
                ? colors.bgTertiary
                : (isDarkMode ? '#f0f0f0' : '#000'),
              color: (isLoading || !input.trim())
                ? colors.textSecondary
                : (isDarkMode ? '#000' : '#fff'),
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              height: '44px',
              transition: 'opacity 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isLoading && input.trim()) {
                e.currentTarget.style.opacity = '0.9'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            {isLoading ? 'Sending...' : 'Send'}
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
