# Overleaf-MCP

A **100% FREE** Model Context Protocol (MCP) server for LaTeX project management with cloud compilation, Overleaf integration, and **ChatGPT Deep Research** compatibility.

[![Built with mcp-use](https://img.shields.io/badge/Built%20with-mcp--use-blue)](https://mcp-use.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![ChatGPT Compatible](https://img.shields.io/badge/ChatGPT-Deep%20Research-green.svg)](https://platform.openai.com/docs/guides/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

This MCP server enables AI assistants (ChatGPT, Claude, etc.) to manage LaTeX projects, compile documents to PDF, and integrate with Overleaf—all without requiring any paid APIs.

### Key Features

- 🆓 **100% Free** - Uses LaTeX.Online for compilation (no payment required)
- 📝 **Local Project Management** - Create, read, update, delete LaTeX projects
- 🔨 **Cloud Compilation** - Compile to PDF (pdflatex, xelatex, lualatex)
- 🚀 **Open in Overleaf** - Generate URLs to import projects into Overleaf
- 🤖 **ChatGPT Compatible** - Works with Deep Research and Connectors
- 📦 **Package Search** - Search CTAN for LaTeX packages

## Quick Start

```bash
cd overleaf-mcp-server

# Install dependencies
npm install

# Start development server
npm run dev
```

Server starts at `http://localhost:3000` with:

- MCP endpoint at `/mcp`
- SSE endpoint at `/sse`
- Inspector UI at `/inspector`

## Capabilities

| Category | Count | Examples |
| -------- | ----- | -------- |
| **Tools** | 18 | `search`, `fetch`, `latex_compile`, `latex_open_in_overleaf` |
| **Resources** | 6 | `latex://projects`, `latex://cheatsheet` |
| **Prompts** | 7 | `write_section`, `fix_errors`, `create_table` |

## ChatGPT Integration

This server implements OpenAI's MCP spec for Deep Research. See [server README](./overleaf-mcp-server/README.md) for setup instructions.

## External Services (All FREE)

| Service | Purpose |
| ------- | ------- |
| [LaTeX.Online](https://latexonline.cc) | PDF compilation |
| [CTAN API](https://ctan.org/json/2.0) | Package search |
| [Overleaf](https://www.overleaf.com/devs) | Open in Overleaf |

## Documentation

- [Server README](./overleaf-mcp-server/README.md) - Full API reference
- [Architecture](./overleaf-mcp-server/ARCHITECTURE.md) - System design
- [Contributing](./overleaf-mcp-server/CONTRIBUTING.md) - Development guide

## License

MIT
