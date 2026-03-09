FROM node:22-alpine

WORKDIR /app

# Copy the overleaf-mcp-server directory contents
COPY overleaf-mcp-server/package*.json ./
RUN npm ci --only=production

# Copy the rest of the application
COPY overleaf-mcp-server/ ./

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the server
CMD ["npm", "start"]
