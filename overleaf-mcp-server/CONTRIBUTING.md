# Contributing to Overleaf MCP Server

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/N1KH1LT0X1N/Overleaf-MCP.git
cd Overleaf-MCP/overleaf-mcp-server

# Install dependencies
npm install

# Start development server
npm run dev
```

## Project Structure

```
overleaf-mcp-server/
├── lib/          # Core business logic
├── tools/        # MCP tool definitions
├── prompts/      # MCP prompt definitions
├── index.ts      # Server entry point
└── dist/         # Compiled output (generated)
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- **Adding a Tool**: Edit `tools/index.ts`
- **Adding a Prompt**: Edit `prompts/index.ts`
- **Adding a Resource**: Edit `index.ts`
- **Core Logic**: Add to or modify files in `lib/`

### 3. Type Check

```bash
npx tsc --noEmit
```

### 4. Build

```bash
npm run build
```

### 5. Test Locally

```bash
npm run dev

# In another terminal, use MCP Inspector:
# Visit http://localhost:3000/inspector
```

## Code Style

### TypeScript

- Use TypeScript with proper type annotations
- Add JSDoc comments to all exported functions and interfaces
- Use Zod for runtime validation

### Example Tool Definition

```typescript
server.tool({
  name: "tool_name",
  description: "Clear description of what this tool does",
  schema: z.object({
    param1: z.string().describe("What this parameter is for"),
    param2: z.number().optional().describe("Optional parameter"),
  }),
  annotations: {
    readOnlyHint: true,      // Doesn't modify state
    destructiveHint: false,  // Doesn't delete data
    idempotentHint: true,    // Same result on repeat calls
  },
}, async ({ param1, param2 }) => {
  // Implementation
  return {
    content: [{ type: "text", text: "Result" }],
  };
});
```

### JSDoc Guidelines

```typescript
/**
 * Short description of what this does.
 * 
 * Longer description if needed, explaining behavior,
 * edge cases, and usage patterns.
 * 
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 * @example
 * ```typescript
 * const result = await myFunction("input");
 * console.log(result);
 * ```
 */
```

## Adding Features

### New Tool Checklist

- [ ] Add tool definition in `tools/index.ts`
- [ ] Use descriptive `name` with `latex_` prefix
- [ ] Write clear `description`
- [ ] Define schema with `.describe()` on all fields
- [ ] Add appropriate `annotations`
- [ ] Update README.md tool table
- [ ] Update count in startup message

### New Prompt Checklist

- [ ] Add prompt definition in `prompts/index.ts`
- [ ] Use Zod schema for parameters
- [ ] Structure messages for optimal LLM response
- [ ] Update README.md prompt list

## Commit Messages

Use conventional commits:

```
feat: add latex_diff tool for comparing versions
fix: handle empty projects in listProjects
docs: update API reference in README
refactor: extract tarball creation to separate function
chore: update dependencies
```

## Pull Request Process

1. Ensure your code builds (`npm run build`)
2. Update documentation if needed
3. Describe your changes in the PR description
4. Link any related issues

## Questions?

Open an issue with your question and we'll help!
