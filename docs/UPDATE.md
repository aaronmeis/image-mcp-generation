# Update Guide

This document provides procedures for updating the MCP Chart Agent to new versions.

## Version Compatibility

| Component | Current Version | Min Node | Min Ollama |
|-----------|----------------|----------|------------|
| MCP Server | 1.0.0 | 18.0.0 | 0.1.0 |
| SPA | 1.0.0 | 18.0.0 | - |

## Update Procedures

### Standard Update (Minor/Patch)

For versions like 1.0.x → 1.0.y or 1.x.0 → 1.y.0:

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Rebuild the application
npm run build

# Restart services
npm start
```

### Major Update

For versions like 1.x.x → 2.x.x:

1. **Backup your data**
```bash
# Backup prompt logs
cp experiments/prompts/prompt-log.jsonl prompt-log.backup.jsonl

# Backup any custom configurations
cp .env .env.backup
```

2. **Check breaking changes**
Review the CHANGELOG.md for migration notes.

3. **Update dependencies**
```bash
npm install
```

4. **Run migrations (if any)**
```bash
npm run migrate
```

5. **Test the update**
```bash
npm test
npm run benchmark
```

## Dependency Updates

### Updating Ollama Model

```bash
# Pull a newer version of the model
ollama pull phi3:mini

# Or switch to a different model
ollama pull llama3.2:1b

# Update .env
echo "OLLAMA_MODEL=llama3.2:1b" >> .env
```

### Updating Node.js Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all packages (respect semver)
npm update

# Update to latest (may include breaking changes)
npm install package-name@latest
```

### Updating Chart.js

When updating Chart.js, test chart generation:

```bash
npm install chart.js@latest
npm run benchmark
```

Check for API changes in the [Chart.js changelog](https://github.com/chartjs/Chart.js/releases).

## Rollback Procedures

### Quick Rollback

```bash
# Restore from backup
git checkout v1.0.0  # or previous tag

npm install
npm run build
npm start
```

### Data Restoration

```bash
# Restore prompt logs
mv prompt-log.backup.jsonl experiments/prompts/prompt-log.jsonl

# Restore configuration
mv .env.backup .env
```

## Prompt Version Updates

When updating prompts:

1. **Document the change** in `experiments/prompts/system-prompts.md` or `chart-prompts.md`

2. **Update the registry**
```json
// experiments/prompts/prompt-registry.json
{
  "prompts": {
    "chat-system": {
      "version": "v1.1.0",
      ...
    }
  }
}
```

3. **Update the code** in `mcp-server/src/utils/prompts.ts`

4. **Test with A/B experiment** before full rollout

## Health Checks

After any update, verify system health:

```bash
# Check server is responding
curl http://localhost:8080/health

# Run benchmarks
npm run benchmark

# Check logs for errors
tail -f experiments/prompts/prompt-log.jsonl | jq .
```

## Automated Updates (CI/CD)

### GitHub Actions Example

```yaml
name: Update Dependencies
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Update dependencies
        run: npm update

      - name: Test
        run: npm test

      - name: Create PR
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'chore: update dependencies'
          branch: 'deps/weekly-update'
```

## Changelog

### v1.2.0 (Current)
- **Multi-Agent Architecture**: Implemented three specialized agents:
  - Chart Data Generation Agent (generates chart specifications)
  - Background Generation Agent (creates visual backgrounds using Ollama)
  - Watermark Generation Agent (generates watermarks using Ollama)
- Added background image support (gradients, patterns, colors)
- Backgrounds generated via Ollama from user prompts
- Watermarks generated via Ollama and applied to all charts
- Updated sample prompts to include background requests
- Increased sample prompts from 3 to 6 per reload
- Added data table display (toggle button to show/hide chart data)
- Added download button for charts
- Changed chat input to textarea (taller, multi-line support)
- Auto-collapse prompts after sending message
- Optimized chart size (462x347px default, ~40% smaller than original)

### v1.1.0
- Added status modal with server monitoring (MCP, Ollama, model status)
- Added collapsible sample prompt buttons (3 random prompts from 30 available)
- Improved chart overlay rendering (fixed black screen issue)
- Optimized chart size (578x434px default, ~30% smaller than original)
- Added fallback chart generation when JSON parsing fails
- Enhanced error handling and logging throughout
- Fixed WebSocket connection flickering issues
- Improved chart prompt to enforce JSON output format

### v1.0.0 (Initial Release)
- Initial release
- React + Vite SPA
- MCP Server with WebSocket
- Ollama integration (phi3:mini)
- Chart.js data visualization
- Prompt logging system

---

For issues during updates, check:
1. [GitHub Issues](https://github.com/your-repo/issues)
2. [INSTALL.md](./INSTALL.md) for dependency requirements
3. Application logs in `experiments/prompts/prompt-log.jsonl`
