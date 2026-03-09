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
│  │     19 MCP Tools    │     │    7 MCP Prompts    │              │
│  └──────────┬──────────┘     └─────────────────────┘              │
│             │                                                       │
│  ┌──────────▼──────────────────────────────────────────────────┐   │
│  │                         lib/                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │   │
│  │  │LocalProjectStore│  │LaTeXOnlineClient│  │  LogParser   │ │   │
│  │  │  (File System)  │  │ (Compilation)   │  │(Error Parse) │ │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘ │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │   │
│  │  │OpenInOverleafCl.│  │   CTANClient    │  │  middleware   │ │   │
│  │  │  (URL Generate) │  │ (Package Search)│  │(Rate/Auth/Log)│ │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘ │   │
│  │  ┌──────────────────────────────────────────────────────────┐│   │
│  │  │                    lib/oauth/                             ││   │
│  │  │  config │ types │ handlers │ jwt │ pkce │ store │ mw     ││   │
│  │  │            OAuth 2.1 Authentication Flow                 ││   │
│  │  └──────────────────────────────────────────────────────────┘│   │
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
├── index.ts              # Server entry, resource definitions, OAuth routes
├── lib/                  # Core business logic
│   ├── types.ts          # TypeScript interfaces (inc. ChatGPT types)
│   ├── LocalProjectStore.ts  # File system + search operations (path-safe)
│   ├── LaTeXOnlineClient.ts  # Cloud compilation + log caching
│   ├── LogParser.ts      # Log parsing & validation
│   ├── OpenInOverleafClient.ts # URL generation (with size checks)
│   ├── CTANClient.ts     # CTAN package API (bounded cache)
│   ├── middleware.ts      # Rate limiting, auth, logging, health
│   ├── index.ts          # Barrel exports
│   └── oauth/            # OAuth 2.1 module
│       ├── config.ts     # Environment-based config
│       ├── types.ts      # OAuth type definitions
│       ├── handlers.ts   # HTTP endpoint handlers (XSS-safe)
│       ├── jwt.ts        # JWT generation & validation
│       ├── pkce.ts       # PKCE utilities
│       ├── store.ts      # Persistent storage (scrypt passwords)
│       ├── middleware.ts  # Bearer token validation
│       └── index.ts      # Barrel exports
├── tools/
│   └── index.ts          # All 19 MCP tool definitions
├── prompts/
│   └── index.ts          # All 7 MCP prompt definitions
├── projects/             # User project storage (gitignored)
├── cache/                # Cached PDFs and logs (gitignored)
└── dist/                 # Compiled JavaScript (gitignored)
```

## Core Modules

### LocalProjectStore

Handles all file system operations with path traversal protection.

```typescript
// Key methods:
createProject(name, template?)  // Create new project (name validated)
listProjects()                  // Enumerate all projects
readFile(project, path)         // Read file content (path-safe)
writeFile(project, path, content)
searchContent(query, limit?)    // ChatGPT Deep Research search (ReDoS-safe)
createTarball(project)          // For LaTeX.Online
createZip(project)              // For Open in Overleaf
savePdfToCache(project, pdf)    // Cache compiled PDFs
saveLogToCache(project, log)    // Cache compilation logs
```

### LaTeXOnlineClient

Handles compilation via LaTeX.Online API with log caching.

```typescript
// Compilation methods:
compileText(content)            // Single file compilation
compileProject(project, root?)  // Main file compilation + log caching
```

### LogParser

Extracts structured data from LaTeX logs (no duplicate error reporting).

```typescript
// Parsing methods:
parseLog(logContent)            // Full log analysis
quickValidate(content)          // Fast syntax check (comment-aware)
```

### OAuth 2.1 Module

Full OAuth 2.1 implementation for ChatGPT App integration.

```typescript
// OAuth flow:
handleMetadata()                // RFC 8414 discovery
handleClientRegistration(body)  // RFC 7591 dynamic registration
handleAuthorizeGet(params)      // Consent page (XSS-safe)
handleAuthorizePost(body)       // Login + authorization
handleToken(body)               // Token exchange (PKCE)
handleRevoke(body)              // RFC 7009 revocation
```

### Middleware

Production-ready middleware for rate limiting, auth, logging, and health.

```typescript
checkRateLimit(ip)              // Per-IP rate limiting
validateApiKey(header)          // API key authentication
logger.info/warn/error()        // Structured logging
getHealthStatus()               // Server health check
```

## Security

1. **Path Traversal Protection**: All file paths validated against project directory
2. **Project Name Validation**: Regex-enforced alphanumeric names
3. **XSS Prevention**: HTML-escaped OAuth consent/error pages
4. **ReDoS Prevention**: User search queries are regex-escaped
5. **Scrypt Password Hashing**: User passwords hashed with scrypt + random salt
6. **PKCE**: Authorization code flow uses S256 code challenges
7. **Size Limits**: ZIP upload and content size checks
8. **Local Storage**: Projects stored locally, never uploaded without user action
9. **ChatGPT Connectors**: Data only sent when explicitly using search/fetch tools
