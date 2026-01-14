import { useState, useEffect, useCallback, useRef } from 'react'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface StreamChunk {
  type: 'text' | 'image' | 'status' | 'error' | 'chartData'
  content: string
  streaming: boolean
  messageId: string
  chartData?: {
    labels: string[]
    datasets: Array<{ label: string; data: number[] }>
  }
}

export interface UseWebSocketOptions {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onStream?: (chunk: StreamChunk) => void
  onConnect?: (clientId: string) => void
  onDisconnect?: () => void
}

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: string | number
  method?: string
  result?: unknown
  params?: StreamChunk
  error?: {
    code: number
    message: string
  }
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onStream,
    onConnect,
    onDisconnect
  } = options

  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [clientId, setClientId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingRequestsRef = useRef<Map<string | number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }>>(new Map())
  const requestIdRef = useRef(0)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setStatus('connecting')
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setStatus('connected')
      reconnectAttemptsRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const message: JsonRpcResponse = JSON.parse(event.data)

        // Handle stream messages
        if (message.method === 'stream' && message.params) {
          onStream?.(message.params)
          return
        }

        // Handle connection confirmation
        if (message.result && typeof message.result === 'object' && 'clientId' in message.result) {
          const result = message.result as { clientId: string }
          setClientId(result.clientId)
          onConnect?.(result.clientId)
          return
        }

        // Handle pending requests
        if (message.id !== undefined) {
          const pending = pendingRequestsRef.current.get(message.id)
          if (pending) {
            if (message.error) {
              pending.reject(new Error(message.error.message))
            } else {
              pending.resolve(message.result)
            }
            pendingRequestsRef.current.delete(message.id)
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      setClientId(null)
      onDisconnect?.()

      // Attempt reconnection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++
          connect()
        }, reconnectInterval)
      }
    }

    ws.onerror = () => {
      setStatus('error')
    }

    wsRef.current = ws
  }, [url, reconnectInterval, maxReconnectAttempts, onStream, onConnect, onDisconnect])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    reconnectAttemptsRef.current = maxReconnectAttempts // Prevent auto-reconnect
    wsRef.current?.close()
  }, [maxReconnectAttempts])

  const send = useCallback(<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'))
        return
      }

      const id = ++requestIdRef.current
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      }

      pendingRequestsRef.current.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject
      })

      wsRef.current.send(JSON.stringify(request))

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingRequestsRef.current.has(id)) {
          pendingRequestsRef.current.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 30000)
    })
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    status,
    clientId,
    connect,
    disconnect,
    send
  }
}
