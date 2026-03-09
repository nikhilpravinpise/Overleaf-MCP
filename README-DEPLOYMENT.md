# 🚀 Overleaf-MCP Deployment Guide

## ⚠️ Important: Vercel Doesn't Work
The mcp-use framework requires persistent connections and is **incompatible with Vercel serverless functions**.

## ✅ Working Deployment Options

### Option 1: Railway (Recommended)
1. Go to [railway.app](https://railway.app)
2. Click "Deploy from GitHub repo"
3. Select: `N1KH1LT0X1N/Overleaf-MCP`
4. Railway will auto-detect and deploy
5. Get your URL: `https://your-app.up.railway.app`

### Option 2: Render
1. Go to [render.com](https://render.com)
2. Click "New + Web Service"
3. Connect GitHub repo: `N1KH1LT0X1N/Overleaf-MCP`
4. Settings:
   - **Build Command:** `cd overleaf-mcp-server && npm run build`
   - **Start Command:** `cd overleaf-mcp-server && npm start`
   - **Health Check:** `/mcp`

### Option 3: Local Test with Ngrok
```bash
# Terminal 1
cd overleaf-mcp-server
npm start

# Terminal 2  
ngrok http 3000
```

## 🔗 ChatGPT Configuration
Once deployed:
- **Connector URL:** `https://your-domain.com/sse`
- **Tools:** Enable all 19 tools
- **Authentication:** None

## 📊 What You Get
- ✅ 19 MCP Tools (LaTeX operations)
- ✅ 7 MCP Prompts (AI assistance)
- ✅ 6 MCP Resources (project data)
- ✅ 100% Free (no API costs)
- ✅ ChatGPT Deep Research compatible
