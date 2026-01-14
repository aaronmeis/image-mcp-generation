#!/usr/bin/env node

/**
 * Performance Benchmark Script
 * Measures latency, throughput, and success rates
 */

import { WebSocket } from 'ws'
import { performance } from 'perf_hooks'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const WS_URL = process.env.WS_URL || 'ws://localhost:8080'
const NUM_ITERATIONS = parseInt(process.env.ITERATIONS || '10')

const testCases = [
  { type: 'chat', message: 'Hello, how are you?' },
  { type: 'chat', message: 'What is the capital of France?' },
  { type: 'chart', message: 'Create a bar chart showing sales by quarter' },
  { type: 'chart', message: 'Show me a pie chart of market share' }
]

class Benchmark {
  constructor() {
    this.results = []
    this.ws = null
    this.requestId = 0
    this.pendingRequests = new Map()
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL)

      this.ws.on('open', () => {
        console.log('Connected to MCP server')
        resolve()
      })

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString())

        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve, startTime } = this.pendingRequests.get(message.id)
          this.pendingRequests.delete(message.id)
          resolve({
            latency: performance.now() - startTime,
            success: !message.error
          })
        }
      })

      this.ws.on('error', reject)
      this.ws.on('close', () => console.log('Disconnected'))
    })
  }

  async sendRequest(message) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      const startTime = performance.now()

      this.pendingRequests.set(id, { resolve, reject, startTime })

      this.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'chat',
        params: { message }
      }))

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          resolve({ latency: 60000, success: false, timeout: true })
        }
      }, 60000)
    })
  }

  async runBenchmark() {
    console.log(`\nRunning benchmark with ${NUM_ITERATIONS} iterations per test case...`)
    console.log('='.repeat(60))

    for (const testCase of testCases) {
      const results = []
      console.log(`\nTest: "${testCase.message.substring(0, 40)}..."`)

      for (let i = 0; i < NUM_ITERATIONS; i++) {
        process.stdout.write(`  Iteration ${i + 1}/${NUM_ITERATIONS}\r`)
        const result = await this.sendRequest(testCase.message)
        results.push(result)

        // Small delay between requests
        await new Promise(r => setTimeout(r, 500))
      }

      const latencies = results.map(r => r.latency).sort((a, b) => a - b)
      const successCount = results.filter(r => r.success).length

      const stats = {
        testCase: testCase.message,
        type: testCase.type,
        iterations: NUM_ITERATIONS,
        successRate: (successCount / NUM_ITERATIONS) * 100,
        latency: {
          min: latencies[0],
          max: latencies[latencies.length - 1],
          avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
          p50: latencies[Math.floor(latencies.length * 0.5)],
          p95: latencies[Math.floor(latencies.length * 0.95)],
          p99: latencies[Math.floor(latencies.length * 0.99)]
        }
      }

      this.results.push(stats)

      console.log(`  Success Rate: ${stats.successRate.toFixed(1)}%`)
      console.log(`  Latency (ms): avg=${stats.latency.avg.toFixed(0)}, p50=${stats.latency.p50.toFixed(0)}, p95=${stats.latency.p95.toFixed(0)}`)
    }
  }

  saveResults() {
    const resultsDir = join(__dirname, '..', 'experiments', 'results')
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `benchmark-${timestamp}.json`
    const filepath = join(resultsDir, filename)

    const report = {
      timestamp: new Date().toISOString(),
      config: {
        wsUrl: WS_URL,
        iterations: NUM_ITERATIONS
      },
      results: this.results,
      summary: {
        totalTests: this.results.length,
        avgSuccessRate: this.results.reduce((a, r) => a + r.successRate, 0) / this.results.length,
        avgLatency: this.results.reduce((a, r) => a + r.latency.avg, 0) / this.results.length
      }
    }

    writeFileSync(filepath, JSON.stringify(report, null, 2))
    console.log(`\nResults saved to: ${filepath}`)

    return report
  }

  async close() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

async function main() {
  console.log('MCP Chart Agent - Performance Benchmark')
  console.log('='.repeat(60))

  const benchmark = new Benchmark()

  try {
    await benchmark.connect()
    await benchmark.runBenchmark()
    const report = benchmark.saveResults()

    console.log('\n' + '='.repeat(60))
    console.log('SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Tests: ${report.summary.totalTests}`)
    console.log(`Avg Success Rate: ${report.summary.avgSuccessRate.toFixed(1)}%`)
    console.log(`Avg Latency: ${report.summary.avgLatency.toFixed(0)}ms`)
  } catch (error) {
    console.error('Benchmark failed:', error.message)
    process.exit(1)
  } finally {
    await benchmark.close()
  }
}

main()
