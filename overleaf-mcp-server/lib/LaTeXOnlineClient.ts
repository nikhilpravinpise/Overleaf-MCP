import type { CompileResult, CompileEngine } from "./types.js";
import { projectStore } from "./LocalProjectStore.js";
import { parseLog } from "./LogParser.js";

// ============================================
// LaTeX.Online Client
// ============================================

const LATEX_ONLINE_BASE = "https://latexonline.cc";
const DEFAULT_TIMEOUT = 60000;

interface CompileOptions {
    engine?: CompileEngine;
    force?: boolean;
    timeout?: number;
}

export class LaTeXOnlineClient {
    private baseUrl: string;
    private defaultTimeout: number;

    constructor(baseUrl?: string, timeout?: number) {
        this.baseUrl = baseUrl || LATEX_ONLINE_BASE;
        this.defaultTimeout = timeout || DEFAULT_TIMEOUT;
    }

    // === Compile from Text ===

    async compileText(
        content: string,
        options: CompileOptions = {}
    ): Promise<CompileResult> {
        const startTime = Date.now();
        
        try {
            // Validate input
            if (!content || typeof content !== 'string') {
                throw new Error('Content is required and must be a string');
            }
            if (content.trim().length === 0) {
                throw new Error('Content cannot be empty');
            }
            if (content.length > 1024 * 1024) {
                throw new Error('Content too large (max 1MB)');
            }
            
            // Validate options
            const engine = options.engine || "pdflatex";
            if (!["pdflatex", "xelatex", "lualatex"].includes(engine)) {
                throw new Error(`Invalid engine: ${engine}. Must be pdflatex, xelatex, or lualatex`);
            }
            
            const timeout = options.timeout || this.defaultTimeout;
            if (timeout <= 0 || timeout > 300000) {
                throw new Error('Timeout must be between 1ms and 5 minutes');
            }

            const params = new URLSearchParams({
                text: content.trim(),
                command: engine,
            });

            if (options.force) {
                params.set("force", "true");
            }

            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/compile?${params.toString()}`,
                { method: "GET" },
                timeout
            );

            return await this.handleResponse(response, startTime);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                errors: [
                    {
                        line: 0,
                        message: errorMessage,
                        type: "other",
                    },
                ],
                warnings: [],
                duration: Date.now() - startTime,
            };
        }
    }

    // === Compile from Project (Tarball) ===

    async compileProject(
        projectName: string,
        rootFile?: string,
        options: CompileOptions = {}
    ): Promise<CompileResult> {
        const startTime = Date.now();

        try {
            // Validate project name
            if (!projectName || typeof projectName !== 'string' || projectName.trim().length === 0) {
                throw new Error('Project name is required and must be a non-empty string');
            }
            
            // Validate root file if provided
            if (rootFile && (typeof rootFile !== 'string' || rootFile.trim().length === 0)) {
                throw new Error('Root file must be a non-empty string if provided');
            }
            
            // Validate options
            const engine = options.engine || "pdflatex";
            if (!["pdflatex", "xelatex", "lualatex"].includes(engine)) {
                throw new Error(`Invalid engine: ${engine}. Must be pdflatex, xelatex, or lualatex`);
            }

            // Determine target file
            const target = rootFile?.trim() || (await projectStore.findMainFile(projectName)) || "main.tex";

            // Read the main file content
            const content = await projectStore.readFile(projectName, target);

            // Use text-based compilation (simpler, no FormData issues)
            // Note: This doesn't include images/bibliography. For full projects,
            // users should use latex_open_in_overleaf to compile in Overleaf.
            const result = await this.compileText(content, options);

            // Cache results
            if (result.success && result.pdfBase64) {
                const pdfBuffer = Buffer.from(result.pdfBase64, "base64");
                result.pdfPath = await projectStore.savePdfToCache(projectName, pdfBuffer);
            }

            // Always cache the log for later analysis
            if (result.rawLog) {
                await projectStore.saveLogToCache(projectName, result.rawLog);
            }

            return result;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorResult: CompileResult = {
                success: false,
                errors: [
                    {
                        line: 0,
                        message: errorMessage,
                        type: "other",
                    },
                ],
                warnings: [],
                duration: Date.now() - startTime,
            };

            return errorResult;
        }
    }

    // === Compile from URL ===

    async compileUrl(
        texUrl: string,
        options: CompileOptions = {}
    ): Promise<CompileResult> {
        const startTime = Date.now();
        
        try {
            // Validate URL
            if (!texUrl || typeof texUrl !== 'string' || texUrl.trim().length === 0) {
                throw new Error('URL is required and must be a non-empty string');
            }
            
            // Validate URL format
            let url: URL;
            try {
                url = new URL(texUrl.trim());
            } catch {
                throw new Error('Invalid URL format');
            }
            
            // Only allow http/https protocols
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Only HTTP and HTTPS URLs are allowed');
            }
            
            // Validate options
            const engine = options.engine || "pdflatex";
            if (!["pdflatex", "xelatex", "lualatex"].includes(engine)) {
                throw new Error(`Invalid engine: ${engine}. Must be pdflatex, xelatex, or lualatex`);
            }
            
            const timeout = options.timeout || this.defaultTimeout;
            if (timeout <= 0 || timeout > 300000) {
                throw new Error('Timeout must be between 1ms and 5 minutes');
            }

            const params = new URLSearchParams({
                url: url.toString(),
                command: engine,
            });

            if (options.force) {
                params.set("force", "true");
            }

            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/compile?${params.toString()}`,
                { method: "GET" },
                timeout
            );

            return this.handleResponse(response, startTime);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                errors: [
                    {
                        line: 0,
                        message: errorMessage,
                        type: "other",
                    },
                ],
                warnings: [],
                duration: Date.now() - startTime,
            };
        }
    }

    // === Response Handler ===

    private async handleResponse(
        response: Response,
        startTime: number
    ): Promise<CompileResult> {
        const duration = Date.now() - startTime;

        try {
            if (response.ok) {
                // Success - PDF returned
                const contentType = response.headers.get("content-type");

                if (contentType?.includes("application/pdf")) {
                    const pdfBuffer = await response.arrayBuffer();
                    
                    // Validate PDF size
                    if (pdfBuffer.byteLength === 0) {
                        throw new Error('Received empty PDF');
                    }
                    
                    if (pdfBuffer.byteLength > 10 * 1024 * 1024) {
                        throw new Error('PDF too large (max 10MB)');
                    }
                    
                    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

                    return {
                        success: true,
                        pdfBase64,
                        errors: [],
                        warnings: [],
                        duration,
                    };
                }
            }

            // Failure or unexpected content type - parse as log
            const logText = await response.text();
            
            // Validate log size
            if (logText.length > 1024 * 1024) {
                throw new Error('Compilation log too large');
            }
            
            const parsed = parseLog(logText);

            return {
                success: false,
                errors: parsed.errors,
                warnings: parsed.warnings,
                rawLog: logText,
                duration,
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                errors: [
                    {
                        line: 0,
                        message: `Response handling failed: ${errorMessage}`,
                        type: "other",
                    },
                ],
                warnings: [],
                duration,
            };
        }
    }

    // === Timeout Helper ===

    private async fetchWithTimeout(
        url: string,
        options: RequestInit,
        timeout: number
    ): Promise<Response> {
        // Validate inputs
        if (!url || typeof url !== 'string') {
            throw new Error('URL is required and must be a string');
        }
        
        if (timeout <= 0 || timeout > 300000) {
            throw new Error('Timeout must be between 1ms and 5 minutes');
        }
        
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Overleaf-MCP-Server/1.0',
                    'Accept': 'application/pdf, text/plain, */*',
                    ...options.headers,
                },
            });
            
            return response;
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        } finally {
            clearTimeout(id);
        }
    }
}

// Export singleton
export const latexOnline = new LaTeXOnlineClient();
