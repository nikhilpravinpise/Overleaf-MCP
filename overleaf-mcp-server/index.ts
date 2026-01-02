/**
 * @fileoverview Overleaf MCP Server - Main Entry Point
 * 
 * This is the main server file that:
 * - Initializes the MCP server with mcp-use
 * - Registers all 16 tools, 7 prompts, and 6 resources
 * - Starts listening for MCP connections
 * 
 * @module index
 * @see {@link https://mcp-use.com} for mcp-use documentation
 * @see {@link https://modelcontextprotocol.io} for MCP specification
 */

import { MCPServer } from "mcp-use/server";
import { registerTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import { projectStore } from "./lib/index.js";

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
    const projects = await projectStore.listProjects();
    return {
        contents: [{
            uri: "latex://projects",
            mimeType: "application/json",
            text: JSON.stringify(projects, null, 2),
        }],
    };
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
        const project = await projectStore.getProject(name as string);
        return {
            contents: [{
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify(project, null, 2),
            }],
        };
    } catch (error: any) {
        return {
            contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${error.message}` }],
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
        const content = await projectStore.readFile(name as string, path as string);
        return {
            contents: [{ uri: uri.href, mimeType: "text/x-tex", text: content }],
        };
    } catch (error: any) {
        return {
            contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${error.message}` }],
        };
    }
});


server.resourceTemplate({
    uriTemplate: "latex://project/{name}/log",
    name: "project-log",
    description: "Last compilation log",
    mimeType: "text/plain",
}, async (uri: URL, { name }: Record<string, unknown>) => {
    const log = await projectStore.getCachedLog(name as string);
    return {
        contents: [{ uri: uri.href, mimeType: "text/plain", text: log || "No compilation log available." }],
    };
});

// === Ensure directories exist ===
await projectStore.ensureDirectories();

// === Initialize OAuth if enabled ===
import {
    oauthConfig,
    initializeStore,
    handleMetadata,
    handleClientRegistration,
    handleAuthorizeGet,
    handleAuthorizePost,
    handleToken,
    handleRevoke,
} from "./lib/oauth/index.js";

if (oauthConfig.enabled) {
    await initializeStore();
    console.log("🔐 OAuth 2.1 enabled");
}

// === OAuth Endpoints (registered via server's HTTP layer) ===
// These endpoints are available when accessing the server directly

// Note: mcp-use handles its own HTTP routing. For OAuth endpoints, 
// we export handlers that can be used with the server's HTTP layer.
export {
    handleMetadata as oauthMetadata,
    handleClientRegistration as oauthRegister,
    handleAuthorizeGet as oauthAuthorizeGet,
    handleAuthorizePost as oauthAuthorizePost,
    handleToken as oauthToken,
    handleRevoke as oauthRevoke,
};

// === Start Server ===
server.listen();

console.log("🚀 Overleaf MCP Server started");
console.log("   Tools: 19 registered");
console.log("   Resources: 6 registered");
console.log("   Prompts: 7 registered");
console.log(`   OAuth: ${oauthConfig.enabled ? 'ENABLED' : 'disabled'}`);

