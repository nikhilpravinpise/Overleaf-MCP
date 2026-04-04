// Vercel guard endpoint: this repository's MCP server must run as a persistent process.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  res.status(501).json({
    status: 'unsupported_deployment',
    message: 'This Vercel function does not run the MCP transport in this repository.',
    action: 'Deploy overleaf-mcp-server as a persistent Node service (Railway, Render, Fly.io) and use /mcp as your ChatGPT connector URL.',
    docs: {
      deployment: '/README-DEPLOYMENT.md',
      server: '/overleaf-mcp-server/README.md'
    }
  });
};
