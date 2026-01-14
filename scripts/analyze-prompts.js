#!/usr/bin/env node

/**
 * Prompt Analysis Script
 * Analyzes prompt logs to generate performance reports
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const LOG_PATH = join(__dirname, '..', 'experiments', 'prompts', 'prompt-log.jsonl')
const RESULTS_DIR = join(__dirname, '..', 'experiments', 'results')

function parseLogFile() {
  if (!existsSync(LOG_PATH)) {
    console.log('No prompt log file found. Run the application first to generate logs.')
    return []
  }

  const content = readFileSync(LOG_PATH, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  return lines.map(line => {
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  }).filter(Boolean)
}

function analyzePrompts(logs) {
  if (logs.length === 0) {
    return null
  }

  // Group by type
  const byType = logs.reduce((acc, log) => {
    const type = log.type || 'unknown'
    if (!acc[type]) acc[type] = []
    acc[type].push(log)
    return acc
  }, {})

  // Calculate statistics
  const stats = {}

  for (const [type, typeLogs] of Object.entries(byType)) {
    const latencies = typeLogs.map(l => l.latencyMs).filter(Boolean).sort((a, b) => a - b)

    stats[type] = {
      count: typeLogs.length,
      latency: latencies.length > 0 ? {
        min: latencies[0],
        max: latencies[latencies.length - 1],
        avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        p50: latencies[Math.floor(latencies.length * 0.5)],
        p95: latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1]
      } : null,
      promptVersions: [...new Set(typeLogs.map(l => l.promptVersion).filter(Boolean))],
      models: [...new Set(typeLogs.map(l => l.model).filter(Boolean))]
    }
  }

  // Time-based analysis
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const timeRange = {
    start: sortedLogs[0]?.timestamp,
    end: sortedLogs[sortedLogs.length - 1]?.timestamp
  }

  // Daily breakdown
  const dailyStats = logs.reduce((acc, log) => {
    const date = log.timestamp?.split('T')[0]
    if (!date) return acc
    if (!acc[date]) acc[date] = { count: 0, totalLatency: 0 }
    acc[date].count++
    acc[date].totalLatency += log.latencyMs || 0
    return acc
  }, {})

  return {
    totalLogs: logs.length,
    byType: stats,
    timeRange,
    dailyStats: Object.entries(dailyStats).map(([date, data]) => ({
      date,
      count: data.count,
      avgLatency: data.totalLatency / data.count
    }))
  }
}

function generateReport(analysis) {
  if (!analysis) {
    return 'No data to analyze.'
  }

  let report = `
PROMPT ANALYSIS REPORT
${'='.repeat(60)}
Generated: ${new Date().toISOString()}
Total Log Entries: ${analysis.totalLogs}
Time Range: ${analysis.timeRange.start || 'N/A'} to ${analysis.timeRange.end || 'N/A'}

BY TYPE
${'-'.repeat(40)}
`

  for (const [type, stats] of Object.entries(analysis.byType)) {
    report += `
${type.toUpperCase()}:
  Count: ${stats.count}
  Prompt Versions: ${stats.promptVersions.join(', ') || 'N/A'}
  Models: ${stats.models.join(', ') || 'N/A'}
`
    if (stats.latency) {
      report += `  Latency (ms):
    Min: ${stats.latency.min.toFixed(0)}
    Max: ${stats.latency.max.toFixed(0)}
    Avg: ${stats.latency.avg.toFixed(0)}
    P50: ${stats.latency.p50.toFixed(0)}
    P95: ${stats.latency.p95.toFixed(0)}
`
    }
  }

  if (analysis.dailyStats.length > 0) {
    report += `
DAILY BREAKDOWN
${'-'.repeat(40)}
Date          | Count | Avg Latency (ms)
`
    for (const day of analysis.dailyStats.slice(-7)) {
      report += `${day.date} | ${day.count.toString().padStart(5)} | ${day.avgLatency.toFixed(0)}\n`
    }
  }

  return report
}

function main() {
  console.log('Analyzing prompt logs...\n')

  const logs = parseLogFile()
  const analysis = analyzePrompts(logs)
  const report = generateReport(analysis)

  console.log(report)

  // Save JSON analysis
  if (analysis) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const jsonPath = join(RESULTS_DIR, `analysis-${timestamp}.json`)
    writeFileSync(jsonPath, JSON.stringify(analysis, null, 2))
    console.log(`\nJSON analysis saved to: ${jsonPath}`)
  }
}

main()
