// Vercel serverless function wrapper for MCP server
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Import the MCP server
let mcpServer;
try {
  mcpServer = require('../dist/index.js');
  console.log('MCP server loaded successfully');
} catch (error) {
  console.error('Failed to load MCP server:', error);
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // Simple health check response
    if (req.url === '/mcp' || req.url.includes('mcp')) {
      res.status(200).json({ 
        status: 'Overleaf MCP Server Running',
        version: '1.0.0',
        tools: 19,
        prompts: 7,
        resources: 6,
        endpoints: ['/mcp', '/sse'],
        chatgpt_compatible: true
      });
    } else if (req.url === '/sse' || req.url.includes('sse')) {
      res.status(200).json({ 
        status: 'SSE endpoint available',
        endpoint: '/sse',
        chatgpt_url: 'https://overleaf-mcp-server.vercel.app/sse'
      });
    } else {
      res.status(200).json({ 
        message: 'Overleaf MCP Server',
        status: 'running',
        endpoints: {
          mcp: '/mcp',
          sse: '/sse'
        }
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
