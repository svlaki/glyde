import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors, hexToRgba } from '../styles/colors'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  hasImage?: boolean
  imageData?: string  // base64 image data, kept for context
}

interface ChatBotProps {
  onSetResponseCallback?: (callback: (message: string) => void) => void;
  hideHeader?: boolean;
  compact?: boolean;
}

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

// Session ID for chat persistence (consistent per user)
const getSessionId = (userId: string): string => `chat_${userId}`

// Sparkle icon for AI assistant
const SparkleIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18M5.5 8.5l13 7M5.5 15.5l13-7" />
    <circle cx="12" cy="12" r="1" fill={color} />
  </svg>
)

// Send arrow icon
const SendIcon = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
)

// Clear/trash icon
const ClearIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
  </svg>
)

// Stop icon for stopping generation
const StopIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" fill={color} />
  </svg>
)

// Image/photo icon for image upload
const ImageIcon = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

// X icon for removing image
const XIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// Format timestamp
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Check if two dates are within the same minute group (5 min)
const isSameTimeGroup = (date1: Date, date2: Date): boolean => {
  const diff = Math.abs(date1.getTime() - date2.getTime())
  return diff < 5 * 60 * 1000 // 5 minutes
}

// Suggestion chips data
const SUGGESTIONS = [
  { label: "What's on today?", icon: "" },
  { label: "Schedule a meeting", icon: "" },
  { label: "Find free time", icon: "" },
]

export function ChatBot({ hideHeader = false, compact = false }: ChatBotProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const location = useLocation()
  const colors = getColors(isDarkMode)

  // Derive current page from pathname
  const getCurrentPage = (): string => {
    const path = location.pathname
    if (path === '/' || path === '/dashboard') return 'dashboard'
    if (path === '/plan') return 'plan'
    if (path.startsWith('/goals')) return 'goals'
    if (path.startsWith('/tasks')) return 'tasks'
    return 'dashboard'
  }

  // Accent colors for user messages (warm terracotta/amber)
  const accentColors = {
    light: {
      userBubble: '#3d3633',
      userText: '#fdfbf7',
    },
    dark: {
      userBubble: '#e8e4de',
      userText: '#1c1b1a',
    }
  }
  const accent = isDarkMode ? accentColors.dark : accentColors.light

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [toolStatus, setToolStatus] = useState<string | null>(null)

  // Image state for vision support
  const [selectedImage, setSelectedImage] = useState<{ base64: string; name: string } | null>(null)

  // Input state - managed locally since AI SDK v5 doesn't manage input internally
  const [input, setInput] = useState('')

  // Messages state - managed locally with native fetch streaming
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [streamingMessage, setStreamingMessage] = useState<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)

  // Create welcome message
  const createWelcomeMessage = useCallback((): Message => ({
    id: 'welcome',
    text: `Hello${user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}! I'm here to help manage your schedule. What would you like to do?`,
    sender: 'bot',
    timestamp: new Date()
  }), [user?.user_metadata?.full_name])

  // Load messages from localStorage (fallback/cache)
  const loadFromLocalStorage = useCallback((): Message[] => {
    if (!user?.id) return []
    const savedMessages = localStorage.getItem(`chat_messages_${user.id}`)
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        return parsed.map((msg: any) => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender === 'assistant' ? 'bot' : msg.sender,
          timestamp: new Date(msg.timestamp)
        }))
      } catch (e) {
        console.error('Failed to parse saved messages:', e)
      }
    }
    return []
  }, [user?.id])

  // Save messages to localStorage (cache)
  const saveToLocalStorage = useCallback((msgs: Message[]) => {
    if (!user?.id) return
    localStorage.setItem(`chat_messages_${user.id}`, JSON.stringify(msgs))
  }, [user?.id])

  // Load messages from API
  const loadFromAPI = useCallback(async (): Promise<Message[] | null> => {
    if (!user?.id || !session?.access_token) return null

    try {
      const response = await fetch(`${AGENT_SERVICE_URL}/api/chat/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          session_id: getSessionId(user.id),
          limit: 100
        })
      })

      if (!response.ok) {
        console.warn('Failed to load chat history from API:', response.status)
        return null
      }

      const data = await response.json()
      if (data.success && Array.isArray(data.messages)) {
        return data.messages.map((msg: any) => ({
          id: msg.id,
          text: msg.content,
          sender: msg.sender === 'assistant' ? 'bot' : msg.sender,
          timestamp: new Date(msg.timestamp)
        }))
      }
      return null
    } catch (error) {
      console.warn('Error loading chat history from API:', error)
      return null
    }
  }, [user?.id, session?.access_token])

  // Save a single message to API (fire and forget, with localStorage backup)
  const saveMessageToAPI = useCallback(async (message: Message) => {
    if (!user?.id || !session?.access_token) return

    try {
      await fetch(`${AGENT_SERVICE_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          session_id: getSessionId(user.id),
          content: message.text,
          sender: message.sender === 'bot' ? 'assistant' : message.sender,
          metadata: { originalId: message.id }
        })
      })
    } catch (error) {
      console.warn('Failed to save message to API (using localStorage cache):', error)
    }
  }, [user?.id, session?.access_token])

  // Initialize messages on mount - API first, localStorage fallback
  useEffect(() => {
    const initializeMessages = async () => {
      if (!user?.id) return

      setIsInitializing(true)

      // Try API first
      const apiMessages = await loadFromAPI()

      if (apiMessages && apiMessages.length > 0) {
        setMessages(apiMessages)
        saveToLocalStorage(apiMessages) // Update local cache
      } else {
        // Fallback to localStorage
        const localMessages = loadFromLocalStorage()
        if (localMessages.length > 0) {
          setMessages(localMessages)
        } else {
          // No messages anywhere, show welcome
          setMessages([createWelcomeMessage()])
        }
      }

      setIsInitializing(false)
    }

    initializeMessages()
  }, [user?.id, session?.access_token, loadFromAPI, loadFromLocalStorage, saveToLocalStorage, createWelcomeMessage])

  // Save messages to localStorage whenever they change (cache layer)
  useEffect(() => {
    if (user?.id && messages.length > 0 && !isLoading && !isInitializing) {
      saveToLocalStorage(messages)
    }
  }, [messages, user?.id, isLoading, isInitializing, saveToLocalStorage])

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, streamingMessage])

  // Clear chat handler
  const handleClearChat = async () => {
    const welcomeMessage = createWelcomeMessage()
    setMessages([welcomeMessage])
    setStreamingMessage('')

    if (user?.id) {
      // Clear localStorage cache
      localStorage.setItem(`chat_messages_${user.id}`, JSON.stringify([welcomeMessage]))

      // Clear server-side history (fire and forget)
      if (session?.access_token) {
        try {
          await fetch(`${AGENT_SERVICE_URL}/api/chat/clear`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              session_id: getSessionId(user.id)
            })
          })
        } catch (error) {
          console.warn('Failed to clear chat history on server:', error)
        }
      }
    }
  }

  // Stop streaming handler
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    // If there was partial streaming content, save it as a message
    if (streamingMessage) {
      const botMessage: Message = {
        id: `msg_${Date.now()}`,
        text: streamingMessage + ' [stopped]',
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, botMessage])
      setStreamingMessage('')
    }
    setIsLoading(false)
  }

  // Suggestion click handler
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }

  // Image upload handlers
  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.warn('Selected file is not an image')
      return
    }

    // Validate file size (max 20MB per OpenAI limits)
    if (file.size > 20 * 1024 * 1024) {
      console.warn('Image too large (max 20MB)')
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setSelectedImage({ base64, name: file.name })
    }
    reader.readAsDataURL(file)

    // Clear the input so the same file can be selected again
    e.target.value = ''
  }

  const handleRemoveImage = () => {
    setSelectedImage(null)
  }

  // Send message with native fetch streaming
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmedInput = input.trim()
    // Allow sending with just an image (no text required)
    if ((!trimmedInput && !selectedImage) || isLoading || !user || !session) return

    // Capture and clear image before async operations
    const imageToSend = selectedImage
    setSelectedImage(null)

    // Add user message to chat
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      text: trimmedInput,
      sender: 'user',
      timestamp: new Date(),
      hasImage: !!imageToSend,
      imageData: imageToSend?.base64  // Store for context window
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setStreamingMessage('')

    // Save user message to API (fire and forget)
    saveMessageToAPI(userMessage)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '36px'
    }

    // Build conversation history (exclude welcome message)
    // Keep images in context for the last 5 messages
    const IMAGE_CONTEXT_WINDOW = 5
    const filteredMessages = messages.filter(msg => msg.id !== 'welcome' && msg.id !== '1')
    const recentMessageCount = filteredMessages.length

    const conversationHistory = filteredMessages.map((msg, index) => {
      const messagesFromEnd = recentMessageCount - index
      const includeImage = msg.imageData && messagesFromEnd <= IMAGE_CONTEXT_WINDOW

      if (includeImage && msg.sender === 'user') {
        // Include image in content array for recent messages
        return {
          role: 'user' as const,
          content: [
            { type: 'text', text: msg.text || 'Sent an image' },
            { type: 'image_url', image_url: { url: msg.imageData } }
          ]
        }
      }
      return {
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.text
      }
    })

    // Build current message content (with image if present)
    let currentMessageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
    if (imageToSend) {
      currentMessageContent = [
        { type: 'text', text: trimmedInput || 'What is in this image?' },
        { type: 'image_url', image_url: { url: imageToSend.base64 } }
      ]
    } else {
      currentMessageContent = trimmedInput
    }

    try {
      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController()

      const response = await fetch(`${AGENT_SERVICE_URL}/api/agent/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          messages: [
            ...conversationHistory,
            { role: 'user', content: currentMessageContent }
          ],
          context: {
            userId: user.id,
            sessionId: 'default',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            conversationHistory,
            currentPage: getCurrentPage()
          }
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Read the stream
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No reader available')
      }

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })

        // Parse status updates from the stream
        // Format: [STATUS:message] - extract and show in toolStatus
        const statusMatch = chunk.match(/\[STATUS:([^\]]+)\]/g)
        if (statusMatch) {
          // Extract the last status message
          const lastStatus = statusMatch[statusMatch.length - 1]
          const statusContent = lastStatus.replace(/\[STATUS:|\]/g, '')
          setToolStatus(statusContent)

          // Remove status markers from the text content
          const cleanChunk = chunk.replace(/\[STATUS:[^\]]+\]/g, '')
          if (cleanChunk) {
            fullText += cleanChunk
            setStreamingMessage(fullText)
          }
        } else {
          // No status markers, just regular text
          fullText += chunk
          setStreamingMessage(fullText)
          // Clear status once we start getting actual text
          if (fullText.length > 0) {
            setToolStatus(null)
          }
        }
      }

      // Add the complete bot message
      const botMessage: Message = {
        id: `msg_${Date.now()}`,
        text: fullText,
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, botMessage])
      setStreamingMessage('')
      setToolStatus(null)

      // Save bot message to API (fire and forget)
      saveMessageToAPI(botMessage)

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Stream was aborted')
      } else {
        console.error('Streaming error:', error)
        // Add error message
        const errorMessage: Message = {
          id: `msg_${Date.now()}`,
          text: 'Sorry, I encountered an error. Please try again.',
          sender: 'bot',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
        setStreamingMessage('')
      }
    } finally {
      setIsLoading(false)
      setToolStatus(null)
      abortControllerRef.current = null
    }
  }

  // Determine if we should show timestamp for a message
  const shouldShowTimestamp = (index: number): boolean => {
    if (index === 0) return true
    const prevMessage = messages[index - 1]
    const currentMessage = messages[index]

    // Safety check for undefined messages
    if (!prevMessage || !currentMessage) return true

    // Show timestamp if sender changed or time gap > 5 min
    if (prevMessage.sender !== currentMessage.sender) return false
    return !isSameTimeGroup(prevMessage.timestamp, currentMessage.timestamp)
  }

  // Determine if message is first in a group from same sender
  const isFirstInGroup = (index: number): boolean => {
    if (index === 0) return true
    const prevMessage = messages[index - 1]
    const currentMessage = messages[index]
    if (!prevMessage || !currentMessage) return true
    return prevMessage.sender !== currentMessage.sender
  }

  // Determine if message is last in a group from same sender
  const isLastInGroup = (index: number): boolean => {
    if (index === messages.length - 1) return true
    const nextMessage = messages[index + 1]
    const currentMessage = messages[index]
    if (!nextMessage || !currentMessage) return true
    return nextMessage.sender !== currentMessage.sender
  }

  const showSuggestions = messages.length <= 1 && !isLoading

  // Check if we're currently streaming
  const isStreaming = isLoading && streamingMessage.length > 0

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: colors.bgPrimary,
    }}>
      {/* Header */}
      {!hideHeader && (
        <div style={{
          padding: 'clamp(12px, 2vh, 16px) clamp(12px, 3vw, 20px)',
          borderBottom: `1px solid ${colors.borderLight}`,
          background: colors.bgPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: `linear-gradient(135deg, ${hexToRgba(colors.textSecondary, 0.1)}, ${hexToRgba(colors.textSecondary, 0.05)})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${colors.borderLight}`,
            }}>
              <SparkleIcon size={16} color={colors.textSecondary} />
            </div>
            <div>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '600',
                margin: 0,
                color: colors.textPrimary,
                fontFamily: '"EB Garamond", Georgia, serif',
                letterSpacing: '0.01em',
              }}>
                Assistant
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginTop: '1px',
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isLoading ? '#fbbf24' : '#4ade80',
                  boxShadow: isLoading
                    ? '0 0 6px rgba(251, 191, 36, 0.4)'
                    : '0 0 6px rgba(74, 222, 128, 0.4)',
                }} />
                <span style={{
                  fontSize: '11px',
                  color: colors.textTertiary,
                  fontWeight: '500',
                }}>
                  {isLoading ? 'Typing...' : 'Online'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClearChat}
            title="Clear conversation"
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              color: colors.textTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.bgTertiary
              e.currentTarget.style.color = colors.textSecondary
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = colors.textTertiary
            }}
          >
            <ClearIcon size={16} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'clamp(12px, 2.5vh, 20px) clamp(8px, 2vw, 16px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        {messages.map((message, index) => {
          const isUser = message.sender === 'user'
          const isFirst = isFirstInGroup(index)
          const isLast = isLastInGroup(index)
          const showTime = shouldShowTimestamp(index)
          const isHovered = hoveredMessageId === message.id
          const isLastMessage = index === messages.length - 1
          const showCursor = isStreaming && isLastMessage && !isUser

          return (
            <div key={message.id}>
              {/* Time separator for long gaps */}
              {showTime && index > 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '12px 0',
                }}>
                  <span style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    background: colors.bgPrimary,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.borderLight}`,
                  }}>
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end',
                  gap: '8px',
                  marginTop: isFirst ? '8px' : '2px',
                  paddingLeft: isUser ? '48px' : '0',
                  paddingRight: isUser ? '0' : '48px',
                  animation: index === messages.length - 1 && !isStreaming ? 'messageSlideIn 0.25s ease-out' : 'none',
                }}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {/* Bot avatar - only show for first message in group */}
                {!isUser && (
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: isFirst ? colors.bgTertiary : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    opacity: isFirst ? 1 : 0,
                    border: isFirst ? `1px solid ${colors.borderLight}` : 'none',
                  }}>
                    <SparkleIcon size={14} color={colors.textSecondary} />
                  </div>
                )}

                {/* Message bubble */}
                <div style={{
                  position: 'relative',
                  maxWidth: '85%',
                }}>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: isUser
                      ? `14px 14px ${isLast ? '4px' : '14px'} 14px`
                      : `14px 14px 14px ${isLast ? '4px' : '14px'}`,
                    background: isUser ? accent.userBubble : colors.bgSecondary,
                    color: isUser ? accent.userText : colors.textPrimary,
                    fontSize: '14px',
                    lineHeight: '1.55',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    boxShadow: isUser
                      ? 'none'
                      : `0 1px 2px ${hexToRgba(colors.textPrimary, 0.04)}`,
                    border: isUser ? 'none' : `1px solid ${colors.borderLight}`,
                    wordBreak: 'break-word',
                  }}>
                    {isUser ? (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        {message.hasImage && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            background: 'rgba(255,255,255,0.2)',
                            flexShrink: 0,
                            marginTop: '1px',
                          }}>
                            <ImageIcon size={12} color="currentColor" />
                          </div>
                        )}
                        <span>{message.text || 'Sent an image'}</span>
                      </div>
                    ) : (
                      <div className="chat-markdown">
                        <ReactMarkdown
                          components={{
                            // Paragraphs
                            p: ({ children }) => (
                              <p style={{ margin: '0 0 8px 0' }}>{children}</p>
                            ),
                            // Bold text
                            strong: ({ children }) => (
                              <strong style={{
                                fontWeight: 600,
                                color: colors.textPrimary,
                              }}>{children}</strong>
                            ),
                            // Unordered lists
                            ul: ({ children }) => (
                              <ul style={{
                                margin: '8px 0',
                                paddingLeft: '20px',
                                listStyleType: 'disc',
                              }}>{children}</ul>
                            ),
                            // Ordered lists
                            ol: ({ children }) => (
                              <ol style={{
                                margin: '8px 0',
                                paddingLeft: '20px',
                                listStyleType: 'decimal',
                              }}>{children}</ol>
                            ),
                            // List items
                            li: ({ children }) => (
                              <li style={{
                                margin: '4px 0',
                                lineHeight: '1.5',
                                paddingLeft: '4px',
                              }}>
                                {children}
                              </li>
                            ),
                            // Horizontal rules (for --- separators)
                            hr: () => (
                              <hr style={{
                                border: 'none',
                                borderTop: `1px solid ${colors.borderLight}`,
                                margin: '12px 0',
                              }} />
                            ),
                            // Code blocks (inline)
                            code: ({ children }) => (
                              <code style={{
                                background: colors.bgTertiary,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontFamily: 'monospace',
                              }}>{children}</code>
                            ),
                          }}
                        >
                          {message.text}
                        </ReactMarkdown>
                        {/* Blinking cursor during streaming */}
                        {showCursor && (
                          <span className="streaming-cursor" style={{
                            display: 'inline-block',
                            width: '2px',
                            height: '1em',
                            background: colors.textSecondary,
                            marginLeft: '2px',
                            verticalAlign: 'text-bottom',
                            animation: 'blink 1s infinite',
                          }} />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Timestamp on hover */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-18px',
                    [isUser ? 'right' : 'left']: '4px',
                    fontSize: '10px',
                    color: colors.textTertiary,
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Streaming message - show text as it streams in */}
        {isStreaming && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginTop: '8px',
            animation: 'messageSlideIn 0.25s ease-out',
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: colors.bgTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${colors.borderLight}`,
              flexShrink: 0,
            }}>
              <SparkleIcon size={14} color={colors.textSecondary} />
            </div>
            <div style={{
              padding: '12px 16px',
              borderRadius: '14px 14px 14px 4px',
              background: colors.bgSecondary,
              border: `1px solid ${colors.borderLight}`,
              maxWidth: '85%',
            }}>
              <div className="chat-markdown" style={{
                fontSize: '14px',
                color: colors.textPrimary,
                lineHeight: '1.5',
              }}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                    strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                    ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: '20px', listStyleType: 'disc' }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: '20px', listStyleType: 'decimal' }}>{children}</ol>,
                    li: ({ children }) => <li style={{ margin: '4px 0', lineHeight: '1.5', paddingLeft: '4px' }}>{children}</li>,
                  }}
                >
                  {streamingMessage}
                </ReactMarkdown>
                <span style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '14px',
                  background: colors.textSecondary,
                  marginLeft: '2px',
                  animation: 'blink 1s infinite',
                  verticalAlign: 'middle',
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator - only show when waiting for first token */}
        {isLoading && !isStreaming && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            marginTop: '8px',
            animation: 'messageSlideIn 0.25s ease-out',
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: colors.bgTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${colors.borderLight}`,
            }}>
              <SparkleIcon size={14} color={colors.textSecondary} />
            </div>
            <div style={{
              padding: '12px 16px',
              borderRadius: '14px 14px 14px 4px',
              background: colors.bgSecondary,
              border: `1px solid ${colors.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{
                fontSize: '13px',
                color: colors.textSecondary,
                fontStyle: 'italic',
              }}>
                {toolStatus || 'Thinking'}
              </span>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: colors.textTertiary,
                      animation: 'pulse 1.4s infinite ease-in-out both',
                      animationDelay: `${i * 0.16}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tool status indicator during streaming */}
        {isStreaming && toolStatus && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px',
            marginLeft: '36px',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <div style={{
              padding: '6px 12px',
              borderRadius: '12px',
              background: hexToRgba(colors.textTertiary, 0.1),
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#fbbf24',
                animation: 'pulse 1s infinite',
              }} />
              <span style={{
                fontSize: '12px',
                color: colors.textSecondary,
              }}>
                {toolStatus}
              </span>
            </div>
          </div>
        )}


        <div ref={messagesEndRef} style={{ height: '8px' }} />
      </div>

      {/* Suggestion chips */}
      {showSuggestions && !compact && (
        <div style={{
          padding: '0 16px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={() => handleSuggestionClick(suggestion.label)}
              style={{
                padding: '8px 14px',
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '20px',
                fontSize: '13px',
                color: colors.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgTertiary
                e.currentTarget.style.borderColor = colors.textTertiary
                e.currentTarget.style.color = colors.textPrimary
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.bgSecondary
                e.currentTarget.style.borderColor = colors.border
                e.currentTarget.style.color = colors.textSecondary
              }}
            >
              <span>{suggestion.icon}</span>
              <span>{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: 'clamp(8px, 1.5vh, 12px) clamp(8px, 2vw, 16px)',
        paddingBottom: 'clamp(12px, 2vh, 16px)',
        borderTop: `1px solid ${colors.borderLight}`,
        background: colors.bgSecondary,
        flexShrink: 0,
      }}>
        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />

        {/* Image preview */}
        {selectedImage && (
          <div style={{
            marginBottom: '8px',
            padding: '8px',
            background: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <img
              src={selectedImage.base64}
              alt="Selected"
              style={{
                width: '48px',
                height: '48px',
                objectFit: 'cover',
                borderRadius: '8px',
              }}
            />
            <span style={{
              flex: 1,
              fontSize: '13px',
              color: colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {selectedImage.name}
            </span>
            <button
              type="button"
              onClick={handleRemoveImage}
              style={{
                width: '24px',
                height: '24px',
                padding: 0,
                background: colors.bgTertiary,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textTertiary,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.bgTertiary
                e.currentTarget.style.color = colors.textTertiary
              }}
            >
              <XIcon size={12} />
            </button>
          </div>
        )}

        <form onSubmit={handleSend}>
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-end',
            background: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '14px',
            padding: '4px 4px 4px 14px',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
              placeholder="Ask me anything..."
              disabled={isLoading}
              rows={1}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                fontSize: '14px',
                background: 'transparent',
                color: colors.textPrimary,
                resize: 'none',
                height: '36px',
                maxHeight: '100px',
                overflowY: 'auto',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                outline: 'none',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = '36px'
                target.style.height = Math.min(target.scrollHeight, 100) + 'px'
              }}
            />
            {/* Image upload button */}
            {!isLoading && (
              <button
                type="button"
                onClick={handleImageClick}
                title="Upload image"
                style={{
                  width: '36px',
                  height: '36px',
                  padding: 0,
                  background: selectedImage ? hexToRgba(colors.textSecondary, 0.15) : 'transparent',
                  color: selectedImage ? colors.textPrimary : colors.textTertiary,
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bgTertiary
                  e.currentTarget.style.color = colors.textSecondary
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selectedImage ? hexToRgba(colors.textSecondary, 0.15) : 'transparent'
                  e.currentTarget.style.color = selectedImage ? colors.textPrimary : colors.textTertiary
                }}
              >
                <ImageIcon size={18} />
              </button>
            )}
            {isLoading ? (
              <button
                type="button"
                onClick={handleStop}
                title="Stop generating"
                style={{
                  width: '36px',
                  height: '36px',
                  padding: 0,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <StopIcon size={14} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!(input ?? '').trim() && !selectedImage}
                style={{
                  width: '36px',
                  height: '36px',
                  padding: 0,
                  background: (!(input ?? '').trim() && !selectedImage)
                    ? colors.bgTertiary
                    : accent.userBubble,
                  color: (!(input ?? '').trim() && !selectedImage)
                    ? colors.textTertiary
                    : accent.userText,
                  border: 'none',
                  borderRadius: '10px',
                  cursor: (!(input ?? '').trim() && !selectedImage) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if ((input ?? '').trim() || selectedImage) {
                    e.currentTarget.style.transform = 'scale(1.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <SendIcon size={16} />
              </button>
            )}
          </div>
        </form>
        <div style={{
          marginTop: '8px',
          textAlign: 'center',
        }}>
          <span style={{
            fontSize: '11px',
            color: colors.textTertiary,
          }}>
            Press Enter to send · Shift + Enter for new line
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes blink {
          0%, 50% {
            opacity: 1;
          }
          51%, 100% {
            opacity: 0;
          }
        }

        /* Markdown styling for chat messages */
        .chat-markdown p:last-child {
          margin-bottom: 0;
        }
        .chat-markdown ul:last-child {
          margin-bottom: 0;
        }
        .chat-markdown hr:last-child {
          display: none;
        }
      `}</style>
    </div>
  )
}
