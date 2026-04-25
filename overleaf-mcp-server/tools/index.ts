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
    createOverleafGitClient,
    createOverleafWebApiClient,
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
        description: "Create a new LaTeX project with a default template. Use this when a user wants to start a new document, paper, thesis, or presentation. The project will be created with a basic main.tex file that can be customized.",
        schema: z.object({
            project: z.string().describe("Project name - use a descriptive name like 'research-paper-2024' or 'my-thesis'"),
            template: z.string().optional().describe("Optional custom LaTeX content to initialize main.tex. If not provided, a default template will be used."),
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
        description: "List all available LaTeX projects. Use this to show users what projects exist before performing operations on them. Returns project names, file counts, and main file information.",
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
        description: "Get detailed status and metadata of a LaTeX project including file list, structure, and statistics. Displays an interactive project browser widget showing all files, sizes, and allows viewing file contents. Use this to understand project structure before making changes.",
        schema: z.object({
            project: z.string().describe("Project name to get status for"),
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
        description: "Write or update content to a file in a LaTeX project. Use this to create new files or modify existing ones. Common use cases: adding sections, updating bibliography, fixing errors, or creating new chapters. Always check if the file exists first if unsure.",
        schema: z.object({
            project: z.string().describe("Project name where the file should be written"),
            path: z.string().describe("File path relative to project root (e.g., 'main.tex', 'chapters/intro.tex', 'references.bib')"),
            content: z.string().describe("File content - the full LaTeX code or text to write"),
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
        description: "Compile a LaTeX project to PDF using the free LaTeX.Online service. Use this after making changes to verify the document compiles correctly. Supports pdflatex (default), xelatex (for Unicode/fonts), and lualatex. Returns compilation status, errors, warnings, and a PDF preview widget.",
        schema: z.object({
            project: z.string().describe("Project name to compile"),
            engine: z.enum(["pdflatex", "xelatex", "lualatex"]).optional().describe("LaTeX engine: pdflatex (default, fastest), xelatex (better for Unicode and fonts), or lualatex (modern engine)"),
            rootFile: z.string().optional().describe("Main file to compile (e.g., 'main.tex'). If not specified, uses the project's default main file"),
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

    // === Import Tools (for editing existing Overleaf projects) ===

    server.tool({
        name: "latex_import_from_content",
        description: "Import LaTeX content as a new project. Use this when you want to edit an existing document from Overleaf - copy the content from Overleaf and paste it here to start editing with AI. This is the easiest way to edit your resume or other documents.",
        schema: z.object({
            project: z.string().describe("Project name to create (e.g., 'my-resume-2024')"),
            content: z.string().describe("LaTeX content copied from Overleaf - paste the full main.tex content here"),
        }),
    }, async ({ project, content }) => {
        try {
            if (!project || typeof project !== 'string' || project.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                throw new Error('LaTeX content is required and must be a non-empty string');
            }
            
            // Create project with the content as main.tex
            await projectStore.createProject(project.trim(), content.trim());
            return {
                content: [{ 
                    type: "text", 
                    text: `✅ Imported content as project "${project}"\n\nYou can now edit this project using AI tools. When done, use latex_export_zip to download and re-upload to Overleaf.` 
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Failed to import content: ${errorMessage}` }],
            };
        }
    });

    // === Overleaf Git Integration (Seamless Sync) ===

    server.tool({
        name: "latex_clone_from_overleaf",
        description: "Clone an Overleaf project using Git integration for seamless bidirectional sync. This automatically fetches your project from Overleaf without manual copy-paste. Requires Overleaf Git token (set OVERLEAF_GIT_TOKEN environment variable or provide token parameter).",
        schema: z.object({
            projectId: z.string().describe("Overleaf project ID (the number in the URL, e.g., '1234567' from https://www.overleaf.com/project/1234567)"),
            token: z.string().optional().describe("Overleaf Git authentication token (from Account Settings). If not provided, uses OVERLEAF_GIT_TOKEN environment variable."),
            projectName: z.string().optional().describe("Custom local project name. If not provided, uses 'overleaf-{projectId}'"),
        }),
    }, async ({ projectId, token, projectName }) => {
        try {
            if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
                throw new Error('Project ID is required and must be a non-empty string');
            }
            
            const gitClient = createOverleafGitClient(projectId.trim(), token, projectName);
            const result = await gitClient.clone();
            
            if (result.success) {
                return {
                    content: [{ 
                        type: "text", 
                        text: `✅ Successfully cloned Overleaf project ${projectId}\n\nLocal project: ${gitClient.getProjectName()}\n\nYou can now edit this project using AI tools. When done, use latex_push_to_overleaf to sync changes back.` 
                    }],
                };
            } else {
                return {
                    content: [{ type: "text", text: `❌ Failed to clone: ${result.error}` }],
                };
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Clone error: ${errorMessage}\n\nMake sure you have set OVERLEAF_GIT_TOKEN environment variable or provided a valid token.` }],
            };
        }
    });

    server.tool({
        name: "latex_pull_from_overleaf",
        description: "Pull latest changes from Overleaf for a cloned project. Use this to sync changes made directly in Overleaf back to the local MCP server.",
        schema: z.object({
            projectName: z.string().describe("Local project name (e.g., 'overleaf-1234567' or your custom name)"),
            projectId: z.string().optional().describe("Overleaf project ID (required if not using OVERLEAF_GIT_TOKEN)"),
            token: z.string().optional().describe("Overleaf Git authentication token"),
        }),
    }, async ({ projectName, projectId, token }) => {
        try {
            if (!projectName || typeof projectName !== 'string' || projectName.trim().length === 0) {
                throw new Error('Project name is required');
            }
            
            // Extract project ID from name if not provided (format: overleaf-{projectId})
            const extractedProjectId = projectId || projectName.replace('overleaf-', '');
            const gitClient = createOverleafGitClient(extractedProjectId, token, projectName);
            
            const result = await gitClient.pull();
            
            if (result.success) {
                return {
                    content: [{ type: "text", text: `✅ Successfully pulled latest changes from Overleaf` }],
                };
            } else {
                return {
                    content: [{ type: "text", text: `❌ Failed to pull: ${result.error}` }],
                };
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Pull error: ${errorMessage}` }],
            };
        }
    });

    server.tool({
        name: "latex_push_to_overleaf",
        description: "Push local changes back to Overleaf. This syncs your AI-edited resume back to Overleaf seamlessly without manual copy-paste. Automatically commits and pushes all changes.",
        schema: z.object({
            projectName: z.string().describe("Local project name to push (e.g., 'overleaf-1234567')"),
            projectId: z.string().optional().describe("Overleaf project ID (required if not using OVERLEAF_GIT_TOKEN)"),
            token: z.string().optional().describe("Overleaf Git authentication token"),
            commitMessage: z.string().optional().describe("Custom commit message (default: 'Update from MCP server')"),
        }),
    }, async ({ projectName, projectId, token, commitMessage }) => {
        try {
            if (!projectName || typeof projectName !== 'string' || projectName.trim().length === 0) {
                throw new Error('Project name is required');
            }
            
            // Extract project ID from name if not provided
            const extractedProjectId = projectId || projectName.replace('overleaf-', '');
            const gitClient = createOverleafGitClient(extractedProjectId, token, projectName);
            
            const result = await gitClient.push(commitMessage);
            
            if (result.success) {
                const message = result.error 
                    ? `✅ No changes to push - project is already up to date`
                    : `✅ Successfully pushed changes to Overleaf`;
                return {
                    content: [{ type: "text", text: message }],
                };
            } else {
                return {
                    content: [{ type: "text", text: `❌ Failed to push: ${result.error}` }],
                };
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Push error: ${errorMessage}` }],
            };
        }
    });

    // === Overleaf Web API (Browser Cookies - No Git Integration Required) ===

    server.tool({
        name: "latex_download_from_overleaf",
        description: "Download an Overleaf project using session cookies (no Git integration required). Fully automatic after one-time authentication. If authentication fails, run: npm run authenticate-overleaf",
        schema: z.object({
            projectId: z.string().describe("Overleaf project ID (the number/ID in the URL, e.g., '6974d2a430815c0cd444e68d' from https://www.overleaf.com/project/6974d2a430815c0cd444e68d)"),
            projectName: z.string().optional().describe("Custom local project name. If not provided, uses 'overleaf-{projectId}'"),
        }),
    }, async ({ projectId, projectName }) => {
        try {
            if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
                throw new Error('Project ID is required and must be a non-empty string');
            }
            
            const client = createOverleafWebApiClient();
            
            // Authenticate (loads from file automatically)
            const authResult = await client.authenticate();
            if (!authResult.success) {
                return {
                    content: [{ type: "text", text: `❌ Authentication failed: ${authResult.error}` }],
                };
            }
            
            // Download and extract project
            const result = await client.downloadAndExtractProject(projectId.trim(), projectName);
            
            if (result.success) {
                const projectNameUsed = projectName || `overleaf-${projectId}`;
                return {
                    content: [{ 
                        type: "text", 
                        text: `✅ Successfully downloaded Overleaf project ${projectId}\n\nLocal project: ${projectNameUsed}\n\nYou can now edit this project using AI tools.\n\nNote: Upload back to Overleaf requires manual file copy for now (automatic upload requires additional API research).` 
                    }],
                };
            } else {
                return {
                    content: [{ type: "text", text: `❌ Failed to download: ${result.error}` }],
                };
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Download error: ${errorMessage}` }],
            };
        }
    });

    server.tool({
        name: "latex_upload_to_overleaf",
        description: "Upload a file back to Overleaf (experimental). Uploads individual files to your Overleaf project using session cookies. Note: This is experimental and may not work with all Overleaf projects.",
        schema: z.object({
            projectId: z.string().describe("Overleaf project ID (e.g., '6974d2a430815c0cd444e68d')"),
            filePath: z.string().describe("Path to the file within the project (e.g., 'main.tex')"),
            content: z.string().describe("Content to upload to the file"),
        }),
    }, async ({ projectId, filePath, content }) => {
        try {
            if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
                throw new Error('Project ID is required and must be a non-empty string');
            }
            
            if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) {
                throw new Error('File path is required and must be a non-empty string');
            }
            
            const client = createOverleafWebApiClient();
            
            // Authenticate (loads from file automatically)
            const authResult = await client.authenticate();
            if (!authResult.success) {
                return {
                    content: [{ type: "text", text: `❌ Authentication failed: ${authResult.error}` }],
                };
            }
            
            // Upload file
            const result = await client.uploadFile(projectId.trim(), filePath.trim(), content);
            
            if (result.success) {
                return {
                    content: [{ 
                        type: "text", 
                        text: `✅ Successfully uploaded ${filePath} to Overleaf project ${projectId}` 
                    }],
                };
            } else {
                return {
                    content: [{ type: "text", text: `❌ Failed to upload: ${result.error}` }],
                };
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: "text", text: `❌ Upload error: ${errorMessage}` }],
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
        description: "Search across all LaTeX projects and searchable files (.tex, .bib, .md, .txt) for content matching the query. This is the primary discovery tool - use it to find relevant documents, sections, bibliography entries, or content before using fetch to get full details. Searches project names, file names, and file contents. Returns results in OpenAI's required format for Deep Research.",
        schema: z.object({
            query: z.string().describe("Search query - use specific terms related to the content you're looking for (e.g., 'machine learning', 'attention mechanism', 'bibliography', 'author name')"),
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
        description: "Retrieve the full content of a LaTeX document by its ID. Always use search first to find relevant documents, then use fetch with the ID from search results to get the complete content. Required for ChatGPT Deep Research to analyze full documents.",
        schema: z.object({
            id: z.string().describe("Document ID in format 'projectName:filePath' (obtained from search results, e.g., 'sample-research-paper:main.tex')"),
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

