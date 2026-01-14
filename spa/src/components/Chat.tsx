import { useState, useCallback, useRef, useEffect } from 'react'
import { useWebSocket, StreamChunk, ConnectionStatus } from '../hooks/useWebSocket'
import { createMCPClient } from '../services/mcpClient'
import { Message, MessageContent } from './Message'
import promptsConfig from '../config/prompts.json'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  contents: MessageContent[]
  isStreaming: boolean
  status?: string
  chartData?: {
    labels: string[]
    datasets: Array<{ label: string; data: number[] }>
  }
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

// Function to shuffle array and return a subset
function getRandomPrompts(prompts: string[], count: number): string[] {
  const shuffled = [...prompts].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

interface ChatProps {
  onStatusChange?: (status: ConnectionStatus) => void
  onSendFunctionReady?: (sendFn: (method: string, params?: Record<string, unknown>) => Promise<unknown>) => void
}

export function Chat({ onStatusChange, onSendFunctionReady }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [randomizedPrompts, setRandomizedPrompts] = useState<string[]>([])
  const [isPromptsExpanded, setIsPromptsExpanded] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const currentMessageRef = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleStream = useCallback((chunk: StreamChunk) => {
    const { messageId, type, content, streaming } = chunk
    
    console.log('[Chat] Received stream chunk:', { messageId, type, contentLength: content.length, streaming })

    setMessages(prev => {
      const messageIndex = prev.findIndex(m => m.id === messageId)

      if (messageIndex === -1) {
        // Create new assistant message
        const newMessage: ChatMessage = {
          id: messageId,
          role: 'assistant',
          contents: [],
          isStreaming: streaming,
          status: type === 'status' ? content : undefined
        }

        if (type === 'text' && content) {
          newMessage.contents.push({ type: 'text', content })
        } else if (type === 'image') {
          console.log('[Chat] Adding image to new message, base64 length:', content.length)
          newMessage.contents.push({ type: 'image', content })
        } else if (type === 'chartData' && chunk.chartData) {
          console.log('[Chat] Received chartData for new message:', chunk.chartData)
          newMessage.chartData = chunk.chartData
        }

        return [...prev, newMessage]
      }

      // Update existing message
      const updated = [...prev]
      const message = { ...updated[messageIndex] }

      if (type === 'status') {
        message.status = content
      } else if (type === 'text') {
        const lastContent = message.contents[message.contents.length - 1]
        if (lastContent?.type === 'text') {
          // Append to existing text
          message.contents = [
            ...message.contents.slice(0, -1),
            { type: 'text', content: lastContent.content + content }
          ]
        } else if (content) {
          // Add new text content
          message.contents = [...message.contents, { type: 'text', content }]
        }
      } else if (type === 'image') {
        console.log('[Chat] Adding image to existing message, base64 length:', content.length)
        message.contents = [...message.contents, { type: 'image', content }]
      } else if (type === 'chartData' && chunk.chartData) {
        console.log('[Chat] Received chartData for existing message:', chunk.chartData)
        message.chartData = chunk.chartData
      } else if (type === 'error') {
        message.contents = [...message.contents, { type: 'text', content: `Error: ${content}` }]
      }

      message.isStreaming = streaming

      if (!streaming) {
        message.status = undefined
        currentMessageRef.current = null
      }

      updated[messageIndex] = message
      return updated
    })

    scrollToBottom()
  }, [scrollToBottom])

  const updateConnectionStatus = useCallback((newStatus: ConnectionStatus) => {
    // Update parent component
    onStatusChange?.(newStatus)
    
    // Update DOM element for backward compatibility
    const indicator = document.getElementById('connection-status')
    if (indicator) {
      indicator.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1)
      indicator.className = `status-indicator status-button status-${newStatus}`
    }
  }, [onStatusChange])

  const handleConnect = useCallback((clientId: string) => {
    console.log('Connected with client ID:', clientId)
    updateConnectionStatus('connected')
  }, [updateConnectionStatus])

  const handleDisconnect = useCallback(() => {
    console.log('Disconnected from server')
    updateConnectionStatus('disconnected')
  }, [updateConnectionStatus])

  const { status, send, connect } = useWebSocket({
    url: WS_URL,
    onStream: handleStream,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect
  })

  useEffect(() => {
    updateConnectionStatus(status)
  }, [status, updateConnectionStatus])

  useEffect(() => {
    // Notify parent when send function is ready
    if (status === 'connected' && send && typeof send === 'function') {
      onSendFunctionReady?.(send)
    } else if (status !== 'connected') {
      // Clear send function when disconnected
      onSendFunctionReady?.(null as any)
    }
  }, [status, send, onSendFunctionReady])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load and randomize prompts on component mount
  useEffect(() => {
    const prompts = promptsConfig.prompts || []
    // Show 6 random prompts as buttons
    setRandomizedPrompts(getRandomPrompts(prompts, 6))
  }, [])

  const handlePromptClick = useCallback((prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || status !== 'connected') return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      contents: [{ type: 'text', content: input.trim() }],
      isStreaming: false
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsPromptsExpanded(false) // Collapse prompts after sending

    try {
      const client = createMCPClient(send)
      await client.chat(input.trim())
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          contents: [{ type: 'text', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
          isStreaming: false
        }
      ])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleReconnect = () => {
    connect()
  }

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Welcome to MCP Chart Agent</h2>
            <p>I can help you create charts and visualizations.</p>
          </div>
        ) : (
          messages.map(message => (
            <Message
              key={message.id}
              id={message.id}
              role={message.role}
              contents={message.contents}
              isStreaming={message.isStreaming}
              status={message.status}
              chartData={message.chartData}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {randomizedPrompts.length > 0 && (
        <div className="prompt-buttons-section">
          <button
            type="button"
            onClick={() => setIsPromptsExpanded(!isPromptsExpanded)}
            className="prompt-toggle-button"
            aria-expanded={isPromptsExpanded}
          >
            <span className="prompt-toggle-icon">{isPromptsExpanded ? '▼' : '▶'}</span>
            <span className="prompt-toggle-text">
              {isPromptsExpanded ? 'Hide Sample Questions' : 'Show Sample Questions'}
            </span>
          </button>
          {isPromptsExpanded && (
            <div className="prompt-buttons-container">
              {randomizedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  disabled={status !== 'connected' || isLoading}
                  className="prompt-button"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <form className="input-container" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={status === 'connected' ? 'Type a message...' : 'Connecting...'}
          disabled={status !== 'connected' || isLoading}
          className="chat-input"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
        />
        <button
          type="submit"
          disabled={status !== 'connected' || isLoading || !input.trim()}
          className="send-button"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
        {status !== 'connected' && (
          <button type="button" onClick={handleReconnect} className="reconnect-button">
            Reconnect
          </button>
        )}
      </form>
    </div>
  )
}
