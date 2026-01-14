# Architecture Documentation

This document describes the system architecture of the MCP Chart Agent.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     React SPA (Vite)                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │    Chat     │  │   Message   │  │      ChartImage         │  │   │
│  │  │  Component  │  │  Component  │  │      Component          │  │   │
│  │  └──────┬──────┘  └─────────────┘  └─────────────────────────┘  │   │
│  │         │                                                        │   │
│  │  ┌──────▼──────┐  ┌─────────────┐                               │   │
│  │  │ useWebSocket│  │  MCPClient  │                               │   │
│  │  │    Hook     │  │   Service   │                               │   │
│  │  └──────┬──────┘  └──────┬──────┘                               │   │
│  └─────────┼────────────────┼──────────────────────────────────────┘   │
│            │                │                                           │
└────────────┼────────────────┼───────────────────────────────────────────┘
             │   WebSocket    │
             │   (JSON-RPC)   │
             ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Server Layer                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     MCP Server (Node.js)                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │  WebSocket  │  │  JSON-RPC   │  │      Stream             │  │   │
│  │  │   Server    │──│   Handler   │──│      Manager            │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │   │
│  │         │                │                                       │   │
│  │  ┌──────▼────────────────▼──────┐                               │   │
│  │  │           Agent              │                               │   │
│  │  │  ┌─────────┐  ┌───────────┐  │                               │   │
│  │  │  │ Ollama  │  │  Chart    │  │                               │   │
│  │  │  │ Client  │  │ Generator │  │                               │   │
│  │  │  └────┬────┘  └─────┬─────┘  │                               │   │
│  │  │       │              │         │                               │   │
│  │  │       │    ┌─────────▼──────┐ │                               │   │
│  │  │       │    │ Watermark      │ │                               │   │
│  │  │       │    │ Generator      │ │                               │   │
│  │  │       │    │ (uses Ollama)  │ │                               │   │
│  │  │       │    └─────────┬──────┘ │                               │   │
│  │  └───────┼──────────────┼────────┘                               │   │
│  │          │              │                                         │   │
│  │  ┌───────▼──────────────▼────────┐                               │   │
│  │  │      Prompt Logger           │                               │   │
│  │  └──────────────────────────────┘                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
             │
             │ HTTP (Multiple Agents)
             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              AI Layer (Ollama)                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Agent 1: Chart Generation                   │   │
│  │  Generates JSON chart specification from user prompt            │   │
│  │                                                                  │   │
│  │                    Agent 2: Background Generation                │   │
│  │  Generates background image description from prompt             │   │
│  │                                                                  │   │
│  │                    Agent 3: Watermark Generation                │   │
│  │  Generates watermark text from prompt                          │   │
│  │                                                                  │   │
│  │                     Model: phi3:mini (or configured)             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### SPA (React + Vite)

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `Chat.tsx` | Main chat interface | Message history, input handling, streaming display, prompt buttons (6 random), collapsible prompts |
| `Message.tsx` | Individual message | Role display, content rendering, streaming indicator, chart data support |
| `ChartImage.tsx` | Chart display | Base64 rendering, click-to-expand modal, loading state, download button, data table toggle |
| `StatusModal.tsx` | Status display | Server status monitoring, connection info, model details |
| `useWebSocket.ts` | WebSocket hook | Auto-reconnect, request/response handling, chart data streaming |
| `mcpClient.ts` | MCP service | Typed API methods, JSON-RPC formatting, status checking |

### MCP Server (Node.js)

| Module | Purpose | Key Features |
|--------|---------|--------------|
| `server.ts` | Entry point | WebSocket server, request routing |
| `agent/index.ts` | Agent orchestration | Chat handling, tool execution, multi-agent coordination |
| `agent/ollama.ts` | LLM client | Streaming, model management, used by multiple agents |
| `agent/chartGenerator.ts` | Chart creation | Chart.js rendering, PNG encoding, background/watermark integration |
| `agent/watermarkGenerator.ts` | Watermark/Background | Ollama-powered text generation, visual rendering |
| `utils/prompts.ts` | Prompt registry | Version-controlled prompts |
| `utils/promptLogger.ts` | Logging | JSONL format, metrics tracking |

## Data Flow

### Chat Request Flow

```
1. User types message in SPA
2. Chat component sends via WebSocket hook
3. MCPClient formats JSON-RPC request
4. Server receives and routes to chat handler
5. Agent prepares messages with system prompt
6. Ollama client streams tokens
7. Server streams tokens back via WebSocket
8. SPA updates message incrementally
9. On completion, full response logged
```

### Chart Generation Flow

```
1. User requests chart (detected by keywords)
2. Agent extracts:
   - Chart data requirements
   - Background image prompt (if requested)
   - Watermark prompt (from user message)
3. Agent 1 (Chart Generation):
   - Uses chart-specific prompt
   - Ollama generates JSON chart specification
   - ChartGenerator parses JSON from response
   - If parsing fails, fallback chart generated with sample data
4. Agent 2 (Background Generation):
   - If background requested, Ollama generates background description
   - ChartGenerator creates visual background (gradient/pattern/color)
   - Background description stored for watermark reuse
   - Background applied to canvas BEFORE chart rendering
5. Chart.js renders chart to canvas (462x347px default)
   - Chart renders on top of background
   - Chart area is transparent to show background
6. Agent 3 (Watermark Generation):
   - Reuses background description from Agent 2 as watermark text
   - If no background, falls back to Ollama-generated watermark from user prompt
   - WatermarkGenerator renders watermark text directly
   - Watermark applied to canvas AFTER chart rendering
   - Positioned bottom-right, semi-transparent, rotated
7. Canvas exported as PNG buffer
8. PNG encoded as base64
9. Server sends image and chart data via stream
10. SPA renders inline in message
11. User can click to expand in modal overlay
12. User can download chart or view data table
```

## Protocol Specification

### WebSocket Messages

#### Request (Client → Server)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "chat",
  "params": {
    "message": "User's message"
  }
}
```

#### Stream (Server → Client)
```json
{
  "jsonrpc": "2.0",
  "method": "stream",
  "params": {
    "type": "text|image|status|error",
    "content": "content string or base64",
    "streaming": true,
    "messageId": "uuid"
  }
}
```

#### Response (Server → Client)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "messageId": "uuid"
  }
}
```

### Available Methods

| Method | Params | Description |
|--------|--------|-------------|
| `chat` | `{message: string}` | Send chat message (triggers multi-agent chart generation) |
| `generateChart` | `{type, data?, prompt?}` | Generate chart directly with data |
| `getStatus` | - | Get server status (MCP, Ollama, model) |
| `listTools` | - | List available tools |
| `ping` | - | Health check |

### Multi-Agent Request Flow

When a user sends a chart request via `chat`:

1. **Request Analysis**: Agent detects chart request and extracts:
   - Chart data requirements
   - Background image prompt (if keywords detected)
   - Watermark prompt (from user message)

2. **Agent 1 Execution** (Chart Data):
   - Sends chart prompt to Ollama
   - Receives JSON chart specification
   - Parses and validates chart data

3. **Agent 2 Execution** (Background):
   - If background requested, sends background prompt to Ollama
   - Receives background description
   - Generates visual background (gradient/pattern/color)
   - Applies to canvas

4. **Chart Rendering**:
   - Chart.js renders chart on background
   - Chart area is transparent to show background

5. **Agent 3 Execution** (Watermark):
   - Sends watermark prompt to Ollama
   - Receives watermark text
   - Renders watermark image
   - Applies to canvas (bottom-right, rotated, semi-transparent)

6. **Response**:
   - Chart image (base64) sent via stream
   - Chart data sent via stream (for data table display)
   - Full response logged

## Security Considerations

1. **Input Validation**: All user input validated before processing
2. **WebSocket Origin**: Consider restricting allowed origins in production
3. **Prompt Injection**: System prompts designed to resist injection
4. **Data Sanitization**: Chart data validated before rendering
5. **Base64 Image Validation**: Chart images validated before rendering in DOM
6. **Status Information**: Server status endpoint exposes connection info only
7. **Agent Isolation**: Each agent uses separate prompts to prevent cross-contamination
8. **Error Handling**: Each agent has fallback mechanisms if Ollama fails

## Multi-Agent Architecture

The system uses **three specialized agents** that work together to generate charts:

### Agent 1: Chart Data Generation Agent
- **Purpose**: Generates JSON chart specification from user prompt
- **Uses**: Ollama with chart-specific prompt
- **Output**: Chart data structure (labels, datasets, type, title)
- **Location**: `agent/index.ts` → `chat()` method

### Agent 2: Background Generation Agent  
- **Purpose**: Generates background images/patterns for charts
- **Uses**: Ollama to create background descriptions
- **Process**:
  1. Detects background requests in user prompt
  2. Uses Ollama to generate background description
  3. Creates visual background (gradient/pattern/color) based on description
  4. Applies background to canvas BEFORE chart rendering
- **Output**: Background image/pattern applied to chart canvas
- **Location**: `agent/chartGenerator.ts` → `generateBackgroundImage()` → `applyBackground()`

### Agent 3: Watermark Generation Agent
- **Purpose**: Applies watermark to charts using the background description
- **Uses**: Reuses the background description generated by Agent 2 (no separate Ollama call)
- **Process**:
  1. If background was generated, uses that background description as watermark text
  2. If no background, falls back to generating watermark text via Ollama from user prompt
  3. Renders watermark as semi-transparent, rotated text
  4. Applies watermark to canvas AFTER chart rendering
- **Output**: Watermark text overlaid on chart (bottom-right) - reuses background description
- **Location**: `agent/watermarkGenerator.ts` → `applyWatermarkTextToCanvas()` (uses background description) or `applyWatermarkToCanvas()` (Ollama fallback)

### Agent Coordination Flow

```
User Request: "Create a bar chart with blue background showing sales"
    │
    ├─→ Agent 1 (Chart Generation)
    │   └─→ Ollama generates: { type: "bar", labels: [...], datasets: [...] }
    │
    ├─→ Agent 2 (Background Generation)  
    │   └─→ Ollama generates: "blue gradient"
    │   └─→ Creates gradient background
    │   └─→ Stores description: "blue gradient"
    │   └─→ Applies to canvas FIRST
    │
    ├─→ Chart.js renders chart on top of background
    │
    └─→ Agent 3 (Watermark Generation)
        └─→ Reuses background description: "blue gradient"
        └─→ Renders watermark text (no Ollama call - uses background description)
        └─→ Applies to canvas LAST (bottom-right, rotated, semi-transparent)
    │
    └─→ Final chart with background + watermark (watermark uses background description)
```

## Performance Optimizations

1. **Streaming**: Token-by-token streaming reduces perceived latency
2. **Connection Pooling**: Single WebSocket per client (shared between Chat and Status)
3. **History Trimming**: Conversation limited to last 20 messages
4. **Canvas Caching**: Chart.js components registered once
5. **Chart Size**: Optimized default size (462x347px) for faster rendering
6. **Prompt Randomization**: 6 random prompts loaded from 30 available options
7. **Efficient Watermarking**: Background description is reused as watermark (no duplicate Ollama call)
8. **Ollama Reuse**: Single Ollama client instance shared across all agents

## Scalability

### Horizontal Scaling
- Stateless server design allows multiple instances
- WebSocket connections can be load-balanced with sticky sessions
- Ollama can run on separate machine(s)

### Vertical Scaling
- Increase Ollama model size for better responses
- More CPU/RAM for concurrent chart generation
