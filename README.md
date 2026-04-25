# Overleaf MCP Server

A powerful MCP (Model Context Protocol) server that provides seamless integration with Overleaf, enabling automatic download and upload of LaTeX projects with browser automation.

[![Built with mcp-use](https://img.shields.io/badge/Built%20with-mcp--use-blue)](https://mcp-use.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![ChatGPT Compatible](https://img.shields.io/badge/ChatGPT-Deep%20Research-green.svg)](https://platform.openai.com/docs/guides/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **✅ Automatic Downloads** - Download entire Overleaf projects with one command
- **✅ Browser Automation Uploads** - Upload files using real browser interaction (the only method that works with Overleaf)
- **✅ Smart Authentication** - Automatic cookie extraction and session management
- **✅ Production Ready** - Clean, tested, and reliable implementation

## 📦 Quick Start

```bash
# Navigate to the server directory
cd overleaf-mcp-server

# Install dependencies
npm install

# Set up authentication
npm run smart-auth

# Start the server
npm run dev
```

## 🎯 Usage

### Download Projects
```bash
latex_download_from_overleaf(projectId: "your-project-id", projectName: "local-project-name")
```

### Upload Files
```bash
latex_upload_to_overleaf(
  projectId: "your-project-id", 
  filePath: "filename.tex", 
  content: "Your LaTeX content here"
)
```

## 📁 Project Structure

```
overleaf-mcp/
├── overleaf-mcp-server/         # Main MCP server
│   ├── lib/
│   │   └── OverleafWebApiClient.ts  # Core API client
│   ├── scripts/
│   │   └── smart-auth.ts            # Authentication script
│   ├── tools/                       # MCP tool definitions
│   ├── resources/                   # MCP resources
│   ├── prompts/                     # MCP prompts
│   └── index.ts                     # Main server file
├── README.md                    # This file
└── package.json                # Root package.json
```

## 🧠 How It Works

### Download Functionality
- Uses Overleaf's HTTP API with session cookies
- Downloads entire project structure including all files
- Maintains folder organization and metadata

### Upload Functionality
- **Browser Automation** - The only method that works with Overleaf
- Launches Chrome with stealth settings
- Simulates real user interaction in the Overleaf editor
- Handles Overleaf's real-time collaboration system

### Authentication
- Automatic cookie extraction from browser sessions
- Maintains session state for seamless operation

## 🚨 Important Notes

### Upload Method
Overleaf blocks direct API uploads. The browser automation approach:
- ✅ Works reliably with Overleaf's real-time system
- ✅ Handles all file types and sizes
- ⚠️ Requires a graphical environment

### Authentication
- Cookies are stored in your system's temp directory
- Use `npm run smart-auth` to refresh authentication

## 📄 License

MIT License - see LICENSE file for details

---

**Built with ❤️ for seamless Overleaf integration**
