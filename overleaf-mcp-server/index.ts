/**
 * @fileoverview Overleaf MCP Server - Main Entry Point
 * 
 * This is the main server file that:
 * - Initializes the MCP server with mcp-use
 * - Registers all 19 tools, 7 prompts, and 6 resources
 * - Starts listening for MCP connections
 * 
 * @module index
 * @see {@link https://mcp-use.com} for mcp-use documentation
 * @see {@link https://modelcontextprotocol.io} for MCP specification
 */

import { MCPServer } from "mcp-use/server";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import {
    projectStore,
    startRateLimitCleanup,
    checkRateLimit,
    validateApiKey,
    logRequest,
    securityHeaders,
    prodConfig,
} from "./lib/index.js";

// ============================================
// Server Configuration
// ============================================

/**
 * Create the MCP server instance with metadata.
 * 
 * Environment Variables:
 * - BASE_URL: Optional base URL for the server
 * - PORT: Server port (default: 3000)
 */
const server = new MCPServer({
    name: "overleaf-mcp-server",
    version: "1.0.0",
    description: "LaTeX project management with compilation via LaTeX.Online and Open in Overleaf integration",
    baseUrl: process.env.BASE_URL,
});

// === Register Tools ===
registerTools(server);

// === Register Prompts ===
registerPrompts(server);

// === Register Resources ===

server.resource({
    uri: "latex://projects",
    name: "projects",
    description: "List of all LaTeX projects",
    mimeType: "application/json",
}, async () => {
    try {
        const projects = await projectStore.listProjects();
        return {
            contents: [{
                uri: "latex://projects",
                mimeType: "application/json",
                text: JSON.stringify(projects, null, 2),
            }],
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            contents: [{
                uri: "latex://projects",
                mimeType: "text/plain",
                text: `Error fetching projects: ${errorMessage}`,
            }],
        };
    }
});

server.resource({
    uri: "latex://cheatsheet",
    name: "cheatsheet",
    description: "LaTeX quick reference",
    mimeType: "text/markdown",
}, async () => {
    const cheatsheet = `# LaTeX Quick Reference

## Document Structure
\\documentclass[options]{class}  - article, report, book, beamer
\\usepackage{package}            - Load package
\\begin{document} ... \\end{document}

## Text Formatting
\\textbf{bold}  \\textit{italic}  \\underline{underline}
\\tiny \\small \\normalsize \\large \\Large \\LARGE \\huge \\Huge

## Sections
\\section{} \\subsection{} \\subsubsection{}
\\chapter{} (report/book)  \\part{}

## Math
$inline$  $$display$$  \\[ display \\]
\\frac{a}{b}  \\sqrt{x}  x^{2}  x_{i}
\\sum_{i=1}^{n}  \\int_{a}^{b}

## Common Packages
amsmath, graphicx, hyperref, geometry, booktabs, tikz, biblatex
`;
    return {
        contents: [{
            uri: "latex://cheatsheet",
            mimeType: "text/markdown",
            text: cheatsheet,
        }],
    };
});

server.resource({
    uri: "latex://symbols",
    name: "symbols",
    description: "LaTeX symbol reference",
    mimeType: "application/json",
}, async () => {
    const symbols = {
        greek: { alpha: "\\alpha", beta: "\\beta", gamma: "\\gamma", delta: "\\delta", pi: "\\pi", sigma: "\\sigma", omega: "\\omega" },
        math: { infinity: "\\infty", sum: "\\sum", integral: "\\int", partial: "\\partial", sqrt: "\\sqrt{}", fraction: "\\frac{}{}" },
        relations: { notEqual: "\\neq", lessThanOrEqual: "\\leq", greaterThanOrEqual: "\\geq", approximately: "\\approx" },
        arrows: { rightArrow: "\\rightarrow", leftArrow: "\\leftarrow", doubleRightArrow: "\\Rightarrow" },
    };
    return {
        contents: [{
            uri: "latex://symbols",
            mimeType: "application/json",
            text: JSON.stringify(symbols, null, 2),
        }],
    };
});

// Resource templates for project files
server.resourceTemplate({
    uriTemplate: "latex://project/{name}",
    name: "project",
    description: "Project metadata",
    mimeType: "application/json",
}, async (uri: URL, { name }: Record<string, unknown>) => {
    try {
        if (!name || typeof name !== 'string') {
            throw new Error('Project name is required and must be a string');
        }
        const project = await projectStore.getProject(name);
        return {
            contents: [{
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify(project, null, 2),
            }],
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${errorMessage}` }],
        };
    }
});

server.resourceTemplate({
    uriTemplate: "latex://project/{name}/file/{+path}",
    name: "project-file",
    description: "File content",
    mimeType: "text/x-tex",
}, async (uri: URL, { name, path }: Record<string, unknown>) => {
    try {
        if (!name || typeof name !== 'string') {
            throw new Error('Project name is required and must be a string');
        }
        if (!path || typeof path !== 'string') {
            throw new Error('File path is required and must be a string');
        }
        const content = await projectStore.readFile(name, path);
        return {
            contents: [{ uri: uri.href, mimeType: "text/x-tex", text: content }],
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${errorMessage}` }],
        };
    }
});


server.resourceTemplate({
    uriTemplate: "latex://project/{name}/log",
    name: "project-log",
    description: "Last compilation log",
    mimeType: "text/plain",
}, async (uri: URL, { name }: Record<string, unknown>) => {
    try {
        if (!name || typeof name !== 'string') {
            throw new Error('Project name is required and must be a string');
        }
        const log = await projectStore.getCachedLog(name);
        return {
            contents: [{ uri: uri.href, mimeType: "text/plain", text: log || "No compilation log available." }],
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error fetching log: ${errorMessage}` }],
        };
    }
});

// === Ensure directories exist ===
try {
    await projectStore.ensureDirectories();
    console.log("✓ Directories initialized");
} catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("❌ Failed to initialize directories:", errorMessage);
    if (error instanceof Error && error.stack) {
        console.error("Stack trace:", error.stack);
    }
    process.exit(1);
}

// === Initialize OAuth if enabled ===
import { oauthConfig } from "./lib/oauth/config.js";
import {
    initializeStore,
    handleMetadata,
    handleClientRegistration,
    handleAuthorizeGet,
    handleAuthorizePost,
    handleToken,
    handleRevoke,
} from "./lib/oauth/index.js";
import { validateBearerToken, hasScope } from "./lib/oauth/middleware.js";

if (oauthConfig.enabled) {
    try {
        await initializeStore();
        // Start lazy cleanup timers for OAuth store
        const { startCleanupTimer } = await import('./lib/oauth/store.js');
        startCleanupTimer();
        console.log("🔐 OAuth 2.1 enabled");
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error("❌ Failed to initialize OAuth:", errorMessage);
        if (error instanceof Error && error.stack) {
            console.error("Stack trace:", error.stack);
        }
        process.exit(1);
    }
}

// Start rate limit cleanup timer
startRateLimitCleanup();

// Mount core security middleware on the underlying HTTP app if available.
if ((server as any).app) {
    const app = (server as any).app;

    if (typeof app.use !== 'function') {
        console.warn('⚠️ Underlying app does not expose middleware hooks; skipping runtime middleware wiring');
    } else {

        // Only trust proxy headers when explicitly enabled.
        if (typeof app.set === 'function') {
            app.set('trust proxy', process.env.TRUST_PROXY === 'true');
        }

        app.use(async (a: any, b: any, c: any) => {
            const start = Date.now();
            const isHonoStyle = typeof b === 'function' && typeof c === 'undefined' && a?.req;

            if (isHonoStyle) {
                const ctx = a;
                const next = b;
                const path = String(ctx.req?.path || '');
                const method = String(ctx.req?.method || 'GET');
                const authHeader = ctx.req?.header?.('authorization') || null;
                const clientIp = ctx.req?.header?.('x-forwarded-for') || ctx.req?.header?.('x-real-ip') || 'unknown';

                for (const [key, value] of Object.entries(securityHeaders)) {
                    ctx.header(key, value);
                }

                if (!validateApiKey(authHeader)) {
                    return ctx.json({ error: 'unauthorized', error_description: 'Invalid API key' }, 401);
                }

                const rate = checkRateLimit(clientIp);
                ctx.header('X-RateLimit-Limit', String(prodConfig.rateLimit));
                ctx.header('X-RateLimit-Remaining', String(rate.remaining));
                ctx.header('X-RateLimit-Reset', String(Math.ceil(rate.resetIn / 1000)));
                if (!rate.allowed) {
                    return ctx.json({ error: 'rate_limited', error_description: 'Too many requests' }, 429);
                }

                if (oauthConfig.enabled && (path === '/mcp' || path === '/sse')) {
                    const oauthContext = await validateBearerToken(authHeader);
                    if (!oauthContext) {
                        return ctx.json({ error: 'invalid_token', error_description: 'Bearer token required' }, 401);
                    }
                    ctx.set('oauthContext', oauthContext);

                    if (path === '/mcp' && method === 'POST') {
                        let requestBody: any;
                        try {
                            requestBody = await ctx.req.raw.clone().json();
                        } catch {
                            requestBody = undefined;
                        }

                        if (requestBody?.method === 'tools/call') {
                            const toolName = String(requestBody?.params?.name || '');
                            let requiredScope: 'read' | 'write' | 'admin' = 'read';

                            if (toolName === 'latex_delete_project' || toolName === 'latex_delete_file') {
                                requiredScope = 'admin';
                            } else if (
                                toolName === 'latex_create_project' ||
                                toolName === 'latex_write_file' ||
                                toolName === 'latex_compile' ||
                                toolName === 'latex_open_in_overleaf' ||
                                toolName === 'latex_export_zip'
                            ) {
                                requiredScope = 'write';
                            }

                            if (!hasScope(oauthContext, requiredScope)) {
                                return ctx.json({
                                    error: 'insufficient_scope',
                                    error_description: `Tool ${toolName} requires ${requiredScope} scope`,
                                }, 403);
                            }
                        }
                    }
                }

                const result = await next();
                logRequest({
                    timestamp: new Date().toISOString(),
                    method,
                    path,
                    ip: clientIp,
                    userAgent: ctx.req?.header?.('user-agent') || '',
                    statusCode: ctx.res?.status,
                    duration: Date.now() - start,
                });
                return result;
            }

            const req = a;
            const res = b;
            const next = c;

            for (const [key, value] of Object.entries(securityHeaders)) {
                if (typeof res.setHeader === 'function') {
                    res.setHeader(key, value);
                }
            }

            const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : null;
            if (!validateApiKey(authHeader)) {
                res.status(401).json({ error: 'unauthorized', error_description: 'Invalid API key' });
                return;
            }

            const clientIp = typeof req.ip === 'string'
                ? req.ip
                : (typeof req.socket?.remoteAddress === 'string' ? req.socket.remoteAddress : 'unknown');
            const rate = checkRateLimit(clientIp);
            if (typeof res.setHeader === 'function') {
                res.setHeader('X-RateLimit-Limit', String(prodConfig.rateLimit));
                res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
                res.setHeader('X-RateLimit-Reset', String(Math.ceil(rate.resetIn / 1000)));
            }

            if (!rate.allowed) {
                res.status(429).json({ error: 'rate_limited', error_description: 'Too many requests' });
                return;
            }

            if (oauthConfig.enabled && (req.path === '/mcp' || req.path === '/sse')) {
                const oauthContext = await validateBearerToken(authHeader);
                if (!oauthContext) {
                    res.status(401).json({ error: 'invalid_token', error_description: 'Bearer token required' });
                    return;
                }
                req.oauthContext = oauthContext;

                if (req.path === '/mcp' && req.method === 'POST' && req.body?.method === 'tools/call') {
                    const toolName = String(req.body?.params?.name || '');
                    let requiredScope: 'read' | 'write' | 'admin' = 'read';

                    if (toolName === 'latex_delete_project' || toolName === 'latex_delete_file') {
                        requiredScope = 'admin';
                    } else if (
                        toolName === 'latex_create_project' ||
                        toolName === 'latex_write_file' ||
                        toolName === 'latex_compile' ||
                        toolName === 'latex_open_in_overleaf' ||
                        toolName === 'latex_export_zip'
                    ) {
                        requiredScope = 'write';
                    }

                    if (!hasScope(oauthContext, requiredScope)) {
                        res.status(403).json({
                            error: 'insufficient_scope',
                            error_description: `Tool ${toolName} requires ${requiredScope} scope`,
                        });
                        return;
                    }
                }
            }

            if (typeof res.on === 'function') {
                res.on('finish', () => {
                    logRequest({
                        timestamp: new Date().toISOString(),
                        method: req.method,
                        path: req.originalUrl || req.url,
                        ip: clientIp,
                        userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : '',
                        statusCode: res.statusCode,
                        duration: Date.now() - start,
                    });
                });
            }

            next();
        });
    }
}

// === Mount OAuth HTTP Endpoints ===
// These endpoints implement the OAuth 2.1 flow required for ChatGPT App integration

if (oauthConfig.enabled && (server as any).app) {
    const app = (server as any).app;

    // Add security middleware for OAuth endpoints
    app.use('/.well-known/oauth-authorization-server', (_req: any, res: any, next: any) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    });

    app.use('/register', (_req: any, res: any, next: any) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    });

    // RFC 8414 - Authorization Server Metadata Discovery
    app.get('/.well-known/oauth-authorization-server', (_req: any, res: any) => {
        res.json(handleMetadata());
    });

    // RFC 7591 - Dynamic Client Registration
    app.post('/register', async (req: any, res: any) => {
        try {
            const result = await handleClientRegistration(req.body);
            res.status(201).json(result);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            const statusCode = error.message.includes('invalid_client') ? 400 : 400;
            res.status(statusCode).json({ 
                error: 'invalid_request', 
                error_description: error.message 
            });
        }
    });

    // Authorization Endpoint (GET renders consent page, POST processes login)
    app.get('/authorize', (req: any, res: any) => {
        const html = handleAuthorizeGet(req.query);
        res.type('html').send(html);
    });

    app.post('/authorize', async (req: any, res: any) => {
        try {
            const result = await handleAuthorizePost(req.body);
            if ('redirectUrl' in result) {
                res.redirect(result.redirectUrl);
            } else {
                res.type('html').send(result.html);
            }
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            res.status(500).json({ 
                error: 'server_error', 
                error_description: error.message 
            });
        }
    });

    // Token Endpoint
    app.post('/token', async (req: any, res: any) => {
        try {
            const result = await handleToken(req.body);
            res.json(result);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            const status = error.message.includes('invalid_client') ? 401 : 400;
            res.status(status).json({ 
                error: error.message.includes('invalid_client') ? 'invalid_client' : 'invalid_request', 
                error_description: error.message 
            });
        }
    });

    // Revocation Endpoint (RFC 7009)
    app.post('/revoke', async (req: any, res: any) => {
        try {
            await handleRevoke(req.body);
            res.status(200).end();
        } catch (err: unknown) {
            // RFC 7009 says revocation always returns 200
            console.error('Token revocation error:', err instanceof Error ? err.message : err);
            res.status(200).end();
        }
    });

    console.log("   OAuth endpoints: /.well-known/oauth-authorization-server, /authorize, /token, /register, /revoke");
}

// === Start Server ===
try {
    server.listen();
    console.log("🚀 Overleaf MCP Server started");
    console.log("   Tools: 19 registered");
    console.log("   Resources: 6 registered");
    console.log("   Prompts: 7 registered");
    console.log(`   OAuth: ${oauthConfig.enabled ? 'ENABLED' : 'disabled'}`);
    console.log(`   Port: ${process.env.PORT || 3000}`);
    console.log(`   Base URL: ${process.env.BASE_URL || 'http://localhost:3000'}`);
} catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("❌ Failed to start server:", errorMessage);
    if (error instanceof Error && error.stack) {
        console.error("Stack trace:", error.stack);
    }
    process.exit(1);
}

// === Graceful Shutdown ===
const gracefulShutdown = (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    // Add cleanup logic here if needed
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    console.error('❌ Uncaught Exception:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
