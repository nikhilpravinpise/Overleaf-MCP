import { z } from "zod";
import type { MCPServer } from "mcp-use/server";
import {
    projectStore,
    latexOnline,
    openInOverleaf,
    ctanClient,
    parseLog,
    quickValidate,
    getHealthStatus,
    checkRateLimit,
    logger,
} from "../lib/index.js";

// ============================================
// Register All Tools (19 total)
// ============================================

export function registerTools(server: MCPServer) {
    // === Health & Monitoring ===

    server.tool({
        name: "health_check",
        description: "Get server health status for monitoring. Returns uptime, memory usage, and system checks.",
        schema: z.object({}),
        annotations: { readOnlyHint: true },
    }, async () => {
        const health = getHealthStatus();
        logger.info("Health check requested", { status: health.status });
        return {
            content: [{
                type: "text",
                text: JSON.stringify(health, null, 2),
            }],
        };
    });

    // === Project Management ===

    server.tool({
        name: "latex_create_project",
        description: "Create a new LaTeX project",
        schema: z.object({
            name: z.string().describe("Project name"),
            template: z.string().optional().describe("Initial template content"),
        }),
    }, async ({ name, template }) => {
        const project = await projectStore.createProject(name, template);
        return {
            content: [{ type: "text", text: `Created project "${project.name}" at ${project.path}` }],
        };
    });

    server.tool({
        name: "latex_list_projects",
        description: "List all LaTeX projects",
        schema: z.object({}),
        annotations: { readOnlyHint: true },
    }, async () => {
        const projects = await projectStore.listProjects();
        return {
            content: [{
                type: "text",
                text: projects.length > 0
                    ? projects.map((p) => `• ${p.name} (${p.fileCount} files, main: ${p.mainFile || "unknown"})`).join("\n")
                    : "No projects found. Create one with latex_create_project.",
            }],
        };
    });

    server.tool({
        name: "latex_delete_project",
        description: "Delete a LaTeX project",
        schema: z.object({
            name: z.string().describe("Project name"),
        }),
        annotations: { destructiveHint: true },
    }, async ({ name }) => {
        await projectStore.deleteProject(name);
        return { content: [{ type: "text", text: `Deleted project "${name}"` }] };
    });

    server.tool({
        name: "latex_project_status",
        description: "Get detailed status of a project",
        schema: z.object({
            name: z.string().describe("Project name"),
        }),
        annotations: { readOnlyHint: true },
    }, async ({ name }) => {
        const status = await projectStore.getProjectStatus(name);
        return {
            content: [{
                type: "text",
                text: `Project: ${status.project.name}
Files: ${status.files.length} total (${status.texFiles.length} .tex)
Main file: ${status.project.mainFile || "not detected"}
Has images: ${status.hasImages ? "Yes" : "No"}
Has bibliography: ${status.hasBibliography ? "Yes" : "No"}
Last modified: ${status.project.lastModified.toISOString()}`,
            }],
        };
    });

    // === File Operations ===

    server.tool({
        name: "latex_list_files",
        description: "List files in a project",
        schema: z.object({
            project: z.string().describe("Project name"),
            path: z.string().optional().describe("Subdirectory path"),
        }),
        annotations: { readOnlyHint: true },
    }, async ({ project, path }) => {
        const files = await projectStore.listFiles(project, path);
        return {
            content: [{
                type: "text",
                text: files.map((f) => f.isDirectory ? `📁 ${f.path}/` : `📄 ${f.path} (${Math.round(f.size / 1024)}KB)`).join("\n"),
            }],
        };
    });

    server.tool({
        name: "latex_read_file",
        description: "Read content of a file",
        schema: z.object({
            project: z.string().describe("Project name"),
            path: z.string().describe("File path relative to project root"),
        }),
        annotations: { readOnlyHint: true },
    }, async ({ project, path }) => {
        const content = await projectStore.readFile(project, path);
        return { content: [{ type: "text", text: content }] };
    });

    server.tool({
        name: "latex_write_file",
        description: "Write content to a file",
        schema: z.object({
            project: z.string().describe("Project name"),
            path: z.string().describe("File path relative to project root"),
            content: z.string().describe("File content"),
        }),
    }, async ({ project, path, content }) => {
        await projectStore.writeFile(project, path, content);
        return { content: [{ type: "text", text: `Written ${content.length} bytes to ${path}` }] };
    });

    server.tool({
        name: "latex_delete_file",
        description: "Delete a file from a project",
        schema: z.object({
            project: z.string().describe("Project name"),
            path: z.string().describe("File path relative to project root"),
        }),
        annotations: { destructiveHint: true },
    }, async ({ project, path }) => {
        await projectStore.deleteFile(project, path);
        return { content: [{ type: "text", text: `Deleted ${path}` }] };
    });

    // === Compilation ===

    server.tool({
        name: "latex_compile",
        description: "Compile a LaTeX project to PDF using LaTeX.Online",
        schema: z.object({
            project: z.string().describe("Project name"),
            engine: z.enum(["pdflatex", "xelatex", "lualatex"]).optional().describe("LaTeX engine"),
            rootFile: z.string().optional().describe("Main file to compile"),
        }),
    }, async ({ project, engine, rootFile }) => {
        const result = await latexOnline.compileProject(project, rootFile, { engine });
        if (result.success) {
            return {
                content: [{ type: "text", text: `✅ Compilation successful (${result.duration}ms)\nPDF saved to: ${result.pdfPath}` }],
            };
        } else {
            const errorText = result.errors.map((e) => `Line ${e.line}: ${e.message}`).join("\n");
            return {
                content: [{ type: "text", text: `❌ Compilation failed (${result.duration}ms)\n\nErrors:\n${errorText || "Unknown error"}` }],
            };
        }
    });

    server.tool({
        name: "latex_analyze_log",
        description: "Analyze the last compilation log",
        schema: z.object({
            name: z.string().describe("Project name"),
        }),
    }, async ({ name }) => {
        const log = await projectStore.getCachedLog(name);
        if (!log) {
            return { content: [{ type: "text", text: "No compilation log found. Run latex_compile first." }] };
        }
        const parsed = parseLog(log);
        let output = parsed.summary + "\n\n";
        if (parsed.errors.length > 0) {
            output += "ERRORS:\n" + parsed.errors.map((e) => `  Line ${e.line}: ${e.message}`).join("\n") + "\n\n";
        }
        if (parsed.warnings.length > 0) {
            output += "WARNINGS:\n" + parsed.warnings.map((w) => `  ${w.line ? `Line ${w.line}: ` : ""}${w.message}`).join("\n");
        }
        return { content: [{ type: "text", text: output }] };
    });

    // === Open in Overleaf ===

    server.tool({
        name: "latex_open_in_overleaf",
        description: "Generate a URL to open the project in Overleaf",
        schema: z.object({
            project: z.string().describe("Project name"),
            engine: z.enum(["pdflatex", "xelatex", "lualatex"]).optional(),
            mainDocument: z.string().optional(),
            visualEditor: z.boolean().optional(),
        }),
    }, async ({ project, engine, mainDocument, visualEditor }) => {
        const url = await openInOverleaf.generateFromProject(project, { engine, mainDocument, visualEditor });
        return {
            content: [{ type: "text", text: `🚀 Open in Overleaf:\n${url}\n\nNote: This creates a NEW project in Overleaf from your local files.` }],
        };
    });

    server.tool({
        name: "latex_export_zip",
        description: "Export project as a ZIP file (base64)",
        schema: z.object({
            name: z.string().describe("Project name"),
        }),
    }, async ({ name }) => {
        const zipBuffer = await projectStore.createZip(name);
        const base64 = zipBuffer.toString("base64");
        return {
            content: [{ type: "text", text: `ZIP created (${Math.round(zipBuffer.length / 1024)}KB)\n\nBase64 (first 100 chars): ${base64.substring(0, 100)}...` }],
        };
    });

    // === Validation & Utilities ===

    server.tool({
        name: "latex_validate",
        description: "Validate LaTeX content for common issues",
        schema: z.object({
            content: z.string().describe("LaTeX content to validate"),
        }),
    }, async ({ content }) => {
        const result = quickValidate(content);
        if (result.valid) {
            return { content: [{ type: "text", text: "✅ No obvious issues found." }] };
        } else {
            return { content: [{ type: "text", text: `⚠️ Issues found:\n${result.issues.map((i) => `• ${i}`).join("\n")}` }] };
        }
    });

    server.tool({
        name: "latex_search_packages",
        description: "Search CTAN for LaTeX packages",
        schema: z.object({
            query: z.string().describe("Search query"),
        }),
    }, async ({ query }) => {
        const result = await ctanClient.searchPackages(query);
        if (result.packages.length === 0) {
            return { content: [{ type: "text", text: `No packages found for "${query}"` }] };
        }
        const list = result.packages.map((p) => `• ${p.name}: ${p.caption}`).join("\n");
        return { content: [{ type: "text", text: `Found ${result.total} packages for "${query}":\n\n${list}` }] };
    });

    server.tool({
        name: "latex_get_package_info",
        description: "Get detailed info about a LaTeX package",
        schema: z.object({
            name: z.string().describe("Package name"),
        }),
    }, async ({ name }) => {
        const pkg = await ctanClient.getPackageInfo(name);
        if (!pkg) {
            return { content: [{ type: "text", text: `Package "${name}" not found on CTAN.` }] };
        }
        return {
            content: [{
                type: "text",
                text: `Package: ${pkg.name}\nCaption: ${pkg.caption}\nVersion: ${pkg.version || "unknown"}\nLicense: ${pkg.license || "unknown"}\n\nDescription:\n${pkg.description || "No description available."}\n\nDocumentation: ${pkg.documentationUrl || "Not available"}`,
            }],
        };
    });

    server.tool({
        name: "latex_get_symbol",
        description: "Find LaTeX code for a symbol by description",
        schema: z.object({
            description: z.string().describe("Description of the symbol"),
        }),
    }, async ({ description }) => {
        const symbols: Record<string, string> = {
            alpha: "\\alpha", beta: "\\beta", gamma: "\\gamma", delta: "\\delta",
            infinity: "\\infty", sum: "\\sum", integral: "\\int",
            "partial derivative": "\\partial", "square root": "\\sqrt{}",
            fraction: "\\frac{}{}", "not equal": "\\neq",
            "less than or equal": "\\leq", "greater than or equal": "\\geq",
            arrow: "\\rightarrow", "double arrow": "\\Rightarrow", "left arrow": "\\leftarrow",
            times: "\\times", divide: "\\div", plusminus: "\\pm",
            degree: "^\\circ", copyright: "\\copyright", trademark: "\\texttrademark",
        };
        const searchLower = description.toLowerCase();
        const matches = Object.entries(symbols)
            .filter(([key]) => key.includes(searchLower) || searchLower.includes(key))
            .map(([name, code]) => `${name}: ${code}`);
        if (matches.length === 0) {
            return { content: [{ type: "text", text: `No symbol found for "${description}". Try: alpha, beta, sum, integral, arrow, etc.` }] };
        }
        return { content: [{ type: "text", text: `Symbols matching "${description}":\n\n${matches.join("\n")}` }] };
    });

    // ======================================
    // ChatGPT Connectors / Deep Research
    // ======================================

    /**
     * SEARCH - Required by ChatGPT Connectors and Deep Research
     * Returns results in OpenAI's specified format
     */
    server.tool({
        name: "search",
        description: "Search across all LaTeX projects and files. Returns matching documents for ChatGPT Deep Research.",
        schema: z.object({
            query: z.string().describe("Search query string"),
        }),
        annotations: {
            readOnlyHint: true,
        },
    }, async ({ query }) => {
        const results = await projectStore.searchContent(query);

        // Format results per OpenAI spec
        const formattedResults = results.map(r => ({
            id: `${r.project}:${r.filePath}`,
            title: `${r.fileName} (${r.project})`,
            url: `latex://${r.project}/${r.filePath}`,
            text: r.snippet,
        }));

        // Return in OpenAI's required format: JSON-encoded string in text content
        return {
            content: [{
                type: "text",
                text: JSON.stringify({ results: formattedResults }),
            }],
        };
    });

    /**
     * FETCH - Required by ChatGPT Connectors and Deep Research
     * Returns full document content in OpenAI's specified format
     */
    server.tool({
        name: "fetch",
        description: "Retrieve full content of a LaTeX document by ID. Use after search to get complete document for analysis.",
        schema: z.object({
            id: z.string().describe("Document ID in format 'projectName:filePath' (from search results)"),
        }),
        annotations: {
            readOnlyHint: true,
        },
    }, async ({ id }) => {
        // Parse ID format: projectName:filePath
        const colonIndex = id.indexOf(":");
        if (colonIndex === -1) {
            throw new Error(`Invalid ID format. Expected 'projectName:filePath', got: ${id}`);
        }

        const projectName = id.substring(0, colonIndex);
        const filePath = id.substring(colonIndex + 1);

        // Read file content
        const content = await projectStore.readFile(projectName, filePath);
        const fileName = filePath.split("/").pop() || filePath;

        // Get project info for metadata
        const project = await projectStore.getProject(projectName);

        // Format result per OpenAI spec
        const result = {
            id,
            title: `${fileName} (${projectName})`,
            text: content,
            url: `latex://${projectName}/${filePath}`,
            metadata: {
                project: projectName,
                filePath,
                fileCount: project.fileCount,
                mainFile: project.mainFile,
                lastModified: project.lastModified.toISOString(),
            },
        };

        // Return in OpenAI's required format: JSON-encoded string in text content
        return {
            content: [{
                type: "text",
                text: JSON.stringify(result),
            }],
        };
    });
}

