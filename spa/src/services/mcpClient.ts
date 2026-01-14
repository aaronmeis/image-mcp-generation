// MCP Client Service - Wrapper for WebSocket communication

export interface MCPTool {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, unknown>
  }
}

export interface ChatResponse {
  success: boolean
  messageId: string
}

export interface ChartResponse {
  success: boolean
  messageId: string
}

export class MCPClient {
  private sendFn: <T>(method: string, params?: Record<string, unknown>) => Promise<T>

  constructor(sendFn: <T>(method: string, params?: Record<string, unknown>) => Promise<T>) {
    this.sendFn = sendFn
  }

  async ping(): Promise<{ pong: boolean; timestamp: number }> {
    return this.sendFn('ping')
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return this.sendFn('listTools')
  }

  async chat(message: string): Promise<ChatResponse> {
    return this.sendFn('chat', { message })
  }

  async generateDataChart(
    chartType: 'bar' | 'line' | 'pie' | 'doughnut',
    data: { labels: string[]; datasets: Array<{ label: string; data: number[] }> },
    options?: { title?: string }
  ): Promise<ChartResponse> {
    return this.sendFn('generateChart', {
      type: 'data',
      data: {
        data,
        options: { type: chartType, ...options }
      }
    })
  }

  async generateAIChart(prompt: string): Promise<ChartResponse> {
    return this.sendFn('generateChart', {
      type: 'ai',
      prompt
    })
  }

  async getStatus(): Promise<{
    mcpServer: { status: string; port: number }
    ollamaServer: { status: string; host: string }
    model: { name: string; available: boolean }
  }> {
    return this.sendFn('getStatus')
  }
}

// Factory function to create MCP client from useWebSocket hook
export function createMCPClient(
  sendFn: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
): MCPClient {
  return new MCPClient(sendFn)
}
