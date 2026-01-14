import { useState } from 'react'
import { ChartImage } from './ChartImage'

export interface MessageContent {
  type: 'text' | 'image'
  content: string
}

export interface MessageProps {
  id: string
  role: 'user' | 'assistant' | 'system'
  contents: MessageContent[]
  isStreaming: boolean
  status?: string
  chartData?: {
    labels: string[]
    datasets: Array<{ label: string; data: number[] }>
  }
}

export function Message({ id, role, contents, isStreaming, status, chartData }: MessageProps) {
  const [showExplanation, setShowExplanation] = useState(false)
  const roleLabel = role === 'user' ? 'You' : 'Assistant'

  // Check if this message has both text and image (chart response)
  const hasImage = contents.some(c => c.type === 'image')
  const hasText = contents.some(c => c.type === 'text')
  const isChartResponse = hasImage && hasText && role === 'assistant'

  // Separate text and image contents
  const textContents = contents.filter(c => c.type === 'text')
  const imageContents = contents.filter(c => c.type === 'image')

  return (
    <div className={`message message-${role}`}>
      <div className="message-header">
        <span className="message-role">{roleLabel}</span>
        {isStreaming && <span className="streaming-indicator">...</span>}
      </div>
      <div className="message-body">
        {status && (
          <div className="message-status">{status}</div>
        )}

        {isChartResponse ? (
          <>
            {/* Show images first */}
            {imageContents.map((content, index) => (
              <div key={`${id}-img-${index}`} className="message-content">
                <ChartImage 
                  base64={content.content} 
                  alt="Generated chart"
                  chartData={chartData}
                />
              </div>
            ))}

            {/* Collapsible explanation */}
            {textContents.length > 0 && (
              <div className="explanation-container">
                <button
                  className="explain-button"
                  onClick={() => setShowExplanation(!showExplanation)}
                >
                  {showExplanation ? '▼ Hide explanation' : '▶ Show explanation'}
                </button>
                {showExplanation && (
                  <div className="explanation-content">
                    {textContents.map((content, index) => (
                      <div key={`${id}-txt-${index}`} className="message-text">
                        {content.content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          // Regular message rendering
          contents.map((content, index) => (
            <div key={`${id}-${index}`} className="message-content">
              {content.type === 'text' ? (
                <div className="message-text">{content.content}</div>
              ) : (
                <ChartImage base64={content.content} alt="Generated chart" chartData={chartData} />
              )}
            </div>
          ))
        )}

        {isStreaming && contents.length === 0 && !status && (
          <div className="message-text typing-cursor">|</div>
        )}
      </div>
    </div>
  )
}
