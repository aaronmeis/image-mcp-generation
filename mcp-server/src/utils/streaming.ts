// Streaming utilities for WebSocket communication

export interface StreamBuffer {
  messageId: string
  content: string
  chunks: string[]
  startTime: number
}

export class StreamManager {
  private buffers: Map<string, StreamBuffer> = new Map()

  createBuffer(messageId: string): StreamBuffer {
    const buffer: StreamBuffer = {
      messageId,
      content: '',
      chunks: [],
      startTime: Date.now()
    }
    this.buffers.set(messageId, buffer)
    return buffer
  }

  appendChunk(messageId: string, chunk: string): void {
    const buffer = this.buffers.get(messageId)
    if (buffer) {
      buffer.content += chunk
      buffer.chunks.push(chunk)
    }
  }

  getBuffer(messageId: string): StreamBuffer | undefined {
    return this.buffers.get(messageId)
  }

  completeBuffer(messageId: string): StreamBuffer | undefined {
    const buffer = this.buffers.get(messageId)
    if (buffer) {
      this.buffers.delete(messageId)
    }
    return buffer
  }

  getElapsedTime(messageId: string): number {
    const buffer = this.buffers.get(messageId)
    return buffer ? Date.now() - buffer.startTime : 0
  }
}

// Token rate calculator for performance monitoring
export class TokenRateCalculator {
  private tokenCounts: Array<{ timestamp: number; count: number }> = []
  private windowMs: number = 1000 // 1 second window

  addTokens(count: number): void {
    const now = Date.now()
    this.tokenCounts.push({ timestamp: now, count })
    this.pruneOld(now)
  }

  private pruneOld(now: number): void {
    const cutoff = now - this.windowMs * 10 // Keep 10 seconds of data
    this.tokenCounts = this.tokenCounts.filter(t => t.timestamp > cutoff)
  }

  getTokensPerSecond(): number {
    const now = Date.now()
    const windowStart = now - this.windowMs
    const recentTokens = this.tokenCounts
      .filter(t => t.timestamp > windowStart)
      .reduce((sum, t) => sum + t.count, 0)
    return recentTokens
  }

  getTotalTokens(): number {
    return this.tokenCounts.reduce((sum, t) => sum + t.count, 0)
  }
}
