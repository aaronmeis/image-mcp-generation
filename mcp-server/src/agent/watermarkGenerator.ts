// Watermark Generator - Creates watermark images from text prompts using Ollama

import { createCanvas } from '@napi-rs/canvas'
import { OllamaClient } from './ollama.js'

export class WatermarkGenerator {
  private ollama: OllamaClient
  private imageModel: string

  constructor(ollamaClient?: OllamaClient, imageModel?: string) {
    this.ollama = ollamaClient || new OllamaClient()
    // Use a model that can generate visual descriptions or use the default model
    this.imageModel = imageModel || process.env.OLLAMA_IMAGE_MODEL || process.env.OLLAMA_MODEL || 'phi3:mini'
  }
  /**
   * Generate a watermark image from a text prompt
   * Creates a simple text-based watermark that can be overlaid on charts
   */
  async generateWatermark(prompt: string, width: number = 200, height: number = 100): Promise<Buffer> {
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // Set transparent background
    ctx.clearRect(0, 0, width, height)

    // Create watermark text from prompt (use first few words or a simplified version)
    const watermarkText = this.extractWatermarkText(prompt)

    // Set watermark style (semi-transparent, rotated)
    ctx.save()
    ctx.globalAlpha = 0.3 // Semi-transparent watermark
    ctx.fillStyle = '#666666'
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Rotate watermark diagonally
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-Math.PI / 6) // -30 degrees

    // Draw watermark text
    ctx.fillText(watermarkText, 0, 0)

    // Optionally add a border/outline for better visibility
    ctx.strokeStyle = '#999999'
    ctx.lineWidth = 2
    ctx.strokeText(watermarkText, 0, 0)

    ctx.restore()

    return canvas.toBuffer('image/png')
  }

  /**
   * Generate watermark text using Ollama from the prompt
   * Uses Ollama to create a visual representation that becomes the watermark
   */
  private async generateWatermarkTextWithOllama(prompt: string): Promise<string> {
    try {
      console.log('[WatermarkGenerator] Generating watermark with Ollama from prompt:', prompt)
      
      // Create a prompt for Ollama to generate a concise, visual watermark representation
      const watermarkPrompt = `Based on this chart request: "${prompt}", generate a short watermark text (2-5 words) that visually represents the main theme or subject. 
Make it descriptive and meaningful. Respond with ONLY the watermark text, no explanations, quotes, or markdown formatting.`

      const response = await this.ollama.generate(watermarkPrompt)
      console.log('[WatermarkGenerator] Ollama raw response:', response)
      
      // Clean up the response - take first line and remove quotes/markdown
      let cleaned = response
        .trim()
        .split('\n')[0]
        .replace(/^["']|["']$/g, '')
        .replace(/^`|`$/g, '')
        .replace(/^watermark[:]\s*/i, '')
        .replace(/^text[:]\s*/i, '')
        .trim()
      
      // Remove common prefixes Ollama might add
      cleaned = cleaned.replace(/^(the|a|an)\s+/i, '')
      
      if (cleaned.length > 0 && cleaned.length < 60) {
        console.log('[WatermarkGenerator] Ollama generated watermark text:', cleaned)
        return cleaned
      }
      
      // Fallback to extracted text if Ollama response is invalid
      console.warn('[WatermarkGenerator] Ollama response invalid, using fallback')
      return this.extractWatermarkText(prompt)
    } catch (error) {
      console.error('[WatermarkGenerator] Error generating watermark with Ollama:', error)
      if (error instanceof Error) {
        console.error('[WatermarkGenerator] Error details:', error.message)
      }
      // Fallback to extracted text
      return this.extractWatermarkText(prompt)
    }
  }

  /**
   * Extract meaningful text for watermark from prompt (fallback method)
   */
  private extractWatermarkText(prompt: string): string {
    // Remove common chart-related words and take first meaningful words
    const words = prompt
      .toLowerCase()
      .replace(/create|show|generate|display|chart|graph|pie|bar|line|doughnut/gi, '')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3) // Take first 3 meaningful words

    if (words.length > 0) {
      return words
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    // Fallback to a shortened version of the prompt
    return prompt.length > 20 ? prompt.substring(0, 20) + '...' : prompt
  }

  /**
   * Apply watermark directly to chart canvas context
   * Uses Ollama to generate the watermark text from the prompt
   */
  async applyWatermarkToCanvas(ctx: any, chartWidth: number, chartHeight: number, watermarkPrompt: string): Promise<void> {
    // Generate watermark text using Ollama
    const watermarkText = await this.generateWatermarkTextWithOllama(watermarkPrompt)
    await this.applyWatermarkTextToCanvas(ctx, chartWidth, chartHeight, watermarkText)
  }

  /**
   * Apply watermark text directly to canvas (without Ollama generation)
   * Used when background description is reused as watermark
   */
  async applyWatermarkTextToCanvas(ctx: any, chartWidth: number, chartHeight: number, watermarkText: string): Promise<void> {
    // Calculate watermark size (max 30% of chart width)
    const maxWidth = chartWidth * 0.3
    const fontSize = Math.min(24, maxWidth / watermarkText.length * 2)
    
    ctx.save()
    ctx.globalAlpha = 0.3 // Semi-transparent watermark
    ctx.fillStyle = '#666666'
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Position: bottom-right
    const x = chartWidth - maxWidth / 2 - 20
    const y = chartHeight - 30
    
    // Rotate watermark diagonally
    ctx.translate(x, y)
    ctx.rotate(-Math.PI / 6) // -30 degrees
    
    // Draw watermark text
    ctx.fillText(watermarkText, 0, 0)
    
    // Add outline for better visibility
    ctx.strokeStyle = '#999999'
    ctx.lineWidth = 1
    ctx.strokeText(watermarkText, 0, 0)
    
    ctx.restore()
  }
}
