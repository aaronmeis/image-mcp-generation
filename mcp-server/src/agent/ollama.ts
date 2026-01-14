import { Ollama } from 'ollama'

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'phi3:mini'

export interface OllamaStreamCallbacks {
  onToken?: (token: string) => void
  onComplete?: (fullResponse: string) => void
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class OllamaClient {
  private client: Ollama
  private model: string

  constructor(model: string = DEFAULT_MODEL) {
    this.client = new Ollama({ host: OLLAMA_HOST })
    this.model = model
  }

  getModel(): string {
    return this.model
  }

  async chat(messages: ChatMessage[], callbacks?: OllamaStreamCallbacks): Promise<string> {
    let fullResponse = ''

    try {
      console.log(`[Ollama] Sending chat request to ${OLLAMA_HOST} with model ${this.model}`)
      const response = await this.client.chat({
        model: this.model,
        messages,
        stream: true
      })

      for await (const chunk of response) {
        const token = chunk.message.content
        fullResponse += token

        if (callbacks?.onToken) {
          callbacks.onToken(token)
        }
      }

      if (callbacks?.onComplete) {
        callbacks.onComplete(fullResponse)
      }

      console.log(`[Ollama] Chat completed, response length: ${fullResponse.length}`)
      return fullResponse
    } catch (error) {
      console.error(`[Ollama] Chat error:`, error)
      if (error instanceof Error) {
        console.error(`[Ollama] Error message: ${error.message}`)
        console.error(`[Ollama] Error stack:`, error.stack)
        throw new Error(`Ollama error: ${error.message}`)
      }
      throw error
    }
  }

  async generate(prompt: string, callbacks?: OllamaStreamCallbacks): Promise<string> {
    let fullResponse = ''

    try {
      const response = await this.client.generate({
        model: this.model,
        prompt,
        stream: true
      })

      for await (const chunk of response) {
        const token = chunk.response
        fullResponse += token

        if (callbacks?.onToken) {
          callbacks.onToken(token)
        }
      }

      if (callbacks?.onComplete) {
        callbacks.onComplete(fullResponse)
      }

      return fullResponse
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Ollama error: ${error.message}`)
      }
      throw error
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.client.list()
      return response.models.some(m => m.name.includes(this.model.split(':')[0]))
    } catch {
      return false
    }
  }

  async pullModel(): Promise<void> {
    console.log(`Pulling model ${this.model}...`)
    await this.client.pull({ model: this.model })
    console.log(`Model ${this.model} pulled successfully`)
  }
}
