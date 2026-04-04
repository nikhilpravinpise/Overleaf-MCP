import { z } from "zod";
import type { MCPServer } from "mcp-use/server";
import { widget, text } from "mcp-use/server";
import {
    projectStore,
    latexOnline,
    openInOverleaf,
    ctanClient,
    parseLog,
    quickValidate,
    getHealthStatus,
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
            project: z.string().describe("Project name"),
            template: z.string().optional().describe("Initial template content"),
        }),
    }, async ({ project, template }) => {
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            const created = await projectStore.createProject(project.trim(), template);
            return {
                content: [{ type: "text", text: `✅ Created project "${created.name}" at ${created.path}` }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to create project: ${errorMessage}` }],
            };
        }
    });

    server.tool({
        name: "latex_list_projects",
        description: "List all LaTeX projects",
        schema: z.object({}),
        annotations: { readOnlyHint: true },
    }, async () => {
        try {
            const projects = await projectStore.listProjects();
            return {
                content: [{
                    type: "text",
                    text: projects.length > 0
                        ? projects.map((p) => `• ${p.name} (${p.fileCount} files, main: ${p.mainFile || "unknown"})`).join("\n")
                        : "No projects found. Create one with latex_create_project.",
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to list projects: ${errorMessage}` }],
            };
        }
    });

    server.tool({
        name: "latex_delete_project",
        description: "Delete a LaTeX project",
        schema: z.object({
            project: z.string().describe("Project name"),
        }),
        annotations: { destructiveHint: true },
    }, async ({ project }) => {
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            await projectStore.deleteProject(project.trim());
            return { content: [{ type: "text", text: `✅ Deleted project "${project}"` }] };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to delete project: ${errorMessage}` }],
            };
        }
    });

    server.tool({
        name: "latex_project_status",
        description: "Get detailed status of a project",
        schema: z.object({
            project: z.string().describe("Project name"),
        }),
        annotations: { readOnlyHint: true },
        widget: {
            name: "project-browser",
            invoking: "Loading project...",
            invoked: "Project loaded",
        },
    }, async ({ project }) => {
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            const status = await projectStore.getProjectStatus(project.trim());
            
            // Return widget with project status
            return widget({
                props: {
                    projectName: status.project.name,
                    path: status.project.path,
                    createdAt: status.project.createdAt.toISOString(),
                    lastModified: status.project.lastModified.toISOString(),
                    mainFile: status.project.mainFile,
                    fileCount: status.project.fileCount,
                    files: status.files,
                    texFiles: status.texFiles,
                    hasImages: status.hasImages,
                    hasBibliography: status.hasBibliography,
                },
                output: text(`📊 Project: ${status.project.name} (${status.files.length} files)`),
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to get project status: ${errorMessage}` }],
            };
        }
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
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            const files = await projectStore.listFiles(project.trim(), path);
            return {
                content: [{
                    type: "text",
                    text: files.map((f) => f.isDirectory ? `📁 ${f.path}/` : `📄 ${f.path} (${Math.round(f.size / 1024)}KB)`).join("\n"),
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to list files: ${errorMessage}` }],
            };
        }
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
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            if (!path || typeof path !== 'string' || path.trim().length === 0) {
                throw new Error('File path is required and must be a non-empty string');
            }
            const content = await projectStore.readFile(project.trim(), path.trim());
            return { content: [{ type: "text", text: content }] };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to read file: ${errorMessage}` }],
            };
        }
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
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            if (!path || typeof path !== 'string' || path.trim().length === 0) {
                throw new Error('File path is required and must be a non-empty string');
            }
            if (content === undefined || content === null) {
                throw new Error('File content is required');
            }
            await projectStore.writeFile(project.trim(), path.trim(), content);
            return { content: [{ type: "text", text: `✅ Written ${content.length} bytes to ${path}` }] };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to write file: ${errorMessage}` }],
            };
        }
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
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            if (!path || typeof path !== 'string' || path.trim().length === 0) {
                throw new Error('File path is required and must be a non-empty string');
            }
            await projectStore.deleteFile(project.trim(), path.trim());
            return { content: [{ type: "text", text: `✅ Deleted ${path}` }] };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to delete file: ${errorMessage}` }],
            };
        }
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
        widget: {
            name: "latex-pdf-viewer",
            invoking: "Compiling LaTeX document...",
            invoked: "Compilation complete",
        },
    }, async ({ project, engine, rootFile }) => {
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            const result = await latexOnline.compileProject(project.trim(), rootFile, { engine });
            
            // Return widget with compilation results
            return widget({
                props: {
                    projectName: project.trim(),
                    mainFile: rootFile || result.pdfPath || "main.tex",
                    success: result.success,
                    pdfBase64: result.pdfBase64,
                    errors: result.errors,
                    warnings: result.warnings,
                    duration: result.duration,
                    engine: engine || "pdflatex",
                },
                output: text(result.success 
                    ? `✅ Compilation successful (${result.duration}ms)`
                    : `❌ Compilation failed with ${result.errors.length} error(s)`
                ),
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return widget({
                props: {
                    projectName: project,
                    mainFile: rootFile || "main.tex",
                    success: false,
                    errors: [{ line: 0, message: errorMessage, type: "other" as const }],
                    warnings: [],
                    duration: 0,
                    engine: engine || "pdflatex",
                },
                output: text(`❌ Compilation error: ${errorMessage}`),
            });
        }
    });

    server.tool({
        name: "latex_analyze_log",
        description: "Analyze the last compilation log",
        schema: z.object({
            project: z.string().describe("Project name"),
        }),
        widget: {
            name: "compile-status",
            invoking: "Analyzing log...",
            invoked: "Analysis complete",
        },
    }, async ({ project }) => {
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            const log = await projectStore.getCachedLog(project.trim());
            if (!log) {
                return { content: [{ type: "text", text: "ℹ️ No compilation log found. Run latex_compile first." }] };
            }
            const parsed = parseLog(log);
            
            // Return widget with log analysis
            return widget({
                props: {
                    projectName: project.trim(),
                    success: parsed.errors.length === 0,
                    errors: parsed.errors,
                    warnings: parsed.warnings,
                    summary: parsed.summary,
                    rawLog: log,
                },
                output: text(`📋 ${parsed.summary}`),
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to analyze log: ${errorMessage}` }],
            };
        }
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
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            const url = await openInOverleaf.generateFromProject(project.trim(), { engine, mainDocument, visualEditor });
            return {
                content: [{ type: "text", text: `🚀 Open in Overleaf:\n${url}\n\nℹ️ Note: This creates a NEW project in Overleaf from your local files.` }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to generate Overleaf URL: ${errorMessage}` }],
            };
        }
    });

    server.tool({
        name: "latex_export_zip",
        description: "Export project as a ZIP file (base64)",
        schema: z.object({
            project: z.string().describe("Project name"),
        }),
    }, async ({ project }) => {
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            const zipBuffer = await projectStore.createZip(project.trim());
            const base64 = zipBuffer.toString("base64");
            return {
                content: [{ type: "text", text: `📦 ZIP created (${Math.round(zipBuffer.length / 1024)}KB)\n\n🔐 Base64 (first 100 chars): ${base64.substring(0, 100)}...` }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to create ZIP: ${errorMessage}` }],
            };
        }
    });

    // === Validation & Utilities ===

    server.tool({
        name: "latex_validate",
        description: "Validate LaTeX content for common issues",
        schema: z.object({
            content: z.string().describe("LaTeX content to validate"),
        }),
    }, async ({ content }) => {
        try {
            if (!content || typeof content !== 'string') {
                throw new Error('Content is required and must be a string');
            }
            const result = quickValidate(content);
            if (result.valid) {
                return { content: [{ type: "text", text: "✅ No obvious issues found." }] };
            } else {
                return { content: [{ type: "text", text: `⚠️ Issues found:\n${result.issues.map((i) => `• ${i}`).join("\n")}` }] };
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Validation error: ${errorMessage}` }],
            };
        }
    });

    server.tool({
        name: "latex_search_packages",
        description: "Search CTAN for LaTeX packages",
        schema: z.object({
            query: z.string().describe("Search query"),
        }),
    }, async ({ query }) => {
        try {
            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                throw new Error('Search query is required and must be a non-empty string');
            }
            const result = await ctanClient.searchPackages(query.trim());
            if (result.packages.length === 0) {
                return { content: [{ type: "text", text: `❌ No packages found for "${query}"` }] };
            }
            const list = result.packages.map((p) => `• ${p.name}: ${p.caption}`).join("\n");
            return { content: [{ type: "text", text: `🔍 Found ${result.total} packages for "${query}":\n\n${list}` }] };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Package search error: ${errorMessage}` }],
            };
        }
    });

    server.tool({
        name: "latex_get_package_info",
        description: "Get detailed info about a LaTeX package",
        schema: z.object({
            packageName: z.string().describe("Package name"),
        }),
    }, async ({ packageName }) => {
        try {
            if (!packageName || typeof packageName !== 'string' || packageName.trim().length === 0) {
                throw new Error('Package name is required and must be a non-empty string');
            }
            const pkg = await ctanClient.getPackageInfo(packageName.trim());
            if (!pkg) {
                return { content: [{ type: "text", text: `❌ Package "${packageName}" not found on CTAN.` }] };
            }
            return {
                content: [{
                    type: "text",
                    text: `📦 Package: ${pkg.name}\n📝 Caption: ${pkg.caption}\n🏷️ Version: ${pkg.version || "unknown"}\n⚖️ License: ${pkg.license || "unknown"}\n\n📄 Description:\n${pkg.description || "No description available."}\n\n📚 Documentation: ${pkg.documentationUrl || "Not available"}`,
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to get package info: ${errorMessage}` }],
            };
        }
    });

    server.tool({
        name: "latex_get_symbol",
        description: "Find LaTeX code for a symbol by description",
        schema: z.object({
            description: z.string().describe("Description of the symbol"),
        }),
    }, async ({ description }) => {
        try {
            if (!description || typeof description !== 'string' || description.trim().length === 0) {
                throw new Error('Symbol description is required and must be a non-empty string');
            }
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
            const searchLower = description.toLowerCase().trim();
            const matches = Object.entries(symbols)
                .filter(([key]) => key.includes(searchLower) || searchLower.includes(key))
                .map(([name, code]) => `${name}: ${code}`);
            if (matches.length === 0) {
                return { content: [{ type: "text", text: `❌ No symbol found for "${description}". Try: alpha, beta, sum, integral, arrow, etc.` }] };
            }
            return { content: [{ type: "text", text: `🔣 Symbols matching "${description}":\n\n${matches.join("\n")}` }] };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Symbol search error: ${errorMessage}` }],
            };
        }
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
        try {
            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                throw new Error('Search query is required and must be a non-empty string');
            }
            const results = await projectStore.searchContent(query.trim());

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
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Search error: ${errorMessage}` }],
            };
        }
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
        try {
            if (!id || typeof id !== 'string' || id.trim().length === 0) {
                throw new Error('Document ID is required and must be a non-empty string');
            }
            // Parse ID format: projectName:filePath
            const colonIndex = id.indexOf(":");
            if (colonIndex === -1) {
                throw new Error(`Invalid ID format. Expected 'projectName:filePath', got: ${id}`);
            }

            const projectName = id.substring(0, colonIndex).trim();
            const filePath = id.substring(colonIndex + 1).trim();

            if (projectName.length === 0 || filePath.length === 0) {
                throw new Error('Both project name and file path must be non-empty');
            }

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
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Fetch error: ${errorMessage}` }],
            };
        }
    });
}

