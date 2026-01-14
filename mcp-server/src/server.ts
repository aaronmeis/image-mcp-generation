import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { Agent } from './agent/index.js'
import { PromptLogger } from './utils/promptLogger.js'

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

interface StreamChunk {
  type: 'text' | 'image' | 'status' | 'error' | 'chartData'
  content: string
  streaming: boolean
  messageId: string
  chartData?: {
    labels: string[]
    datasets: Array<{ label: string; data: number[] }>
  }
}

class MCPServer {
  private wss: WebSocketServer
  private agent: Agent
  private promptLogger: PromptLogger
  private clients: Map<string, WebSocket> = new Map()

  constructor() {
    this.wss = new WebSocketServer({ port: PORT })
    this.agent = new Agent()
    this.promptLogger = new PromptLogger()

    this.setupServer()
  }

  private setupServer() {
    console.log(`MCP Server starting on port ${PORT}...`)

    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4()
      this.clients.set(clientId, ws)
      console.log(`Client connected: ${clientId}`)

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString()) as JsonRpcRequest
          await this.handleMessage(clientId, ws, message)
        } catch (error) {
          this.sendError(ws, null, -32700, 'Parse error')
        }
      })

      ws.on('close', () => {
        this.clients.delete(clientId)
        console.log(`Client disconnected: ${clientId}`)
      })

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error)
      })

      // Send connection confirmation
      this.sendResult(ws, 'connect', { clientId, status: 'connected' })
    })

    this.wss.on('listening', () => {
      console.log(`MCP Server listening on ws://localhost:${PORT}`)
    })
  }

  private async handleMessage(clientId: string, ws: WebSocket, request: JsonRpcRequest) {
    const { id, method, params } = request

    console.log(`[Server] Received message from client ${clientId}: method=${method}, id=${id}`)

    switch (method) {
      case 'chat':
        console.log(`[Server] Handling chat request, params:`, params)
        await this.handleChat(clientId, ws, id, params as { message: string })
        break

      case 'generateChart':
        console.log(`[Server] Handling generateChart request`)
        await this.handleGenerateChart(clientId, ws, id, params as {
          type: 'data' | 'ai'
          data?: unknown
          prompt?: string
        })
        break

      case 'listTools':
        console.log(`[Server] Handling listTools request`)
        this.sendResult(ws, id, {
          tools: [
            {
              name: 'generate_data_chart',
              description: 'Generate a chart from structured data',
              parameters: {
                type: 'object',
                properties: {
                  chartType: { type: 'string', enum: ['bar', 'line', 'pie', 'doughnut'] },
                  data: { type: 'object' },
                  options: { type: 'object' }
                }
              }
            },
            {
              name: 'generate_ai_chart',
              description: 'Generate a chart from natural language description',
              parameters: {
                type: 'object',
                properties: {
                  prompt: { type: 'string' }
                }
              }
            }
          ]
        })
        break

      case 'ping':
        console.log(`[Server] Handling ping request`)
        this.sendResult(ws, id, { pong: true, timestamp: Date.now() })
        break

      case 'getStatus':
        await this.handleGetStatus(ws, id)
        break

      default:
        console.warn(`[Server] Unknown method: ${method}`)
        this.sendError(ws, id, -32601, `Method not found: ${method}`)
    }
  }

  private async handleGetStatus(ws: WebSocket, requestId: string | number) {
    try {
      const mcpStatus = 'connected' // MCP server is always connected if we're handling this
      const model = this.agent.getModel()
      
      // Check Ollama connection
      const ollamaStatus = await this.agent.checkOllamaConnection()
      
      this.sendResult(ws, requestId, {
        mcpServer: {
          status: mcpStatus,
          port: PORT
        },
        ollamaServer: {
          status: ollamaStatus ? 'connected' : 'disconnected',
          host: process.env.OLLAMA_HOST || 'http://localhost:11434'
        },
        model: {
          name: model,
          available: ollamaStatus
        }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.sendError(ws, requestId, -32000, errorMessage)
    }
  }

  private async handleChat(clientId: string, ws: WebSocket, requestId: string | number, params: { message: string }) {
    const messageId = uuidv4()
    const startTime = Date.now()

    console.log(`[Chat] Client ${clientId} sent message: "${params.message.substring(0, 50)}..."`)

    try {
      // Stream status
      this.streamChunk(ws, { type: 'status', content: 'Thinking...', streaming: true, messageId })

      // Get response from agent with streaming
      await this.agent.chat(params.message, {
        onToken: (token: string) => {
          this.streamChunk(ws, { type: 'text', content: token, streaming: true, messageId })
        },
        onImage: (base64Image: string, chartData?: { labels: string[]; datasets: Array<{ label: string; data: number[] }> }) => {
          console.log(`[Chat] Chart image generated, size: ${base64Image.length} chars`)
          this.streamChunk(ws, { type: 'image', content: base64Image, streaming: false, messageId })
          if (chartData) {
            this.streamChunk(ws, { 
              type: 'chartData', 
              content: '', 
              streaming: false, 
              messageId,
              chartData 
            })
          }
        },
        onComplete: (fullResponse: string) => {
          console.log(`[Chat] Response completed, length: ${fullResponse.length} chars`)
          this.streamChunk(ws, { type: 'text', content: '', streaming: false, messageId })

          // Log the prompt
          this.promptLogger.log({
            type: 'chat',
            prompt: params.message,
            response: fullResponse,
            latencyMs: Date.now() - startTime,
            model: this.agent.getModel(),
            promptVersion: 'chat-v1'
          })
        }
      })

      this.sendResult(ws, requestId, { success: true, messageId })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Chat] Error processing message:`, error)
      this.streamChunk(ws, { type: 'error', content: errorMessage, streaming: false, messageId })
      this.sendError(ws, requestId, -32000, errorMessage)
    }
  }

  private async handleGenerateChart(
    clientId: string,
    ws: WebSocket,
    requestId: string | number,
    params: { type: 'data' | 'ai'; data?: unknown; prompt?: string }
  ) {
    const messageId = uuidv4()
    const startTime = Date.now()

    try {
      this.streamChunk(ws, { type: 'status', content: 'Generating chart...', streaming: true, messageId })

      let imageBase64: string

      if (params.type === 'data' && params.data) {
        imageBase64 = await this.agent.generateDataChart(params.data)
      } else if (params.type === 'ai' && params.prompt) {
        imageBase64 = await this.agent.generateAIChart(params.prompt, {
          onToken: (token: string) => {
            this.streamChunk(ws, { type: 'text', content: token, streaming: true, messageId })
          }
        })
      } else {
        throw new Error('Invalid chart generation parameters')
      }

      this.streamChunk(ws, { type: 'image', content: imageBase64, streaming: false, messageId })

      // Log the chart generation
      this.promptLogger.log({
        type: 'chart',
        prompt: params.prompt || JSON.stringify(params.data),
        response: '[chart generated]',
        latencyMs: Date.now() - startTime,
        model: this.agent.getModel(),
        promptVersion: 'chart-v1'
      })

      this.sendResult(ws, requestId, { success: true, messageId })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Chart generation failed'
      this.streamChunk(ws, { type: 'error', content: errorMessage, streaming: false, messageId })
      this.sendError(ws, requestId, -32000, errorMessage)
    }
  }

  private streamChunk(ws: WebSocket, chunk: StreamChunk) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'stream',
        params: chunk
      }))
    }
  }

  private sendResult(ws: WebSocket, id: string | number | null, result: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: id ?? 0,
        result
      }
      ws.send(JSON.stringify(response))
    }
  }

  private sendError(ws: WebSocket, id: string | number | null, code: number, message: string) {
    if (ws.readyState === WebSocket.OPEN) {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: id ?? 0,
        error: { code, message }
      }
      ws.send(JSON.stringify(response))
    }
  }
}

// Start server
new MCPServer()
