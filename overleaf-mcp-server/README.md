# Overleaf MCP Server

A **100% FREE** LaTeX project management MCP server with compilation via [LaTeX.Online](https://latexonline.cc), [Open in Overleaf](https://www.overleaf.com/devs) integration, and **ChatGPT Deep Research** compatibility.

[![Built with mcp-use](https://img.shields.io/badge/Built%20with-mcp--use-blue)](https://mcp-use.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![ChatGPT Compatible](https://img.shields.io/badge/ChatGPT-Deep%20Research-green.svg)](https://platform.openai.com/docs/guides/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access the server
# MCP endpoint: http://localhost:3000/mcp
# SSE endpoint: http://localhost:3000/sse
# Inspector UI: http://localhost:3000/inspector
```
  
## Features

- 🆓 **100% Free** - No paid APIs or subscriptions required
- 📝 **Local Project Management** - Create, read, update, delete LaTeX projects
- 🔨 **Cloud Compilation** - Compile to PDF via LaTeX.Online (pdflatex, xelatex, lualatex)
- 🚀 **Open in Overleaf** - Generate URLs to import projects into Overleaf
- 🤖 **ChatGPT Compatible** - Works with Deep Research and Connectors
- 📦 **Package Search** - Search CTAN for LaTeX packages
- 🔍 **Smart Log Parsing** - Extract errors/warnings with line numbers

## MCP Tools (18)

### ChatGPT Deep Research (Required)

| Tool | Description |
| ---- | ----------- |
| `search` | Search all projects/files (OpenAI format) |
| `fetch` | Retrieve full document by ID (OpenAI format) |

### Project Management

| Tool | Description |
| ---- | ----------- |
| `latex_create_project` | Create a new LaTeX project |
| `latex_list_projects` | List all local projects |
| `latex_delete_project` | Delete a project |
| `latex_project_status` | Get detailed project info |

### File Operations

| Tool | Description |
| ---- | ----------- |
| `latex_list_files` | List files in a project |
| `latex_read_file` | Read file content |
| `latex_write_file` | Write content to file |
| `latex_delete_file` | Delete a file |

### Compilation & Export

| Tool | Description |
| ---- | ----------- |
| `latex_compile` | Compile to PDF via LaTeX.Online |
| `latex_analyze_log` | Parse last compilation log |
| `latex_open_in_overleaf` | Generate Overleaf URL |
| `latex_export_zip` | Export project as ZIP |

### Utilities

| Tool | Description |
| ---- | ----------- |
| `latex_validate` | Quick syntax validation |
| `latex_search_packages` | Search CTAN packages |
| `latex_get_package_info` | Get package details |
| `latex_get_symbol` | Find LaTeX symbol codes |

## ChatGPT Integration

This server implements OpenAI's MCP specification for **Deep Research** and **Connectors**.

### Setup with ChatGPT

1. Deploy server with a persistent Node.js host and public HTTPS URL
2. Enable Developer Mode: **Settings → Connectors → Advanced → Developer mode**
3. Add connector with MCP endpoint: `https://your-server.com/mcp`

### API Usage

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "o4-mini-deep-research",
    "input": [{"role": "user", "content": [{"type": "input_text", "text": "Search my LaTeX projects"}]}],
    "tools": [{
      "type": "mcp",
      "server_label": "latex",
      "server_url": "https://your-server.com/mcp",
      "allowed_tools": ["search", "fetch"],
      "require_approval": "never"
    }]
  }'
```

If you are using API-based remote MCP integrations, `/sse` remains available as an alternate transport.

## MCP Resources (6)

| URI | Description |
| --- | ----------- |
| `latex://projects` | List of all projects (JSON) |
| `latex://project/{name}` | Project metadata |
| `latex://project/{name}/file/{path}` | File content |
| `latex://project/{name}/log` | Last compilation log |
| `latex://cheatsheet` | LaTeX quick reference |
| `latex://symbols` | Symbol reference (JSON) |

## MCP Prompts (7)

- `write_section` - Generate LaTeX sections
- `fix_errors` - Fix compilation errors
- `convert_to_latex` - Convert markdown/text to LaTeX
- `create_table` - Generate booktabs tables
- `add_citations` - Create BibTeX entries
- `create_figure` - Generate figure environments
- `optimize_document` - Suggest improvements

## Configuration

Copy `config.example.json` to `config.json`:

```json
{
  "privacy": { "mode": "ask", "warnSize": 5242880 },
  "compilation": { "engine": "pdflatex", "timeout": 60000 },
  "cache": { "enabled": true, "maxAge": 3600000 }
}
```

## Architecture

```text
overleaf-mcp-server/
├── lib/                        # Core libraries
│   ├── types.ts                # TypeScript interfaces
│   ├── LocalProjectStore.ts    # File operations & search
│   ├── LaTeXOnlineClient.ts    # Cloud compilation
│   ├── LogParser.ts            # Parse LaTeX logs
│   ├── OpenInOverleafClient.ts # Generate Overleaf URLs
│   └── CTANClient.ts           # CTAN package search
├── tools/
│   └── index.ts                # 18 MCP tool definitions
├── prompts/
│   └── index.ts                # 7 MCP prompt definitions
└── index.ts                    # Server entry point
```

## External Services (All FREE)

| Service | Purpose |
| ------- | ------- |
| [LaTeX.Online](https://latexonline.cc) | PDF compilation |
| [CTAN API](https://ctan.org/json/2.0) | Package search |
| [Overleaf](https://www.overleaf.com/devs) | Open in Overleaf |

## License

MIT
