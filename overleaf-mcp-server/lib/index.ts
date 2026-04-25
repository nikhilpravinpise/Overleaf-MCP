// ============================================
// Overleaf MCP Server - Library Exports
// ============================================

// Types
export * from "./types.js";

// Local Project Store
export { LocalProjectStore, projectStore } from "./LocalProjectStore.js";

// LaTeX.Online Compilation
export { LaTeXOnlineClient, latexOnline } from "./LaTeXOnlineClient.js";

// Log Parsing
export { parseLog, quickValidate } from "./LogParser.js";

// Open in Overleaf
export { OpenInOverleafClient, openInOverleaf } from "./OpenInOverleafClient.js";

// Overleaf Git Integration
export { OverleafGitClient, createOverleafGitClient } from "./OverleafGitClient.js";

// Overleaf Web API (Browser Cookies)
export { OverleafWebApiClient, createOverleafWebApiClient } from "./OverleafWebApiClient.js";

// CTAN Package Search
export { CTANClient, ctanClient } from "./CTANClient.js";

// Production Middleware
export {
    prodConfig,
    checkRateLimit,
    validateApiKey,
    logger,
    logRequest,
    getHealthStatus,
    securityHeaders,
    startRateLimitCleanup,
} from "./middleware.js";

