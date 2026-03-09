// Simple test endpoint for Vercel
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
    console.log('Request received:', req.method, req.url);
    
    // Simple test response
    res.status(200).json({ 
      status: 'Overleaf MCP Server',
      message: 'Server is running on Vercel',
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      chatgpt_ready: true,
      endpoints: {
        mcp: '/mcp',
        sse: '/sse'
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
