// Script to generate 6 sample chart images for demo purposes
// Uses ChartGenerator directly with predefined data (no Ollama required)
import { ChartGenerator } from '../mcp-server/src/agent/chartGenerator.ts'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const demoDir = join(__dirname, '..', 'demo')

// Ensure demo directory exists
try {
  mkdirSync(demoDir, { recursive: true })
  console.log('Created demo directory')
} catch (error) {
  if (error.code !== 'EEXIST') {
    throw error
  }
}

// Mock Ollama client for background generation (returns description directly)
const mockOllamaClient = {
  generate: async (prompt) => {
    // Extract color from prompt if present
    // The prompt format is: "Describe a subtle, professional background image for a data chart based on: "light blue gradient"."
    const lowerPrompt = prompt.toLowerCase()
    // Check for specific professional light colors
    if (lowerPrompt.includes('lavender')) return 'lavender gradient'
    if (lowerPrompt.includes('mint')) return 'mint gradient'
    if (lowerPrompt.includes('sky blue')) return 'sky blue gradient'
    if (lowerPrompt.includes('peach')) return 'peach gradient'
    if (lowerPrompt.includes('rose')) return 'rose gradient'
    if (lowerPrompt.includes('blue')) return 'light blue gradient'
    if (lowerPrompt.includes('purple')) return 'purple gradient'
    if (lowerPrompt.includes('green')) return 'green gradient'
    return 'light gradient'
  }
}

const chartGenerator = new ChartGenerator(mockOllamaClient)

// Helper function to convert base64 to PNG file
function saveBase64Image(base64Data, filename) {
  // Remove data URL prefix if present
  const base64 = base64Data.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  const filepath = join(demoDir, filename)
  writeFileSync(filepath, buffer)
  console.log(`✓ Saved: ${filename}`)
}

// Sample charts to generate with subtle, professional light background colors
const sampleCharts = [
  {
    name: '01-bar-chart-quarterly-sales.png',
    data: {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [{
        label: 'Sales (in thousands)',
        data: [45, 52, 48, 61]
      }]
    },
    options: {
      type: 'bar',
      title: 'Quarterly Sales 2024',
      backgroundColor: '#ffffff', // Subtle white base
      backgroundImagePrompt: 'light blue gradient' // Very light, professional blue
    },
    description: 'Bar chart - Quarterly sales'
  },
  {
    name: '02-line-chart-temperature-trend.png',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Temperature (°C)',
        data: [5, 7, 12, 18, 22, 26, 28, 27, 23, 17, 11, 7]
      }]
    },
    options: {
      type: 'line',
      title: 'Temperature Trends 2024',
      backgroundColor: '#ffffff', // Subtle white base
      backgroundImagePrompt: 'light lavender gradient' // Very light, professional lavender
    },
    description: 'Line chart - Temperature trends'
  },
  {
    name: '03-pie-chart-market-share.png',
    data: {
      labels: ['Company A', 'Company B', 'Company C', 'Company D', 'Others'],
      datasets: [{
        label: 'Market Share (%)',
        data: [35, 28, 20, 12, 5]
      }]
    },
    options: {
      type: 'pie',
      title: 'Market Share Distribution',
      backgroundColor: '#ffffff', // Subtle white base
      backgroundImagePrompt: 'light mint gradient' // Very light, professional mint green
    },
    description: 'Pie chart - Market share'
  },
  {
    name: '04-bar-chart-with-background.png',
    data: {
      labels: ['Product A', 'Product B', 'Product C', 'Product D', 'Product E'],
      datasets: [{
        label: 'Units Sold',
        data: [120, 95, 150, 110, 135]
      }]
    },
    options: {
      type: 'bar',
      title: 'Product Sales',
      backgroundColor: '#ffffff', // Subtle white base
      backgroundImagePrompt: 'light sky blue gradient' // Very light, professional sky blue
    },
    description: 'Bar chart with background - Product sales'
  },
  {
    name: '05-doughnut-chart-revenue.png',
    data: {
      labels: ['North', 'South', 'East', 'West'],
      datasets: [{
        label: 'Revenue (%)',
        data: [40, 25, 20, 15]
      }]
    },
    options: {
      type: 'doughnut',
      title: 'Revenue by Region',
      backgroundColor: '#ffffff', // Subtle white base
      backgroundImagePrompt: 'light peach gradient' // Very light, professional peach
    },
    description: 'Doughnut chart - Revenue by region'
  },
  {
    name: '06-line-chart-with-background.png',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Website Traffic',
        data: [1200, 1500, 1800, 2100, 1900, 1400, 1100]
      }]
    },
    options: {
      type: 'line',
      title: 'Weekly Website Traffic',
      backgroundColor: '#ffffff', // Subtle white base
      backgroundImagePrompt: 'light rose gradient' // Very light, professional rose
    },
    description: 'Line chart with background - Website traffic'
  }
]

async function generateAllCharts() {
  console.log('Generating 6 sample chart images...\n')
  
  for (let i = 0; i < sampleCharts.length; i++) {
    const chart = sampleCharts[i]
    console.log(`[${i + 1}/6] Generating: ${chart.description}`)
    
    try {
      const imageBase64 = await chartGenerator.generateFromData(chart.data, chart.options)
      
      if (imageBase64) {
        saveBase64Image(imageBase64, chart.name)
      } else {
        console.error(`  ✗ Failed to generate image for: ${chart.name}`)
      }
    } catch (error) {
      console.error(`  ✗ Error generating ${chart.name}:`, error.message)
      if (error.stack) {
        console.error(error.stack)
      }
    }
    
    console.log('')
  }
  
  console.log('Demo images generation complete!')
  console.log(`All images saved to: ${demoDir}`)
}

// Run the generation
generateAllCharts().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
