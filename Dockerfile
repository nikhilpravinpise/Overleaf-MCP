# Multi-stage build for Overleaf MCP Server
FROM mirror.gcr.io/library/node:22-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy server directory with its package files
COPY overleaf-mcp-server ./overleaf-mcp-server

# Install dependencies in the server directory
WORKDIR /app/overleaf-mcp-server
RUN npm ci --only=production

# Build the application
RUN npm run build

# Runtime stage
FROM mirror.gcr.io/library/node:22-alpine

WORKDIR /app

# Copy built application and node_modules from builder
COPY --from=builder /app/overleaf-mcp-server/dist ./dist
COPY --from=builder /app/overleaf-mcp-server/node_modules ./node_modules
COPY --from=builder /app/overleaf-mcp-server/package*.json ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/mcp', (res) => process.exit(res.statusCode === 400 ? 0 : 1))" || exit 1

# Start the application
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
