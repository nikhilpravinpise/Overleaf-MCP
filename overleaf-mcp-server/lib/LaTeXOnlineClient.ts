import type { CompileResult, CompileEngine, CompileError, CompileWarning } from "./types.js";
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
        const engine = options.engine || "pdflatex";

        const params = new URLSearchParams({
            text: content,
            command: engine,
        });

        if (options.force) {
            params.set("force", "true");
        }

        try {
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/compile?${params.toString()}`,
                { method: "GET" },
                options.timeout || this.defaultTimeout
            );

            return this.handleResponse(response, startTime);
        } catch (error: any) {
            return {
                success: false,
                errors: [
                    {
                        line: 0,
                        message: error.message || "Compilation failed",
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
        const engine = options.engine || "pdflatex";

        try {
            // Determine target file
            const target = rootFile || (await projectStore.findMainFile(projectName)) || "main.tex";

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

            return result;
        } catch (error: any) {
            const errorResult: CompileResult = {
                success: false,
                errors: [
                    {
                        line: 0,
                        message: error.message || "Compilation failed",
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
        const engine = options.engine || "pdflatex";

        const params = new URLSearchParams({
            url: texUrl,
            command: engine,
        });

        if (options.force) {
            params.set("force", "true");
        }

        try {
            const response = await this.fetchWithTimeout(
                `${this.baseUrl}/compile?${params.toString()}`,
                { method: "GET" },
                options.timeout || this.defaultTimeout
            );

            return this.handleResponse(response, startTime);
        } catch (error: any) {
            return {
                success: false,
                errors: [
                    {
                        line: 0,
                        message: error.message || "Compilation failed",
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

        if (response.ok) {
            // Success - PDF returned
            const contentType = response.headers.get("content-type");

            if (contentType?.includes("application/pdf")) {
                const pdfBuffer = await response.arrayBuffer();
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

        // Failure - Log returned
        const logText = await response.text();
        const parsed = parseLog(logText);

        return {
            success: false,
            errors: parsed.errors,
            warnings: parsed.warnings,
            duration,
        };
    }

    // === Timeout Helper ===

    private async fetchWithTimeout(
        url: string,
        options: RequestInit,
        timeout: number
    ): Promise<Response> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            return response;
        } finally {
            clearTimeout(id);
        }
    }
}

// Export singleton
export const latexOnline = new LaTeXOnlineClient();
