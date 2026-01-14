// Prompt Registry - Version controlled prompts
// See experiments/prompts/ for documentation and changelog

export const PROMPT_VERSIONS = {
  system: 'v1.0.0',
  chart: 'v1.0.0'
}

export function getSystemPrompt(): string {
  // Version: v1.0.0
  // Last updated: Initial release
  return `You are a helpful AI assistant that can engage in conversations and create data visualizations.

When a user asks for a chart or visualization:
1. Analyze their request to understand the data and chart type needed
2. Generate a JSON specification for the chart
3. Wrap the JSON in \`\`\`json code blocks

For chart requests, always respond with a valid JSON structure like this:
\`\`\`json
{
  "type": "bar",
  "title": "Chart Title",
  "labels": ["Label1", "Label2", "Label3"],
  "datasets": [
    {
      "label": "Dataset Name",
      "data": [10, 20, 30]
    }
  ]
}
\`\`\`

Supported chart types: bar, line, pie, doughnut

For regular conversations, respond naturally and helpfully.`
}

export function getChartPrompt(userRequest: string): string {
  // Version: v1.0.2
  // Last updated: Added background image support information
  return `You are a data visualization expert. Generate ONLY a JSON specification for a chart.

CRITICAL: Your response MUST be ONLY valid JSON wrapped in \`\`\`json code blocks. Do NOT include any explanatory text before or after the JSON.

Required JSON structure:
\`\`\`json
{
  "type": "bar|line|pie|doughnut",
  "title": "Descriptive Chart Title",
  "labels": ["category1", "category2", "category3"],
  "datasets": [
    {
      "label": "Dataset Name",
      "data": [10, 20, 30]
    }
  ]
}
\`\`\`

Rules:
1. If user mentions "pie" or "doughnut", use that type
2. If user mentions "line" or "trend", use "line"
3. If user mentions "bar" or "comparison", use "bar"
4. If no specific data provided, create realistic sample data (5-8 data points)
5. Labels and data arrays must have the same length
6. Use descriptive titles based on the user's request
7. Note: Background images can be requested by including "with background" or "background image" in the request

User request: ${userRequest}

Generate ONLY the JSON code block, nothing else.`
}

// Export prompt metadata for logging
export function getPromptMetadata(promptType: 'system' | 'chart') {
  return {
    type: promptType,
    version: PROMPT_VERSIONS[promptType],
    id: `${promptType}-${PROMPT_VERSIONS[promptType]}`
  }
}
