# Installation Guide

This guide covers how to install and set up the MCP Chart Agent application.

## Prerequisites

Before installing, ensure you have the following:

- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
- **npm 9+**: Comes with Node.js
- **Ollama**: Required for LLM capabilities
- **Python 3.8+**: Optional, for Matplotlib chart generation

## Quick Start

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

The SPA will be available at `http://localhost:3000` (or next available port if 3000 is in use) and the MCP server at `ws://localhost:8080`.

## Detailed Installation

### 1. Install Ollama

#### Windows
Download from [ollama.ai](https://ollama.ai) and run the installer.

#### macOS
```bash
brew install ollama
```

#### Linux
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### 2. Pull the LLM Model

```bash
# Default model (recommended for this project)
ollama pull phi3:mini

# Alternative smaller model
ollama pull qwen2.5:0.5b

# Alternative larger model
ollama pull llama3.2:1b
```

### 3. Install Node.js Dependencies

```bash
# Install all workspace dependencies
npm install

# This installs:
# - Root dependencies (concurrently, typescript)
# - SPA dependencies (react, vite)
# - MCP Server dependencies (ws, ollama, chart.js, canvas)
```

### 4. Platform-Specific Requirements

#### Windows
The `canvas` package requires build tools:

```bash
npm install --global windows-build-tools
```

Or install Visual Studio Build Tools manually.

#### macOS
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### 5. Environment Configuration

Create a `.env` file in the project root (optional):

```env
# MCP Server Configuration
PORT=8080
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=phi3:mini

# SPA Configuration
VITE_WS_URL=ws://localhost:8080

# Logging
DISABLE_PROMPT_LOGGING=false
```

### 6. Verify Installation

```bash
# Check Ollama is running
ollama list

# Run the test suite
npm test

# Start the application
npm run dev
```

## Running in Production

### Build the Application

```bash
npm run build
```

### Start the Server

```bash
npm start
```

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start mcp-server/dist/server.js --name "mcp-chart-agent"

# Monitor
pm2 monit

# Logs
pm2 logs mcp-chart-agent
```

## Docker Installation

### Using Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  mcp-server:
    build: ./mcp-server
    ports:
      - "8080:8080"
    environment:
      - OLLAMA_HOST=http://ollama:11434
    depends_on:
      - ollama

  spa:
    build: ./spa
    ports:
      - "3000:3000"
    depends_on:
      - mcp-server

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

volumes:
  ollama_data:
```

```bash
docker-compose up -d
```

## Troubleshooting

### "Cannot find module 'canvas'"
Install system dependencies for your platform (see step 4).

### "Ollama connection refused"
1. Ensure Ollama is running: `ollama serve`
2. Check the host in your `.env` file

### "Model not found"
Pull the model: `ollama pull phi3:mini`

### WebSocket connection fails
1. Check the server is running on port 8080
2. Verify firewall settings
3. Check VITE_WS_URL in the SPA

## Next Steps

- Read the [Architecture Guide](./ARCHITECTURE.md) to understand the system
- Check [UPDATE.md](./UPDATE.md) for upgrade procedures
- Explore [experiments/README.md](../experiments/README.md) for prompt tuning
