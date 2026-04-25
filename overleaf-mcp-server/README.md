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

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd overleaf-mcp/overleaf-mcp-server

# Install dependencies
npm install

# Set up authentication
npm run smart-auth
```

## 🔐 Authentication

The server uses smart authentication that automatically extracts and manages Overleaf session cookies:

```bash
npm run smart-auth
```

This will:
- Check for existing valid cookies
- Guide you through authentication if needed
- Store cookies securely for automatic use

## 🎯 Usage

### Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Available Tools

#### Download Projects
```bash
# Download entire Overleaf project
latex_download_from_overleaf(projectId: "your-project-id", projectName: "local-project-name")
```

#### Upload Files
```bash
# Upload files to Overleaf (uses browser automation)
latex_upload_to_overleaf(
  projectId: "your-project-id", 
  filePath: "filename.tex", 
  content: "Your LaTeX content here"
)
```

#### Other Tools
- `latex_create_project` - Create new Overleaf projects
- `latex_list_projects` - List your Overleaf projects
- `latex_compile` - Compile LaTeX documents
- `latex_analyze_log` - Analyze compilation errors
- And many more...

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
- Automatically creates files if they don't exist

### Authentication
- Automatic cookie extraction from browser sessions
- Supports multiple authentication methods
- Maintains session state for seamless operation

## 📁 Project Structure

```
overleaf-mcp-server/
├── lib/
│   └── OverleafWebApiClient.ts    # Core API client
├── scripts/
│   └── smart-auth.ts              # Authentication script
├── tools/                         # MCP tool definitions
├── resources/                     # MCP resources
├── prompts/                       # MCP prompts
├── index.ts                       # Main server file
└── package.json
```

## 🔧 Configuration

The server uses environment variables and configuration files:

- `.env` - Environment variables (copy from `.env.example`)
- `config.json` - Server configuration (copy from `config.example.json`)

## 🚨 Important Notes

### Upload Method
Overleaf blocks direct API uploads. The browser automation approach:
- ✅ Works reliably with Overleaf's real-time system
- ✅ Handles all file types and sizes
- ✅ Maintains proper formatting and encoding
- ⚠️ Requires a graphical environment (cannot run in pure headless mode)

### Authentication
- Cookies are stored in your system's temp directory
- Authentication expires and needs periodic renewal
- Use `npm run smart-auth` to refresh authentication

## � Troubleshooting

### Upload Issues
- Ensure Chrome/Chromium is installed
- Check that authentication is current (`npm run smart-auth`)
- Verify the project ID is correct

### Download Issues
- Check network connectivity
- Verify project permissions
- Ensure authentication cookies are valid

### Authentication Issues
- Run `npm run smart-auth` to refresh
- Clear old cookies if needed
- Check Overleaf login status

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review existing issues
- Create a new issue with detailed information

---

**Built with ❤️ for seamless Overleaf integration**
