# Architecture

This document describes the internal architecture of the Overleaf MCP Server.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP Client (LLM)                            │
│              (ChatGPT Deep Research, Claude, etc.)                  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ MCP Protocol (SSE/HTTP)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Overleaf MCP Server                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      index.ts                                │   │
│  │              Server Entry Point & Resources                  │   │
│  └──────────┬───────────────────────────┬──────────────────────┘   │
│             │                           │                           │
│  ┌──────────▼──────────┐     ┌──────────▼──────────┐              │
│  │    tools/index.ts   │     │  prompts/index.ts   │              │
│  │     18 MCP Tools    │     │    7 MCP Prompts    │              │
│  └──────────┬──────────┘     └─────────────────────┘              │
│             │                                                       │
│  ┌──────────▼──────────────────────────────────────────────────┐   │
│  │                         lib/                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │   │
│  │  │LocalProjectStore│  │LaTeXOnlineClient│  │  LogParser   │ │   │
│  │  │  (File System)  │  │ (Compilation)   │  │(Error Parse) │ │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘ │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │   │
│  │  │OpenInOverleafCl.│  │   CTANClient    │                   │   │
│  │  │  (URL Generate) │  │ (Package Search)│                   │   │
│  │  └─────────────────┘  └─────────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
│   Local Files   │ │LaTeX.Onln│ │     CTAN API    │
│  projects/      │ │(Compile) │ │ (Pkg Search)    │
│  cache/         │ │   FREE   │ │     FREE        │
└─────────────────┘ └───────────┘ └─────────────────┘
```

## Directory Structure

```
overleaf-mcp-server/
├── index.ts              # Server entry, resource definitions
├── lib/                  # Core business logic
│   ├── types.ts          # TypeScript interfaces (inc. ChatGPT types)
│   ├── LocalProjectStore.ts  # File system + search operations
│   ├── LaTeXOnlineClient.ts  # Cloud compilation
│   ├── LogParser.ts      # Log parsing & validation
│   ├── OpenInOverleafClient.ts # URL generation
│   ├── CTANClient.ts     # CTAN package API
│   └── index.ts          # Barrel exports
├── tools/
│   └── index.ts          # All 18 MCP tool definitions
├── prompts/
│   └── index.ts          # All 7 MCP prompt definitions
├── projects/             # User project storage (gitignored)
├── cache/                # Cached PDFs and logs (gitignored)
└── dist/                 # Compiled JavaScript (gitignored)
```

## Core Modules

### LocalProjectStore

Handles all file system operations for projects.

```typescript
// Key methods:
createProject(name, template?)  // Create new project
listProjects()                  // Enumerate all projects
readFile(project, path)         // Read file content
writeFile(project, path, content)
searchContent(query, limit?)    // ChatGPT Deep Research search
createTarball(project)          // For LaTeX.Online
createZip(project)              // For Open in Overleaf
savePdfToCache(project, pdf)    // Cache compiled PDFs
```

### LaTeXOnlineClient

Handles compilation via LaTeX.Online API.

```typescript
// Compilation methods:
compileText(content)            // Single file compilation
compileProject(project, root?)  // Main file compilation
```

### LogParser

Extracts structured data from LaTeX logs.

```typescript
// Parsing methods:
parseLog(logContent)            // Full log analysis
quickValidate(content)          // Fast syntax check
```

### OpenInOverleafClient

Generates "Open in Overleaf" URLs.

```typescript
// URL generation methods:
generateFromContent(content)    // Base64 single file
generateFromProject(project)    // Base64 ZIP
generateFromUrl(texUrl)         // Remote URL reference
generateFromMultipleUrls(files) // Multiple remote files
```

### CTANClient

Searches and retrieves package information.

```typescript
// CTAN API methods:
searchPackages(query, limit?)   // Search packages
getPackageInfo(name)            // Get package details
```

## Data Flow

### ChatGPT Deep Research Flow

```
1. ChatGPT calls `search` tool with query
2. LocalProjectStore.searchContent() scans all projects
3. Results returned in OpenAI format (JSON in text content)
4. ChatGPT calls `fetch` tool with document ID
5. Full document content returned with metadata
6. ChatGPT uses content for research/analysis
```

### Compilation Flow

```
1. User calls latex_compile tool
2. LocalProjectStore reads main file content
3. LaTeXOnlineClient.compileText() sends to API
4. Response parsed (PDF or log)
5. Results cached locally
6. Structured result returned to user
```

### Open in Overleaf Flow

```
1. User calls latex_open_in_overleaf tool
2. LocalProjectStore.createZip() packages project
3. OpenInOverleafClient.generateFromProject() creates URL
4. Base64-encoded ZIP embedded in URL
5. User can click URL to import into Overleaf
```

## External Services

| Service | URL | Rate Limits | Data Sent |
|---------|-----|-------------|-----------|
| LaTeX.Online | latexonline.cc | None (public) | LaTeX source |
| CTAN API | ctan.org/json/2.0 | None | Search queries only |
| Overleaf | overleaf.com/docs | None | Via generated URL |

## Security Considerations

1. **Local Storage**: All projects stored locally, never uploaded without user action
2. **Privacy Modes**: Configurable privacy settings (ask/allow/local)
3. **Size Warnings**: Warns before uploading large projects
4. **No Credentials**: No API keys or authentication required
5. **ChatGPT Connectors**: Data only sent when explicitly using search/fetch tools
