import { useState, useCallback } from 'react';
import { useAuth } from '../../../lib/authContext';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
}

interface UseStreamingChatProps {
  sessionId: string;
  onEventCreated?: () => void;
}

interface StreamingChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingMessage: string;
  isStreamFinished: boolean;
}

export const useStreamingChat = ({ sessionId, onEventCreated }: UseStreamingChatProps) => {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !session?.access_token || !content.trim()) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `${Date.now()}`,
      content: content.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    
    addMessage(userMessage);
    setIsStreaming(true);
    setCurrentResponse('');

    try {
      const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/agent/process`;
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
          message: content
        })
      });

      if (response.ok) {
        const result = await response.json();
        let responseContent = '';
        
        if (result.success && result.response) {
          responseContent = String(result.response);
        } else {
          responseContent = 'No response received';
        }

        // Set the complete response - llm-ui useStreamExample will handle the character-by-character streaming
        setCurrentResponse(responseContent);

        // Wait for the streaming to complete before adding to messages
        // The streaming duration depends on content length and delayMultiplier (0.5)
        const streamingDuration = Math.max(responseContent.length * 0.5 * 50, 1000); // 50ms per char with 0.5 multiplier, minimum 1s
        
        setTimeout(() => {
          const assistantMessage: ChatMessage = {
            id: `${Date.now()}-ai`,
            content: responseContent,
            sender: 'assistant',
            timestamp: new Date().toISOString(),
          };
          
          addMessage(assistantMessage);
          setIsStreaming(false);
          setCurrentResponse('');

          // Check if event was created
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
            setTimeout(() => {
              onEventCreated();
            }, 1000);
          }
        }, streamingDuration);

      } else {
        const errorMessage = 'Sorry, I encountered an error processing your request.';
        setCurrentResponse(errorMessage);
        
        // Show error with streaming effect
        setTimeout(() => {
          const assistantMessage: ChatMessage = {
            id: `${Date.now()}-ai`,
            content: errorMessage,
            sender: 'assistant',
            timestamp: new Date().toISOString(),
          };
          
          addMessage(assistantMessage);
          setIsStreaming(false);
          setCurrentResponse('');
        }, errorMessage.length * 0.5 * 50);
        
        console.error('Chat response failed:', response.status, response.statusText);
      }
    } catch (error) {
      const errorMessage = 'Sorry, I encountered a network error. Please try again.';
      setCurrentResponse(errorMessage);
      
      // Show error with streaming effect
      setTimeout(() => {
        const assistantMessage: ChatMessage = {
          id: `${Date.now()}-ai`,
          content: errorMessage,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
        };
        
        addMessage(assistantMessage);
        setIsStreaming(false);
        setCurrentResponse('');
      }, errorMessage.length * 0.5 * 50);
      
      console.error('Failed to send message:', error);
    }
  }, [user, session, sessionId, messages, addMessage, onEventCreated]);

  return {
    messages,
    isStreaming,
    currentStreamingMessage: currentResponse,
    isStreamFinished: !isStreaming && currentResponse === '',
    setMessages,
    sendMessage,
  };
};;;