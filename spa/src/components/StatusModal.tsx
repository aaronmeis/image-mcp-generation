import { useState, useEffect } from 'react'
import { createMCPClient } from '../services/mcpClient'

interface StatusModalProps {
  isOpen: boolean
  onClose: () => void
  send: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
  mcpStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
}

interface ServerStatus {
  mcpServer: { status: string; port: number }
  ollamaServer: { status: string; host: string }
  model: { name: string; available: boolean }
}

export function StatusModal({ isOpen, onClose, send, mcpStatus }: StatusModalProps) {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = async () => {
    if (mcpStatus !== 'connected') {
      setError('Not connected to MCP server')
      return
    }
    
    if (!send || typeof send !== 'function') {
      setError('WebSocket connection not ready')
      return
    }
    
    setIsLoading(true)
    setError(null)
    try {
      const client = createMCPClient(send)
      const serverStatus = await client.getStatus()
      setStatus(serverStatus)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load status'
      console.error('StatusModal error:', err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && mcpStatus === 'connected') {
      loadStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mcpStatus])

  if (!isOpen) return null

  return (
    <div className="status-modal-overlay" onClick={onClose}>
      <div className="status-modal" onClick={(e) => e.stopPropagation()}>
        <div className="status-modal-header">
          <h2>Server Status</h2>
          <button className="status-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="status-modal-content">
          {mcpStatus !== 'connected' ? (
            <div className="status-error">
              Cannot load status: MCP server is {mcpStatus}. Please wait for connection.
            </div>
          ) : isLoading ? (
            <div className="status-loading">Loading status...</div>
          ) : error ? (
            <div className="status-error">{error}</div>
          ) : (
            <div className="status-details">
              <div className="status-item">
                <div className="status-item-header">
                  <span className="status-label">MCP Server</span>
                  <span className={`status-badge status-${mcpStatus}`}>
                    {mcpStatus.charAt(0).toUpperCase() + mcpStatus.slice(1)}
                  </span>
                </div>
                {status && (
                  <div className="status-item-detail">
                    Port: {status.mcpServer.port}
                  </div>
                )}
              </div>

              <div className="status-item">
                <div className="status-item-header">
                  <span className="status-label">Ollama Server</span>
                  {status && (
                    <span className={`status-badge status-${status.ollamaServer.status}`}>
                      {status.ollamaServer.status.charAt(0).toUpperCase() + status.ollamaServer.status.slice(1)}
                    </span>
                  )}
                </div>
                {status && (
                  <div className="status-item-detail">
                    Host: {status.ollamaServer.host}
                  </div>
                )}
              </div>

              <div className="status-item">
                <div className="status-item-header">
                  <span className="status-label">Model</span>
                  {status && (
                    <span className={`status-badge status-${status.model.available ? 'connected' : 'disconnected'}`}>
                      {status.model.available ? 'Available' : 'Unavailable'}
                    </span>
                  )}
                </div>
                {status && (
                  <div className="status-item-detail">
                    {status.model.name}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="status-modal-actions">
            <button 
              className="status-refresh-button" 
              onClick={loadStatus} 
              disabled={isLoading || mcpStatus !== 'connected' || !send || typeof send !== 'function'}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
