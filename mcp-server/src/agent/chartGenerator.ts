// Chart Generator using @napi-rs/canvas (local, no external API)

import { createCanvas } from '@napi-rs/canvas'
import { Chart, registerables } from 'chart.js'
import { WatermarkGenerator } from './watermarkGenerator.js'

// Register Chart.js components
Chart.register(...registerables)

export interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
  }>
}

export interface ChartOptions {
  type: 'bar' | 'line' | 'pie' | 'doughnut'
  title?: string
  width?: number
  height?: number
  watermarkPrompt?: string
  backgroundImagePrompt?: string
  backgroundColor?: string
  backgroundDescription?: string // Store the generated background description for watermark reuse
}

export class ChartGenerator {
  private defaultWidth = 462  // 578 * 0.8 (20% smaller)
  private defaultHeight = 347  // 434 * 0.8 (20% smaller)
  private watermarkGenerator: WatermarkGenerator
  private ollamaClient?: any

  constructor(ollamaClient?: any) {
    this.ollamaClient = ollamaClient
    this.watermarkGenerator = new WatermarkGenerator(ollamaClient)
  }

  async generateFromData(data: ChartData, options: ChartOptions): Promise<string> {
    const width = options.width || this.defaultWidth
    const height = options.height || this.defaultHeight

    // Create canvas using @napi-rs/canvas
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // Apply background before chart rendering
    await this.applyBackground(ctx, width, height, options)

    // Apply default colors if not provided
    const coloredData = this.applyDefaultColors(data, options.type)

    // Create chart and wait for render to complete
    return new Promise<string>((resolve) => {
      new Chart(ctx as unknown as CanvasRenderingContext2D, {
        type: options.type,
        data: coloredData,
        options: {
          responsive: false,
          animation: false,
          backgroundColor: 'transparent', // Allow background to show through
          plugins: {
            title: options.title ? {
              display: true,
              text: options.title,
              font: { size: 24, weight: 'bold' }
            } : undefined,
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                font: { size: 16 },
                padding: 20
              }
            }
          },
          scales: options.type !== 'pie' && options.type !== 'doughnut' ? {
            y: {
              beginAtZero: true,
              ticks: { font: { size: 14 } },
              title: { font: { size: 16 } },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              ticks: { font: { size: 14 } },
              title: { font: { size: 16 } },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            }
          } : undefined,
          // Ensure chart area is transparent to show background
          maintainAspectRatio: false
        }
      })

      // Give Chart.js time to render before capturing
      setTimeout(() => {
        // Apply watermark: use background description if available, otherwise use watermarkPrompt
        // This implements "use background as watermark" - the background description becomes the watermark
        const watermarkText = options.backgroundDescription || options.watermarkPrompt
        
        if (watermarkText) {
          // If we have a background description, use it directly as watermark text (no Ollama call needed)
          // Otherwise, use the watermark generator which will call Ollama
          if (options.backgroundDescription) {
            console.log('[ChartGenerator] Using background description as watermark:', options.backgroundDescription)
            // Apply watermark directly using the background description
            this.watermarkGenerator.applyWatermarkTextToCanvas(ctx, width, height, options.backgroundDescription)
              .then(() => {
                console.log('[ChartGenerator] Watermark (from background) applied successfully')
                const buffer = canvas.toBuffer('image/png')
                resolve(buffer.toString('base64'))
              })
              .catch((error) => {
                console.error('[ChartGenerator] Watermark application error:', error)
                const buffer = canvas.toBuffer('image/png')
                resolve(buffer.toString('base64'))
              })
          } else {
            // Use Ollama to generate watermark text
            this.watermarkGenerator.applyWatermarkToCanvas(ctx, width, height, options.watermarkPrompt!)
              .then(() => {
                console.log('[ChartGenerator] Watermark applied successfully')
                const buffer = canvas.toBuffer('image/png')
                resolve(buffer.toString('base64'))
              })
              .catch((error) => {
                console.error('[ChartGenerator] Watermark application error:', error)
                const buffer = canvas.toBuffer('image/png')
                resolve(buffer.toString('base64'))
              })
          }
        } else {
          const buffer = canvas.toBuffer('image/png')
          resolve(buffer.toString('base64'))
        }
      }, 50)
    })
  }

  /**
   * Apply background to chart canvas
   * Supports background images (generated via Ollama) or solid colors
   * Stores the background description in options for watermark reuse
   */
  private async applyBackground(ctx: any, width: number, height: number, options: ChartOptions): Promise<void> {
    // Set default background color
    ctx.fillStyle = options.backgroundColor || '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // If background image prompt is provided, generate and apply background image
    if (options.backgroundImagePrompt && this.ollamaClient) {
      try {
        console.log('[ChartGenerator] Generating background image from prompt:', options.backgroundImagePrompt)
        const backgroundResult = await this.generateBackgroundImage(options.backgroundImagePrompt, width, height)
        if (backgroundResult) {
          // Draw background image
          ctx.drawImage(backgroundResult.canvas, 0, 0, width, height)
          // Store the background description for watermark reuse
          options.backgroundDescription = backgroundResult.description
          console.log('[ChartGenerator] Background image applied successfully, description stored for watermark:', backgroundResult.description)
        }
      } catch (error) {
        console.error('[ChartGenerator] Background image generation error:', error)
        // Continue with solid color background if image generation fails
      }
    }
  }

  /**
   * Generate a background image using Ollama
   * Creates a simple gradient or pattern based on the prompt
   * Returns both the canvas and the description for watermark reuse
   */
  private async generateBackgroundImage(prompt: string, width: number, height: number): Promise<{ canvas: any; description: string } | null> {
    try {
      // Use Ollama to generate a description of the background
      const backgroundPrompt = `Describe a subtle, professional background image for a data chart based on: "${prompt}". 
Respond with 2-3 words describing colors, patterns, or themes (e.g., "blue gradient", "light grid", "subtle texture"). 
Respond with ONLY the description, no explanations.`

      const response = await this.ollamaClient.generate(backgroundPrompt)
      const description = response.trim().toLowerCase()
      
      console.log('[ChartGenerator] Ollama background description:', description)

      // Create a background canvas based on the description
      const bgCanvas = createCanvas(width, height)
      const bgCtx = bgCanvas.getContext('2d')

      // Generate background based on description
      if (description.includes('gradient') || description.includes('gradient')) {
        this.createGradientBackground(bgCtx, width, height, description)
      } else if (description.includes('grid') || description.includes('pattern')) {
        this.createPatternBackground(bgCtx, width, height, description)
      } else {
        this.createColorBackground(bgCtx, width, height, description)
      }

      return { canvas: bgCanvas, description }
    } catch (error) {
      console.error('[ChartGenerator] Error generating background image:', error)
      return null
    }
  }

  /**
   * Create a gradient background
   */
  private createGradientBackground(ctx: any, width: number, height: number, description: string): void {
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    
    // Extract colors from description or use defaults
    if (description.includes('blue')) {
      gradient.addColorStop(0, 'rgba(240, 248, 255, 0.8)')
      gradient.addColorStop(1, 'rgba(230, 240, 255, 0.8)')
    } else if (description.includes('green')) {
      gradient.addColorStop(0, 'rgba(240, 255, 240, 0.8)')
      gradient.addColorStop(1, 'rgba(230, 255, 230, 0.8)')
    } else if (description.includes('purple')) {
      gradient.addColorStop(0, 'rgba(250, 245, 255, 0.8)')
      gradient.addColorStop(1, 'rgba(240, 235, 255, 0.8)')
    } else {
      // Default subtle gradient
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
      gradient.addColorStop(1, 'rgba(248, 250, 252, 0.95)')
    }
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  /**
   * Create a pattern/grid background
   */
  private createPatternBackground(ctx: any, width: number, height: number, description: string): void {
    // Base color
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)'
    ctx.lineWidth = 1

    const gridSize = 20
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  /**
   * Create a solid color background
   */
  private createColorBackground(ctx: any, width: number, height: number, description: string): void {
    let color = '#ffffff'
    
    if (description.includes('blue')) {
      color = 'rgba(240, 248, 255, 0.9)'
    } else if (description.includes('green')) {
      color = 'rgba(240, 255, 240, 0.9)'
    } else if (description.includes('gray') || description.includes('grey')) {
      color = 'rgba(248, 250, 252, 0.9)'
    } else if (description.includes('light')) {
      color = 'rgba(255, 255, 255, 0.95)'
    }
    
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
  }

  private applyDefaultColors(data: ChartData, type: string): ChartData {
    const defaultColors = [
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 99, 132, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(255, 206, 86, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
      'rgba(199, 199, 199, 0.8)',
      'rgba(83, 102, 255, 0.8)'
    ]

    const borderColors = defaultColors.map(c => c.replace('0.8', '1'))

    return {
      ...data,
      datasets: data.datasets.map((dataset, i) => ({
        ...dataset,
        backgroundColor: dataset.backgroundColor ||
          (type === 'pie' || type === 'doughnut'
            ? defaultColors.slice(0, data.labels.length)
            : defaultColors[i % defaultColors.length]),
        borderColor: dataset.borderColor ||
          (type === 'pie' || type === 'doughnut'
            ? borderColors.slice(0, data.labels.length)
            : borderColors[i % borderColors.length]),
        borderWidth: dataset.borderWidth || 2
      }))
    }
  }

  parseChartDataFromText(text: string): { data: ChartData; options: ChartOptions } | null {
    try {
      console.log('[ChartGenerator] Parsing text, length:', text.length)
      console.log('[ChartGenerator] Full text:', text)
      
      // Try multiple patterns to extract JSON
      let jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
      if (!jsonMatch) {
        jsonMatch = text.match(/```\s*([\s\S]*?)\s*```/)
      }
      if (!jsonMatch) {
        jsonMatch = text.match(/\{[\s\S]*"labels"[\s\S]*"datasets"[\s\S]*\}/)
      }
      if (!jsonMatch) {
        // Try to find any JSON object
        jsonMatch = text.match(/\{[\s\S]{20,}\}/)
      }

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        console.log('[ChartGenerator] Extracted JSON string:', jsonStr.substring(0, 200))
        
        const parsed = JSON.parse(jsonStr)
        console.log('[ChartGenerator] Parsed JSON:', JSON.stringify(parsed, null, 2))

        // Handle different JSON structures
        let labels: string[] = []
        let datasets: Array<{ label: string; data: number[] }> = []
        let chartType = 'bar'
        let title = ''

        if (parsed.labels && Array.isArray(parsed.labels)) {
          labels = parsed.labels
        }
        
        if (parsed.datasets && Array.isArray(parsed.datasets)) {
          datasets = parsed.datasets.map((ds: any) => ({
            label: ds.label || 'Dataset',
            data: Array.isArray(ds.data) ? ds.data : []
          }))
        } else if (parsed.data && Array.isArray(parsed.data)) {
          // Handle case where data is directly in parsed.data
          datasets = [{
            label: parsed.label || 'Data',
            data: parsed.data
          }]
        }

        if (parsed.type) {
          chartType = parsed.type
        } else if (text.toLowerCase().includes('pie')) {
          chartType = 'pie'
        } else if (text.toLowerCase().includes('line')) {
          chartType = 'line'
        } else if (text.toLowerCase().includes('bar')) {
          chartType = 'bar'
        }

        if (parsed.title) {
          title = parsed.title
        }

        // Validate we have the minimum required data
        if (labels.length > 0 && datasets.length > 0 && datasets[0].data.length > 0) {
          console.log('[ChartGenerator] Successfully parsed chart spec')
          return {
            data: {
              labels,
              datasets
            },
            options: {
              type: chartType as 'bar' | 'line' | 'pie' | 'doughnut',
              title
            }
          }
        } else {
          console.warn('[ChartGenerator] Missing required data:', { labels: labels.length, datasets: datasets.length })
        }
      } else {
        console.warn('[ChartGenerator] No JSON found in response')
      }

      return null
    } catch (error) {
      console.error('[ChartGenerator] Parse error:', error)
      if (error instanceof Error) {
        console.error('[ChartGenerator] Error details:', error.message)
      }
      return null
    }
  }
}
