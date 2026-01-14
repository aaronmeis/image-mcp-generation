import { OllamaClient, OllamaStreamCallbacks, ChatMessage } from './ollama.js'
import { ChartGenerator, ChartData, ChartOptions } from './chartGenerator.js'
import { getSystemPrompt, getChartPrompt } from '../utils/prompts.js'

export interface AgentCallbacks extends OllamaStreamCallbacks {
  onImage?: (base64Image: string, chartData?: ChartData) => void
}

export class Agent {
  private ollama: OllamaClient
  private chartGenerator: ChartGenerator
  private conversationHistory: ChatMessage[] = []

  constructor() {
    this.ollama = new OllamaClient()
    this.chartGenerator = new ChartGenerator(this.ollama)

    // Initialize with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: getSystemPrompt()
    })
  }

  getModel(): string {
    return this.ollama.getModel()
  }

  async checkOllamaConnection(): Promise<boolean> {
    return this.ollama.checkConnection()
  }

  async chat(userMessage: string, callbacks: AgentCallbacks): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    })

    // Check if user is requesting a chart
    const isChartRequest = this.isChartRequest(userMessage)
    console.log(`[Agent] Chart request detected: ${isChartRequest} for message: "${userMessage.substring(0, 50)}..."`)

    let fullResponse = ''

    if (isChartRequest) {
      console.log('[Agent] Processing chart request...')
      // Get chart specification from LLM
      const chartPrompt = getChartPrompt(userMessage)
      const chartMessages: ChatMessage[] = [
        { role: 'system', content: chartPrompt },
        { role: 'user', content: userMessage }
      ]

      fullResponse = await this.ollama.chat(chartMessages, {
        onToken: callbacks.onToken
      })

      console.log(`[Agent] LLM response received, length: ${fullResponse.length}`)
      console.log(`[Agent] LLM full response:\n${fullResponse}`)

      // Try to parse and generate chart
      let chartSpec = this.chartGenerator.parseChartDataFromText(fullResponse)
      console.log(`[Agent] Chart spec parsed:`, chartSpec ? 'success' : 'failed')

      // Fallback: Generate sample chart if parsing failed
      if (!chartSpec) {
        console.warn('[Agent] Failed to parse chart specification, generating fallback chart...')
        chartSpec = this.generateFallbackChart(userMessage)
      }

      if (chartSpec && callbacks.onImage) {
        try {
          console.log('[Agent] Generating chart image...')
          
          // Generate watermark from user message
          // Extract a watermark prompt from the user message
          const watermarkPrompt = this.extractWatermarkPrompt(userMessage)
          
          // Check if user requested a background image
          const backgroundImagePrompt = this.extractBackgroundImagePrompt(userMessage)
          
          // Add watermark and background prompts to chart options
          const chartOptionsWithExtras = {
            ...chartSpec.options,
            watermarkPrompt,
            backgroundImagePrompt
          }
          
          const imageBase64 = await this.chartGenerator.generateFromData(
            chartSpec.data,
            chartOptionsWithExtras
          )
          console.log(`[Agent] Chart image generated successfully, size: ${imageBase64.length} chars`)
          console.log(`[Agent] Chart data:`, JSON.stringify(chartSpec.data, null, 2))
          callbacks.onImage(imageBase64, chartSpec.data)
        } catch (error) {
          console.error('[Agent] Chart generation error:', error)
          if (error instanceof Error) {
            console.error('[Agent] Error stack:', error.stack)
          }
        }
      } else {
        if (!callbacks.onImage) {
          console.warn('[Agent] No onImage callback provided')
        }
      }
    } else {
      // Regular chat
      console.log('[Agent] Processing regular chat...')
      fullResponse = await this.ollama.chat(this.conversationHistory, {
        onToken: callbacks.onToken
      })
    }

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: fullResponse
    })

    // Trim history if too long
    this.trimHistory()

    if (callbacks.onComplete) {
      callbacks.onComplete(fullResponse)
    }

    return fullResponse
  }

  async generateDataChart(data: unknown): Promise<string> {
    const chartData = data as { data: ChartData; options: ChartOptions }
    return this.chartGenerator.generateFromData(chartData.data, chartData.options)
  }

  async generateAIChart(prompt: string, callbacks?: OllamaStreamCallbacks): Promise<string> {
    const chartPrompt = getChartPrompt(prompt)

    const response = await this.ollama.generate(chartPrompt, callbacks)

    const chartSpec = this.chartGenerator.parseChartDataFromText(response)

    if (!chartSpec) {
      throw new Error('Failed to generate valid chart specification from AI response')
    }

    return this.chartGenerator.generateFromData(chartSpec.data, chartSpec.options)
  }

  private isChartRequest(message: string): boolean {
    const chartKeywords = [
      'chart', 'graph', 'plot', 'visualize', 'visualization',
      'bar chart', 'line chart', 'pie chart', 'histogram',
      'show me', 'create a', 'generate a', 'draw a'
    ]

    const lowerMessage = message.toLowerCase()
    return chartKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  private generateFallbackChart(userMessage: string): { data: ChartData; options: ChartOptions } {
    const lowerMessage = userMessage.toLowerCase()
    
    // Determine chart type from message
    let chartType: 'bar' | 'line' | 'pie' | 'doughnut' = 'bar'
    if (lowerMessage.includes('pie')) {
      chartType = 'pie'
    } else if (lowerMessage.includes('doughnut')) {
      chartType = 'doughnut'
    } else if (lowerMessage.includes('line') || lowerMessage.includes('trend')) {
      chartType = 'line'
    }

    // Generate sample data based on message content
    const labels = ['Category A', 'Category B', 'Category C', 'Category D', 'Category E']
    const data = [25, 30, 20, 15, 10]

    // Try to extract meaningful labels from the message
    if (lowerMessage.includes('month')) {
      labels.splice(0, 5, 'Jan', 'Feb', 'Mar', 'Apr', 'May')
    } else if (lowerMessage.includes('quarter')) {
      labels.splice(0, 4, 'Q1', 'Q2', 'Q3', 'Q4')
      data.splice(0, 4, 30, 35, 28, 32)
    } else if (lowerMessage.includes('product')) {
      labels.splice(0, 5, 'Product 1', 'Product 2', 'Product 3', 'Product 4', 'Product 5')
    }

    return {
      data: {
        labels,
        datasets: [{
          label: 'Sample Data',
          data
        }]
      },
      options: {
        type: chartType,
        title: 'Generated Chart',
        watermarkPrompt: this.extractWatermarkPrompt(userMessage)
      }
    }
  }

  /**
   * Extract a watermark prompt from the user message
   * This creates a simplified version of the user's request for watermarking
   */
  private extractWatermarkPrompt(userMessage: string): string {
    // Remove common chart request words and keep meaningful content
    const cleaned = userMessage
      .replace(/create|show|generate|display|chart|graph|pie|bar|line|doughnut|me|a|an|the/gi, '')
      .trim()
    
    // Take first 5-10 words for watermark
    const words = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 5)
    
    if (words.length > 0) {
      return words.join(' ')
    }
    
    // Fallback: use first 15 characters of original message
    return userMessage.substring(0, 15)
  }

  /**
   * Extract background image prompt from user message
   * Detects if user wants a background image and extracts the description
   */
  private extractBackgroundImagePrompt(userMessage: string): string | undefined {
    const lowerMessage = userMessage.toLowerCase()
    
    // Check if user explicitly requests background
    const backgroundKeywords = [
      'background', 'bg', 'with background', 'background image', 
      'background color', 'background pattern', 'background gradient'
    ]
    
    const hasBackgroundRequest = backgroundKeywords.some(keyword => lowerMessage.includes(keyword))
    
    if (hasBackgroundRequest) {
      // Extract the background description from the message
      // Look for patterns like "with [description] background" or "background: [description]"
      let backgroundDesc = userMessage
        .replace(/.*?(?:with|background|bg)[:\s]+(.*?)(?:chart|graph|showing|displaying|$)/i, '$1')
        .trim()
      
      // If no specific description found, use the main theme
      if (!backgroundDesc || backgroundDesc.length < 3) {
        backgroundDesc = userMessage
          .replace(/create|show|generate|display|chart|graph|pie|bar|line|doughnut/gi, '')
          .trim()
          .split(/\s+/)
          .slice(0, 5)
          .join(' ')
      }
      
      if (backgroundDesc && backgroundDesc.length > 2) {
        console.log('[Agent] Background image requested:', backgroundDesc)
        return backgroundDesc
      }
    }
    
    return undefined
  }

  private trimHistory() {
    // Keep system prompt + last 20 messages
    const maxMessages = 21
    if (this.conversationHistory.length > maxMessages) {
      const systemPrompt = this.conversationHistory[0]
      this.conversationHistory = [
        systemPrompt,
        ...this.conversationHistory.slice(-20)
      ]
    }
  }

  clearHistory() {
    this.conversationHistory = [this.conversationHistory[0]]
  }
}
