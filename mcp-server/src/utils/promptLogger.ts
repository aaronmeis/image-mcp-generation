import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface PromptLogEntry {
  type: 'chat' | 'chart'
  prompt: string
  response: string
  latencyMs: number
  model: string
  promptVersion: string
  experimentId?: string
  metadata?: Record<string, unknown>
}

export class PromptLogger {
  private logPath: string
  private enabled: boolean

  constructor() {
    // Log to experiments/prompts/prompt-log.jsonl
    const projectRoot = join(__dirname, '..', '..', '..')
    this.logPath = join(projectRoot, 'experiments', 'prompts', 'prompt-log.jsonl')
    this.enabled = process.env.DISABLE_PROMPT_LOGGING !== 'true'

    this.ensureLogDirectory()
  }

  private ensureLogDirectory() {
    const dir = dirname(this.logPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  log(entry: PromptLogEntry): void {
    if (!this.enabled) return

    const logEntry = {
      timestamp: new Date().toISOString(),
      ...entry
    }

    try {
      appendFileSync(this.logPath, JSON.stringify(logEntry) + '\n')
    } catch (error) {
      console.error('Failed to write prompt log:', error)
    }
  }

  // Get log path for external access
  getLogPath(): string {
    return this.logPath
  }
}

// Singleton for shared logging
let loggerInstance: PromptLogger | null = null

export function getPromptLogger(): PromptLogger {
  if (!loggerInstance) {
    loggerInstance = new PromptLogger()
  }
  return loggerInstance
}
