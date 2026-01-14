# MCP Chart Agent

A single-page application for generating charts via a Model Context Protocol (MCP) server using Ollama.

![MCP Chart Agent Architecture](./unamed2.png) 

[demo/README.md](demo/README.md)

[Video Demo](./demo.gif)


## Features

- **Chat Interface**: Real-time streaming chat with an AI assistant
- **Chart Generation**: Create bar, line, pie, and doughnut charts from natural language
- **Multi-Agent System**: Three specialized agents work together:
  - **Chart Agent**: Generates chart data specifications using Ollama
  - **Background Agent**: Creates visual backgrounds (gradients, patterns, colors) using Ollama, stores description
  - **Watermark Agent**: Reuses background description as watermark text (no separate Ollama call needed)
- **Background Images**: Request backgrounds in prompts (e.g., "with blue gradient background")
- **Watermarks**: Automatic watermark generation from user prompts using Ollama
- **Inline Images**: Charts render directly in the chat conversation with click-to-expand modal
- **Sample Prompts**: Collapsible section with 6 randomized prompt suggestions (some include backgrounds)
- **Data Tables**: View underlying chart data in expandable tables
- **Download Charts**: Download charts as PNG files
- **Status Monitoring**: Click status indicator to view MCP server, Ollama server, and model status
- **Prompt Logging**: All prompts and responses logged for analysis
- **Experiments**: Built-in A/B testing and benchmarking framework

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐     HTTP      ┌─────────────┐
│  React SPA  │ ←───────────────→  │ MCP Server  │ ←──────────→  │   Ollama    │
│  (Vite)     │                    │  (Node.js)  │               │ (phi3:mini) │
└─────────────┘                    └──────┬──────┘               └─────────────┘
                                          │                        (3 Agents)
                                          ↓                    ┌──────────────┐
                                   ┌─────────────┐            │ Agent 1:     │
                                   │   Chart     │            │ Chart Data   │
                                   │  Generator  │            │ Generation   │
                                   │ (Chart.js)  │            ├──────────────┤
                                   └──────┬──────┘            │ Agent 2:     │
                                          │                   │ Background   │
                                   ┌──────▼──────┐            │ Generation   │
                                   │ Watermark   │            ├──────────────┤
                                   │ Generator   │            │ Agent 3:     │
                                   │ (Ollama)    │            │ Watermark    │
                                   └─────────────┘            │ Generation   │
                                                              └──────────────┘

Flow: User Request → Agent 1 (Chart) → Agent 2 (Background) → Chart Render → Agent 3 (Watermark) → Final Chart
```

## Quick Start

### Prerequisites

- Node.js 18+
- Ollama installed and running

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd image-mcp-generation

# Install dependencies
npm install

# Pull the Ollama model
ollama pull phi3:mini

# Start development servers
npm run dev
```

The SPA will be at `http://localhost:3000` (or next available port) and the MCP server at `ws://localhost:8080`.

## Usage

### Chat Commands

Just type naturally! The agent will detect chart requests. You can also click on the sample prompt buttons above the input field for quick suggestions.

Example requests:
- "Create a bar chart showing quarterly sales"
- "Show me a pie chart of market share distribution"
- "Generate a line graph of temperature over time"
- "Create a bar chart with a blue gradient background showing sales data"
- "Generate a chart with background image showing quarterly revenue"

### Status Monitoring

Click the status indicator button in the header to view:
- MCP Server connection status and port
- Ollama Server connection status and host
- Current model name and availability

### Chart Interaction

- Charts render inline in the conversation
- Click any chart to expand it in a full-screen modal
- Click outside the modal or the Close button to dismiss

### API Methods

| Method | Description |
|--------|-------------|
| `chat` | Send a chat message |
| `generateChart` | Generate a chart from data or prompt |
| `getStatus` | Get server status (MCP, Ollama, model) |
| `listTools` | List available MCP tools |
| `ping` | Health check |

## Project Structure

```
image-mcp-generation/
├── spa/                    # React SPA
│   ├── src/
│   │   ├── components/     # React components (Chat, Message, ChartImage, StatusModal)
│   │   ├── hooks/          # Custom hooks (useWebSocket)
│   │   ├── services/       # API services (mcpClient)
│   │   └── config/         # Configuration files (prompts.json)
│   └── package.json
│
├── mcp-server/             # MCP Server
│   ├── src/
│   │   ├── agent/          # Agent and Ollama client
│   │   ├── tools/          # MCP tools
│   │   └── utils/          # Utilities
│   └── package.json
│
├── experiments/            # Experiment tracking
│   ├── prompts/            # Prompt versions and logs
│   └── results/            # Benchmark results
│
├── docs/                   # Documentation
│   ├── INSTALL.md          # Installation guide
│   ├── UPDATE.md           # Update procedures
│   └── ARCHITECTURE.md     # System architecture
│
└── scripts/                # Utility scripts
    ├── benchmark.js        # Performance benchmarks
    └── analyze-prompts.js  # Prompt analysis
```

## Configuration

Create a `.env` file (optional, defaults are provided):

```env
# Server
PORT=8080
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=phi3:mini

# SPA
VITE_WS_URL=ws://localhost:8080

# Logging
DISABLE_PROMPT_LOGGING=false
```

### Prompt Configuration

Sample prompts are stored in `spa/src/config/prompts.json`. The application randomly displays 3 prompts from the 30 available options on each page load.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both SPA and server in dev mode |
| `npm run dev:spa` | Start SPA only |
| `npm run dev:server` | Start server only |
| `npm run build` | Build for production |
| `npm run benchmark` | Run performance benchmarks |

## UI Features

### Status Monitoring
- Click the status indicator in the header to view detailed server information
- Shows MCP server connection status and port
- Displays Ollama server connection status and host
- Lists current model name and availability
- Refresh button to update status in real-time

### Sample Prompts
- Collapsible section above the input field
- Displays 3 randomly selected prompts from 30 available options
- Prompts are randomized on each page load
- Click any prompt to populate the input field
- Toggle button to show/hide the prompts section

### Chart Display
- Charts render inline in the conversation
- Click any chart to expand in a full-screen modal
- Optimized chart size (578x434px) for fast rendering
- Smooth animations and transitions
- Close button or click outside to dismiss modal

## Prompt Documentation

All prompts are version-controlled in `experiments/prompts/`:

- `system-prompts.md` - Chat system prompts
- `chart-prompts.md` - Chart generation prompts
- `prompt-registry.json` - Central prompt configuration
- `prompt-log.jsonl` - Runtime logs (gitignored)

Sample user prompts are stored in `spa/src/config/prompts.json` (30 prompts, 3 shown randomly).

## Experiments

Run A/B tests on prompt variations:

1. Add variants to prompt files
2. Configure in `prompt-registry.json`
3. Analyze with `npm run analyze-prompts`

## Performance

Run benchmarks:

```bash
npm run benchmark
```

Outputs latency percentiles, success rates, and token throughput.

## Documentation

- [Installation Guide](./docs/INSTALL.md)
- [Update Procedures](./docs/UPDATE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Next Steps & Improvements](./docs/NEXT_STEPS.md)
- [Experiments](./experiments/README.md)

## License

MIT
