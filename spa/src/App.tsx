import { useState } from 'react'
import { Chat } from './components/Chat'
import { StatusModal } from './components/StatusModal'
import { ConnectionStatus } from './hooks/useWebSocket'

function App() {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [sendFunction, setSendFunction] = useState<((method: string, params?: Record<string, unknown>) => Promise<unknown>) | null>(null)

  return (
    <div className="app">
      <header className="app-header">
        <h1>MCP Chart Agent</h1>
        <button
          className={`status-indicator status-button status-${connectionStatus}`}
          id="connection-status"
          onClick={() => setIsStatusModalOpen(true)}
          aria-label="View server status"
        >
          {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
        </button>
      </header>
      <main className="app-main">
        <Chat 
          onStatusChange={setConnectionStatus}
          onSendFunctionReady={setSendFunction}
        />
      </main>
      {sendFunction && (
        <StatusModal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          send={sendFunction}
          mcpStatus={connectionStatus}
        />
      )}
      {!sendFunction && isStatusModalOpen && (
        <div className="status-modal-overlay" onClick={() => setIsStatusModalOpen(false)}>
          <div className="status-modal" onClick={(e) => e.stopPropagation()}>
            <div className="status-modal-header">
              <h2>Server Status</h2>
              <button className="status-modal-close" onClick={() => setIsStatusModalOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="status-modal-content">
              <div className="status-error">
                WebSocket connection not ready. Please wait for connection to establish.
              </div>
              <div className="status-modal-actions">
                <button className="status-refresh-button" onClick={() => setIsStatusModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
