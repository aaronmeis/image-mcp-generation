declare module '../config/prompts.json' {
  export interface PromptsConfig {
    prompts: string[]
  }
  const config: PromptsConfig
  export default config
}
