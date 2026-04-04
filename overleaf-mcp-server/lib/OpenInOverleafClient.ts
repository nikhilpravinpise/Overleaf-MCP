import type { OverleafUrlOptions } from "./types.js";
import { projectStore } from "./LocalProjectStore.js";

// ============================================
// Open in Overleaf Client
// ============================================

const OVERLEAF_DOCS_URL = "https://www.overleaf.com/docs";
const MAX_URL_PAYLOAD_SIZE = 1 * 1024 * 1024;

export class OpenInOverleafClient {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || OVERLEAF_DOCS_URL;
    }

    // === Generate URL from Content ===

    /**
     * Generate URL for a single LaTeX content string
     * Uses encoded_snip for reliable handling of special characters
     */
    generateFromContent(content: string, options: OverleafUrlOptions = {}): string {
        // Input validation
        if (typeof content !== 'string') {
            throw new Error('Content must be a string');
        }
        
        if (content.trim().length === 0) {
            throw new Error('Content cannot be empty');
        }
        
        if (content.length > 1024 * 1024) {
            throw new Error('Content too large (max 1MB)');
        }
        
        // Validate options
        if (options && typeof options !== 'object') {
            throw new Error('Options must be an object');
        }
        
        if (options.engine && !['pdflatex', 'xelatex', 'lualatex'].includes(options.engine)) {
            throw new Error('Invalid engine. Must be pdflatex, xelatex, or lualatex');
        }
        
        if (options.mainDocument && typeof options.mainDocument !== 'string') {
            throw new Error('Main document must be a string');
        }
        
        const params = new URLSearchParams();

        // Use encoded_snip for reliable handling of special characters
        params.set("encoded_snip", encodeURIComponent(content.trim()));

        this.addOptions(params, options);

        return `${this.baseUrl}?${params.toString()}`;
    }

    // === Generate URL from Base64 ===

    /**
     * Generate URL from base64-encoded content
     * Useful when content is already encoded
     */
    generateFromBase64(base64Content: string, options: OverleafUrlOptions = {}): string {
        if (typeof base64Content !== 'string' || base64Content.trim().length === 0) {
            throw new Error('Base64 content must be a non-empty string');
        }
        if (base64Content.length > MAX_URL_PAYLOAD_SIZE * 2) {
            throw new Error('Base64 content too large for URL-based transfer');
        }

        const params = new URLSearchParams();

        // Use data URL format
        const dataUrl = `data:application/x-tex;base64,${base64Content}`;
        params.set("snip_uri", dataUrl);

        this.addOptions(params, options);

        return `${this.baseUrl}?${params.toString()}`;
    }

    // === Generate URL from Project (ZIP) ===

    /**
     * Generate URL for an entire project as a ZIP
     * Best for projects with images, bibliographies, etc.
     */
    async generateFromProject(
        projectName: string,
        options: OverleafUrlOptions = {}
    ): Promise<string> {
        // Create ZIP of project
        const zipBuffer = await projectStore.createZip(projectName);

        // BUG-6: Check ZIP size — URL parameters have limited space
        const MAX_ZIP_SIZE = 1 * 1024 * 1024; // 1MB limit for data URLs
        if (zipBuffer.length > MAX_ZIP_SIZE) {
            throw new Error(
                `Project ZIP is too large (${Math.round(zipBuffer.length / 1024)}KB). ` +
                `Maximum is ${MAX_ZIP_SIZE / 1024}KB for URL-based upload. ` +
                `Consider uploading the ZIP directly to Overleaf instead.`
            );
        }

        const zipBase64 = zipBuffer.toString("base64");

        // Find main file if not specified
        const mainFile = options.mainDocument || (await projectStore.findMainFile(projectName));

        const params = new URLSearchParams();

        // Use data URL with ZIP mime type
        const dataUrl = `data:application/zip;base64,${zipBase64}`;
        params.set("snip_uri", dataUrl);

        if (mainFile) {
            params.set("main_document", mainFile);
        }

        // Pass options but skip mainDocument since we already handled it above
        const filteredOptions = { ...options, mainDocument: undefined };
        this.addOptions(params, filteredOptions);

        return `${this.baseUrl}?${params.toString()}`;
    }

    // === Generate URL from Remote File ===

    /**
     * Generate URL to open a remote .tex file
     */
    generateFromUrl(texUrl: string, options: OverleafUrlOptions = {}): string {
        if (typeof texUrl !== 'string' || texUrl.trim().length === 0) {
            throw new Error('URL must be a non-empty string');
        }

        let parsed: URL;
        try {
            parsed = new URL(texUrl.trim());
        } catch {
            throw new Error('Invalid URL format');
        }

        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Only HTTP and HTTPS URLs are allowed');
        }

        const params = new URLSearchParams();

        params.set("snip_uri", parsed.toString());

        this.addOptions(params, options);

        return `${this.baseUrl}?${params.toString()}`;
    }

    // === Generate URL from Multiple Files ===

    /**
     * Generate URL for multiple remote files
     */
    generateFromMultipleUrls(
        files: Array<{ uri: string; name?: string }>,
        options: OverleafUrlOptions = {}
    ): string {
        if (!Array.isArray(files) || files.length === 0) {
            throw new Error('Files must be a non-empty array');
        }

        const params = new URLSearchParams();

        for (const file of files) {
            if (!file || typeof file.uri !== 'string' || file.uri.trim().length === 0) {
                throw new Error('Each file entry must contain a non-empty uri');
            }
            let parsed: URL;
            try {
                parsed = new URL(file.uri.trim());
            } catch {
                throw new Error(`Invalid file URL: ${file.uri}`);
            }
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                throw new Error('Only HTTP and HTTPS URLs are allowed');
            }

            params.append("snip_uri[]", parsed.toString());
            if (file.name) {
                params.append("snip_name[]", file.name);
            }
        }

        this.addOptions(params, options);

        return `${this.baseUrl}?${params.toString()}`;
    }

    // === Helpers ===

    private addOptions(params: URLSearchParams, options: OverleafUrlOptions): void {
        if (options.engine) {
            params.set("engine", options.engine);
        }

        if (options.mainDocument) {
            params.set("main_document", options.mainDocument);
        }

        if (options.visualEditor) {
            params.set("visual_editor", "true");
        }
    }

    /**
     * Validate that content is suitable for Overleaf
     */
    validateContent(content: string): { valid: boolean; warnings: string[] } {
        const warnings: string[] = [];

        // Check size (URL has limits)
        const encodedSize = encodeURIComponent(content).length;
        if (encodedSize > 50000) {
            warnings.push(
                `Content is large (${Math.round(encodedSize / 1024)}KB). ` +
                "Consider using ZIP upload for better reliability."
            );
        }

        // Check for documentclass
        if (!content.includes("\\documentclass")) {
            warnings.push(
                "No \\documentclass found. Overleaf will wrap content in a basic article template."
            );
        }

        return {
            valid: true,
            warnings,
        };
    }
}

// Export singleton
export const openInOverleaf = new OpenInOverleafClient();
