# Experiments

This directory contains experiment tracking, prompt versioning, and performance metrics for the MCP Chart Agent.

## Directory Structure

```
experiments/
├── prompts/                  # Prompt versioning and logging
│   ├── system-prompts.md     # System prompt versions with changelog
│   ├── chart-prompts.md      # Chart generation prompt versions
│   ├── prompt-registry.json  # Central prompt configuration
│   └── prompt-log.jsonl      # Runtime prompt logs (gitignored)
│
└── results/                  # Performance metrics and experiment results
```

## Prompt Logging

All prompts sent to Ollama are automatically logged to `prompts/prompt-log.jsonl` in the following format:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "type": "chat|chart",
  "prompt": "User's input or chart request",
  "response": "LLM response",
  "latencyMs": 1234,
  "model": "phi3:mini",
  "promptVersion": "chat-v1.0.0",
  "experimentId": "optional-experiment-id"
}
```

## Running Experiments

### A/B Testing Prompts

1. Add a new prompt version to the appropriate markdown file
2. Register it in `prompt-registry.json`
3. Configure the experiment:

```json
{
  "experiments": {
    "active": [
      {
        "id": "exp-001",
        "name": "Chart prompt improvement",
        "variants": ["chart-gen-v1.0.0", "chart-gen-v1.1.0"],
        "traffic": [0.5, 0.5],
        "startDate": "2024-01-01"
      }
    ]
  }
}
```

4. Analyze results in `results/` directory

### Performance Benchmarks

Run benchmarks using:

```bash
npm run benchmark
```

This will measure:
- Response latency (p50, p95, p99)
- Token generation rate
- Chart generation success rate
- Memory usage

## Metrics Tracked

| Metric | Description |
|--------|-------------|
| `latency_ms` | Time from request to response completion |
| `token_count` | Number of tokens generated |
| `chart_success_rate` | Percentage of successful chart generations |
| `ttfb_ms` | Time to first byte (streaming) |

## Analyzing Logs

Use the analysis script to generate reports:

```bash
node scripts/analyze-prompts.js
```

This outputs:
- Average latency by prompt type
- Success rates over time
- Token usage statistics
- Experiment results comparison
