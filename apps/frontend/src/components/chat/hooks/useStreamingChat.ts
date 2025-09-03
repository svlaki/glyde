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
  const [state, setState] = useState<StreamingChatState>({
    messages: [],
    isStreaming: false,
    currentStreamingMessage: '',
    isStreamFinished: false,
  });

  const setMessages = useCallback((messages: ChatMessage[]) => {
    setState(prev => ({ ...prev, messages }));
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setState(prev => ({ ...prev, messages: [...prev.messages, message] }));
  }, []);

  const startStreaming = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isStreaming: true, 
      currentStreamingMessage: '', 
      isStreamFinished: false 
    }));
  }, []);

  const updateStreamingMessage = useCallback((content: string) => {
    setState(prev => ({ ...prev, currentStreamingMessage: content }));
  }, []);

  const finishStreaming = useCallback(() => {
    setState(prev => {
      const finalMessage: ChatMessage = {
        id: `${Date.now()}-ai`,
        content: prev.currentStreamingMessage,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        isStreaming: false,
        isStreamFinished: true,
        currentStreamingMessage: '',
        messages: [...prev.messages, finalMessage],
      };
    });
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
    startStreaming();

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
            conversationHistory: state.messages.map(msg => ({
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
        
        // Handle different response formats
        if (result.success && result.response) {
          if (typeof result.response === 'object') {
            responseContent = result.response.content || JSON.stringify(result.response);
          } else if (typeof result.response === 'string') {
            responseContent = result.response;
          } else {
            responseContent = String(result.response);
          }
        } else if (result.content) {
          responseContent = String(result.content);
        } else {
          responseContent = 'No response received';
        }

        // Simulate streaming by updating the message gradually
        const words = responseContent.split(' ');
        let currentContent = '';
        
        for (let i = 0; i < words.length; i++) {
          currentContent += (i > 0 ? ' ' : '') + words[i];
          updateStreamingMessage(currentContent);
          
          // Add delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        finishStreaming();

        // Check if the response indicates an event was created
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

      } else {
        updateStreamingMessage('Sorry, I encountered an error processing your request.');
        setTimeout(finishStreaming, 1000);
        console.error('Chat response failed:', response.status, response.statusText);
      }
    } catch (error) {
      updateStreamingMessage('Sorry, I encountered a network error. Please try again.');
      setTimeout(finishStreaming, 1000);
      console.error('Failed to send message:', error);
    }
  }, [user, session, sessionId, state.messages, addMessage, startStreaming, updateStreamingMessage, finishStreaming, onEventCreated]);

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    currentStreamingMessage: state.currentStreamingMessage,
    isStreamFinished: state.isStreamFinished,
    setMessages,
    sendMessage,
  };
};