import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../lib/authContext'
import { trackEvent } from '../lib/analytics'
import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontFamily, fontSize, fontWeight, lineHeight } from '../styles/typography'
import { mobileSpacing } from '../styles/mobileStyles'
import { ClearButton } from './ui/IconButtons'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  hasImage?: boolean
  imageData?: string  // base64 image data, kept for context
  hasFile?: boolean
  fileName?: string
  fileData?: string  // base64 PDF data
}

// Expose ChatBot ref handle for external control
export interface ChatBotHandle {
  isLoading: boolean;
  clearChat: () => void;
  sendMessage: (text: string) => void;
}

interface ChatBotProps {
  onSetResponseCallback?: (callback: (message: string) => void) => void;
  hideHeader?: boolean;
  compact?: boolean;
  mobileEmbedded?: boolean;  // When true: no sparkle icon, reduced header gap, mobile-optimized layout
  currentPageOverride?: string;  // Override getCurrentPage() for embedded contexts (e.g., onboarding)
  autoSendMessage?: string;  // Auto-send this message after initialization
}

// Export ClearIcon for use in external headers
export { ClearIcon }

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

// Session ID for chat persistence (consistent per user)
const getSessionId = (userId: string): string => `chat_${userId}`


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

// Paperclip icon for file upload
const FileIcon = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </svg>
)

// PDF document icon for file preview
const PdfDocIcon = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

// Format timestamp
const formatTime = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Check if two dates are within the same minute group (5 min)
const isSameTimeGroup = (date1: Date, date2: Date): boolean => {
  const diff = Math.abs(date1.getTime() - date2.getTime())
  return diff < 5 * 60 * 1000 // 5 minutes
}

// Suggestion chips data
const SUGGESTIONS = [
  { label: "Schedule a meeting", icon: "" },
  { label: "Find free time", icon: "" },
]

export const ChatBot = forwardRef<ChatBotHandle, ChatBotProps>(function ChatBot({ hideHeader = false, compact = false, mobileEmbedded = false, currentPageOverride, autoSendMessage }, ref) {
  const { user, session, preferredName } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const { refreshAspects } = useAspects()
  const currentLocation = useGeolocation()
  const location = useLocation()
  const colors = getColors(theme)
  const typography = getTypography(false) // Desktop-scaled mobile fonts

  // Derive current page from pathname (or use override for embedded contexts)
  const getCurrentPage = (): string => {
    if (currentPageOverride) return currentPageOverride
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

  // File (PDF) state
  const pdfFileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<{ base64: string; name: string; size: number } | null>(null)

  // Input state - managed locally since AI SDK v5 doesn't manage input internally
  const [input, setInput] = useState('')

  // Messages state - managed locally with native fetch streaming
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [streamingMessage, setStreamingMessage] = useState<string>('')
  const [queueCount, setQueueCount] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Message queue for sending while agent is processing
  const messageQueueRef = useRef<Array<{ text: string; image: { base64: string; name: string } | null; file: { base64: string; name: string; size: number } | null; messageId: string }>>([])
  const isProcessingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])

  // Expose handle for external control (e.g., header integration, interaction chat replies)
  useImperativeHandle(ref, () => ({
    get isLoading() { return isLoading },
    clearChat: () => handleClearChat(),
    sendMessage: (text: string) => {
      setInput(text)
      // Trigger send on next tick after input state updates
      setTimeout(() => {
        const form = document.querySelector('form[data-chatbot-form]') as HTMLFormElement
        if (form) {
          form.requestSubmit()
        }
      }, 50)
    }
  }), [isLoading])

  // Create welcome message
  const displayName = preferredName || user?.user_metadata?.full_name?.split(' ')[0] || null
  const createWelcomeMessage = useCallback((): Message => ({
    id: 'welcome',
    text: `Hello${displayName ? `, ${displayName}` : ''}! I'm here to help manage your schedule. What would you like to do?`,
    sender: 'bot',
    timestamp: new Date()
  }), [displayName])

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
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
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

  // Keep messagesRef in sync for queue processing
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, streamingMessage])

  // Auto-send initial message (for embedded contexts like post-onboarding chat)
  const autoSendFired = useRef(false)
  useEffect(() => {
    if (!autoSendMessage || autoSendFired.current || isInitializing || isLoading || !user || !session) return
    autoSendFired.current = true
    // Delay slightly to let welcome message render
    const timer = setTimeout(() => {
      setInput(autoSendMessage)
      // Need to trigger send on next tick after input state updates
      setTimeout(() => {
        const form = document.querySelector('form[data-chatbot-form]') as HTMLFormElement
        if (form) {
          form.requestSubmit()
        }
      }, 50)
    }, 500)
    return () => clearTimeout(timer)
  }, [autoSendMessage, isInitializing, isLoading, user, session])

  // Clear chat handler
  const handleClearChat = async () => {
    // Clear queue and stop processing
    messageQueueRef.current = []
    setQueueCount(0)
    isProcessingRef.current = false
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    const welcomeMessage = createWelcomeMessage()
    setMessages([welcomeMessage])
    setStreamingMessage('')
    setIsLoading(false)
    setSelectedImage(null)
    setSelectedFile(null)

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
    // Clear the queue - user wants to interrupt
    messageQueueRef.current = []
    setQueueCount(0)
    isProcessingRef.current = false

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

  // PDF file upload handlers
  const handleFileClick = () => {
    pdfFileInputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setSelectedFile({ base64, name: file.name, size: file.size })
    }
    reader.readAsDataURL(file)

    // Clear the input so the same file can be selected again
    e.target.value = ''
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
  }

  // Process a single message through the agent stream
  // messageId: when processing a queued message, this is its ID in the messages array
  //   so we can build history up to (but not including) this message to avoid duplication
  const processMessage = async (
    trimmedInput: string,
    imageToSend: { base64: string; name: string } | null,
    fileToSend?: { base64: string; name: string; size: number } | null,
    messageId?: string
  ) => {
    if (!user || !session) return

    isProcessingRef.current = true
    setIsLoading(true)
    setStreamingMessage('')

    // Build conversation history from ref (always current)
    const IMAGE_CONTEXT_WINDOW = 5
    const currentMessages = messagesRef.current

    // For queued messages, only include history up to (not including) this message
    // to avoid sending the same user message twice
    let historySource: Message[]
    if (messageId) {
      const msgIndex = currentMessages.findIndex(m => m.id === messageId)
      historySource = msgIndex >= 0 ? currentMessages.slice(0, msgIndex) : currentMessages
    } else {
      historySource = currentMessages
    }
    const filteredMessages = historySource.filter(msg => msg.id !== 'welcome' && msg.id !== '1')
    const recentMessageCount = filteredMessages.length

    const conversationHistory = filteredMessages.map((msg, index) => {
      const messagesFromEnd = recentMessageCount - index
      const includeImage = msg.imageData && messagesFromEnd <= IMAGE_CONTEXT_WINDOW

      if (includeImage && msg.sender === 'user') {
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

    // Build current message content (with image/file if present)
    let currentMessageContent: string | Array<Record<string, any>>
    if (imageToSend || fileToSend) {
      const parts: Array<Record<string, any>> = [
        { type: 'text', text: trimmedInput || (imageToSend ? 'What is in this image?' : 'Please analyze this PDF.') }
      ]
      if (imageToSend) {
        parts.push({ type: 'image_url', image_url: { url: imageToSend.base64 } })
      }
      if (fileToSend) {
        parts.push({ type: 'file', file: { data: fileToSend.base64, name: fileToSend.name } })
      }
      currentMessageContent = parts
    } else {
      currentMessageContent = trimmedInput
    }

    try {
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
            currentPage: getCurrentPage(),
            location: currentLocation ?? undefined
          }
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

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

        const statusMatch = chunk.match(/\[STATUS:([^\]]+)\]/g)
        if (statusMatch && statusMatch.length > 0) {
          const lastStatus = statusMatch[statusMatch.length - 1]!
          const statusContent = lastStatus.replace(/\[STATUS:|\]/g, '')
          setToolStatus(statusContent)

          const cleanChunk = chunk.replace(/\[STATUS:[^\]]+\]/g, '')
          if (cleanChunk) {
            fullText += cleanChunk
            setStreamingMessage(fullText)
          }
        } else {
          fullText += chunk
          setStreamingMessage(fullText)
          if (fullText.length > 0) {
            setToolStatus(null)
          }
        }
      }

      const botMessage: Message = {
        id: `msg_${Date.now()}`,
        text: fullText,
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, botMessage])
      setStreamingMessage('')
      setToolStatus(null)

      saveMessageToAPI(botMessage)
      refreshAspects()

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Stream was aborted - don't process queue
        return
      } else {
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
      setToolStatus(null)
      abortControllerRef.current = null

      // Process next queued message if any
      if (messageQueueRef.current.length > 0) {
        const next = messageQueueRef.current[0]!
        messageQueueRef.current = messageQueueRef.current.slice(1)
        setQueueCount(messageQueueRef.current.length)
        // Small delay to let React flush state updates (so messagesRef is current)
        await new Promise(resolve => setTimeout(resolve, 50))
        await processMessage(next.text, next.image, next.file, next.messageId)
      } else {
        isProcessingRef.current = false
        setIsLoading(false)
        setQueueCount(0)
      }
    }
  }

  // Send message - adds to chat immediately, queues if agent is busy
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmedInput = input.trim()
    if ((!trimmedInput && !selectedImage && !selectedFile) || !user || !session) return

    const imageToSend = selectedImage
    const fileToSend = selectedFile
    setSelectedImage(null)
    setSelectedFile(null)

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      text: trimmedInput,
      sender: 'user',
      timestamp: new Date(),
      hasImage: !!imageToSend,
      ...(imageToSend?.base64 ? { imageData: imageToSend.base64 } : {}),
      hasFile: !!fileToSend,
      ...(fileToSend ? { fileName: fileToSend.name, fileData: fileToSend.base64 } : {})
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')

    saveMessageToAPI(userMessage)
    trackEvent('chat_message_sent', 'agent')

    if (inputRef.current) {
      inputRef.current.style.height = mobileEmbedded ? '32px' : '36px'
    }

    // If already processing, queue for later
    if (isProcessingRef.current) {
      messageQueueRef.current = [...messageQueueRef.current, { text: trimmedInput, image: imageToSend, file: fileToSend, messageId: userMessage.id }]
      setQueueCount(messageQueueRef.current.length)
      return
    }

    await processMessage(trimmedInput, imageToSend, fileToSend)
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
      flex: 1,
      minHeight: 0,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: colors.bgSecondary,
    }}>
      {/* Header */}
      {!hideHeader && (
        mobileEmbedded ? (
          /* Flattened single-div layout for mobile */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: colors.bgSecondary,
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              flex: 1,
            }}>
              <span style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: colors.textPrimary,
                fontFamily: fontFamily.serif,
              }}>
                Assistant
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <div style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: isLoading ? '#fbbf24' : '#4ade80',
                  transform: 'translateY(1px)',  // Visually align dot with text baseline
                }} />
                <span style={{
                  fontSize: fontSize.xs,
                  color: colors.textTertiary,
                  fontWeight: fontWeight.medium,
                }}>
                  {isLoading ? 'Typing...' : 'Online'}
                </span>
              </div>
            </div>
            <button
              onClick={handleClearChat}
              title="Clear conversation"
              style={{
                padding: '4px',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
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
              <ClearIcon size={14} />
            </button>
          </div>
        ) : (
          /* Desktop layout - Mobile-style header */
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${colors.border}`,
            background: colors.bgSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{
                ...typography.headingLg,
                fontWeight: fontWeight.bold,
                margin: 0,
                color: colors.textPrimary,
              }}>
                Chat
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isLoading ? '#fbbf24' : '#4ade80',
                }} />
                <span style={{
                  ...typography.labelMd,
                  color: colors.textTertiary,
                }}>
                  {isLoading ? 'Typing...' : 'Online'}
                </span>
              </div>
            </div>

            <ClearButton onClick={handleClearChat} title="Clear conversation" />
          </div>
        )
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        minHeight: 0,  // Critical for flex scrolling
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',  // Momentum scrolling on iOS
        padding: mobileEmbedded
          ? `12px ${mobileSpacing.paddingX}`  // Use shared mobile padding
          : 'clamp(12px, 2.5vh, 20px) clamp(8px, 2vw, 16px)',
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
                    fontSize: fontSize.xs,
                    color: colors.textTertiary,
                    background: colors.bgSecondary,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.borderLight}`,
                  }}>
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              )}

              {isUser ? (
                /* User message - bubble aligned right */
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: isFirst ? '12px' : '2px',
                    paddingLeft: mobileEmbedded ? '24px' : '48px',
                    animation: index === messages.length - 1 && !isStreaming ? 'messageSlideIn 0.25s ease-out' : 'none',
                  }}
                  onMouseEnter={() => setHoveredMessageId(message.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  <div style={{ position: 'relative', maxWidth: mobileEmbedded ? '100%' : '85%' }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: `14px 14px 14px 14px`,
                      background: accent.userBubble,
                      color: accent.userText,
                      fontSize: fontSize.lg,
                      lineHeight: lineHeight.normal,
                      fontFamily: fontFamily.sans,
                      wordBreak: 'break-word',
                    }}>
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
                        {message.hasFile && (
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
                            <FileIcon size={12} color="currentColor" />
                          </div>
                        )}
                        <span>{message.text || (message.hasFile ? `Sent ${message.fileName || 'a PDF'}` : 'Sent an image')}</span>
                      </div>
                    </div>
                    {/* Timestamp on hover */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-18px',
                      right: '4px',
                      fontSize: fontSize.xs,
                      color: colors.textTertiary,
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ) : (
                /* Bot message - full width, no bubble */
                <div
                  style={{
                    marginTop: isFirst ? '12px' : '3px',
                    animation: index === messages.length - 1 && !isStreaming ? 'messageSlideIn 0.25s ease-out' : 'none',
                  }}
                  onMouseEnter={() => setHoveredMessageId(message.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  <div className="chat-markdown" style={{
                    fontSize: fontSize.lg,
                    lineHeight: lineHeight.normal,
                    color: colors.textPrimary,
                    fontFamily: fontFamily.serif
                  }}>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p style={{ margin: '0 0 10px 0' }}>{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong style={{
                            fontWeight: fontWeight.semibold,
                            color: colors.textPrimary,
                          }}>{children}</strong>
                        ),
                        ul: ({ children }) => (
                          <ul style={{
                            margin: '6px 0',
                            paddingLeft: '20px',
                            listStyleType: 'disc',
                          }}>{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol style={{
                            margin: '6px 0',
                            paddingLeft: '20px',
                            listStyleType: 'decimal',
                          }}>{children}</ol>
                        ),
                        li: ({ children }) => (
                          <li style={{
                            margin: '3px 0',
                            lineHeight: '1.55',
                            paddingLeft: '4px',
                          }}>
                            {children}
                          </li>
                        ),
                        hr: () => (
                          <hr style={{
                            border: 'none',
                            borderTop: `1px solid ${colors.borderLight}`,
                            margin: '12px 0',
                          }} />
                        ),
                        code: ({ children }) => (
                          <code style={{
                            background: colors.bgTertiary,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: fontSize.base,
                            fontFamily: fontFamily.mono,
                          }}>{children}</code>
                        ),
                      }}
                    >
                      {message.text}
                    </ReactMarkdown>
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
                  {/* Timestamp on hover */}
                  <div style={{
                    fontSize: fontSize.xs,
                    color: colors.textTertiary,
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.15s ease',
                    marginTop: '4px',
                  }}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Streaming message - full width, no bubble */}
        {isStreaming && (
          <div style={{
            marginTop: '12px',
            animation: 'messageSlideIn 0.25s ease-out',
          }}>
            <div className="chat-markdown" style={{
              fontSize: fontSize.lg,
              color: colors.textPrimary,
              lineHeight: lineHeight.normal,
              fontFamily: fontFamily.sans,
            }}>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: '0 0 10px 0' }}>{children}</p>,
                  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                  ul: ({ children }) => <ul style={{ margin: '6px 0', paddingLeft: '20px', listStyleType: 'disc' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: '6px 0', paddingLeft: '20px', listStyleType: 'decimal' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ margin: '3px 0', lineHeight: '1.55', paddingLeft: '4px' }}>{children}</li>,
                }}
              >
                {streamingMessage}
              </ReactMarkdown>
              <span style={{
                display: 'inline-block',
                width: '2px',
                height: '1em',
                background: colors.textSecondary,
                marginLeft: '2px',
                animation: 'blink 1s infinite',
                verticalAlign: 'text-bottom',
              }} />
            </div>
          </div>
        )}

        {/* Loading indicator - only show when waiting for first token */}
        {isLoading && !isStreaming && (
          <div style={{
            marginTop: '12px',
            animation: 'messageSlideIn 0.25s ease-out',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              fontSize: fontSize.base,
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
            {queueCount > 0 && (
              <span style={{
                fontSize: fontSize.xs,
                color: colors.textTertiary,
                marginLeft: '4px',
              }}>
                +{queueCount} queued
              </span>
            )}
          </div>
        )}

        {/* Tool status indicator during streaming */}
        {isStreaming && toolStatus && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
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
                fontSize: fontSize.xs,
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
                fontSize: fontSize.sm,
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
        padding: mobileEmbedded
          ? '0'
          : 'clamp(8px, 1.5vh, 12px) clamp(8px, 2vw, 16px)',
        paddingBottom: mobileEmbedded ? '12px' : 'clamp(12px, 2vh, 16px)',
        background: mobileEmbedded ? 'transparent' : colors.bgSecondary,
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
        {/* Hidden file input for PDF upload */}
        <input
          ref={pdfFileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Image preview */}
        {selectedImage && (
          <div style={{
            marginBottom: '8px',
            padding: '8px',
            background: colors.bgSecondary,
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
              fontSize: fontSize.sm,
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

        {/* PDF file preview */}
        {selectedFile && (
          <div style={{
            marginBottom: '8px',
            padding: '8px',
            background: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: colors.bgTertiary,
              borderRadius: '8px',
              flexShrink: 0,
            }}>
              <PdfDocIcon size={24} color={colors.textSecondary} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'block',
                fontSize: fontSize.sm,
                color: colors.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selectedFile.name}
              </span>
              <span style={{
                fontSize: fontSize.xs,
                color: colors.textTertiary,
              }}>
                {selectedFile.size < 1024 * 1024
                  ? `${Math.round(selectedFile.size / 1024)} KB`
                  : `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
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

        <form data-chatbot-form onSubmit={handleSend} style={{ margin: mobileEmbedded ? `0 ${mobileSpacing.paddingX}` : '0' }}>
          <div style={{
            display: 'flex',
            gap: mobileEmbedded ? '6px' : '10px',
            alignItems: 'flex-end',
            background: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: mobileEmbedded ? '10px' : '14px',
            padding: mobileEmbedded ? '2px 2px 2px 10px' : '4px 4px 4px 14px',
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
              rows={1}
              style={{
                flex: 1,
                padding: 0,
                paddingTop: mobileEmbedded ? '5px' : '7px',
                border: 'none',
                fontSize: fontSize.base,
                background: 'transparent',
                color: colors.textPrimary,
                resize: 'none',
                height: mobileEmbedded ? '32px' : '36px',
                maxHeight: mobileEmbedded ? '80px' : '100px',
                overflowY: 'auto',
                fontFamily: 'inherit',
                lineHeight: lineHeight.tight,
                outline: 'none',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                const baseHeight = mobileEmbedded ? 32 : 36
                const maxHeight = mobileEmbedded ? 80 : 100
                target.style.height = `${baseHeight}px`
                target.style.height = Math.min(target.scrollHeight, maxHeight) + 'px'
              }}
            />
            {/* Image upload button */}
            <button
              type="button"
              onClick={handleImageClick}
              title="Upload image"
                style={{
                  width: mobileEmbedded ? '30px' : '36px',
                  height: mobileEmbedded ? '30px' : '36px',
                  padding: 0,
                  background: selectedImage ? hexToRgba(colors.textSecondary, 0.15) : 'transparent',
                  color: selectedImage ? colors.textPrimary : colors.textTertiary,
                  border: 'none',
                  borderRadius: mobileEmbedded ? '8px' : '10px',
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
                <ImageIcon size={mobileEmbedded ? 16 : 18} />
            </button>
            {/* PDF upload button */}
            <button
              type="button"
              onClick={handleFileClick}
              title="Upload PDF"
                style={{
                  width: mobileEmbedded ? '30px' : '36px',
                  height: mobileEmbedded ? '30px' : '36px',
                  padding: 0,
                  background: selectedFile ? hexToRgba(colors.textSecondary, 0.15) : 'transparent',
                  color: selectedFile ? colors.textPrimary : colors.textTertiary,
                  border: 'none',
                  borderRadius: mobileEmbedded ? '8px' : '10px',
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
                  e.currentTarget.style.background = selectedFile ? hexToRgba(colors.textSecondary, 0.15) : 'transparent'
                  e.currentTarget.style.color = selectedFile ? colors.textPrimary : colors.textTertiary
                }}
              >
                <FileIcon size={mobileEmbedded ? 16 : 18} />
            </button>
            {isLoading && !(input ?? '').trim() && !selectedImage && !selectedFile ? (
              <button
                type="button"
                onClick={handleStop}
                title="Stop generating"
                style={{
                  width: mobileEmbedded ? '30px' : '36px',
                  height: mobileEmbedded ? '30px' : '36px',
                  padding: 0,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: mobileEmbedded ? '8px' : '10px',
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
                <StopIcon size={mobileEmbedded ? 12 : 14} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!(input ?? '').trim() && !selectedImage && !selectedFile}
                style={{
                  width: mobileEmbedded ? '30px' : '36px',
                  height: mobileEmbedded ? '30px' : '36px',
                  padding: 0,
                  background: (!(input ?? '').trim() && !selectedImage && !selectedFile)
                    ? colors.bgTertiary
                    : accent.userBubble,
                  color: (!(input ?? '').trim() && !selectedImage && !selectedFile)
                    ? colors.textTertiary
                    : accent.userText,
                  border: 'none',
                  borderRadius: mobileEmbedded ? '8px' : '10px',
                  cursor: (!(input ?? '').trim() && !selectedImage && !selectedFile) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if ((input ?? '').trim() || selectedImage || selectedFile) {
                    e.currentTarget.style.transform = 'scale(1.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <SendIcon size={mobileEmbedded ? 14 : 16} />
              </button>
            )}
          </div>
        </form>
        {/* Hide helper text on mobile to save space */}
        {!mobileEmbedded && (
          <div style={{
            marginTop: '8px',
            textAlign: 'center',
          }}>
          </div>
        )}
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
})
