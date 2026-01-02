import type { OverleafUrlOptions, CompileEngine } from "./types.js";
import { projectStore } from "./LocalProjectStore.js";

// ============================================
// Open in Overleaf Client
// ============================================

const OVERLEAF_DOCS_URL = "https://www.overleaf.com/docs";

export class OpenInOverleafClient {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || OVERLEAF_DOCS_URL;
    }

    // === Generate URL from Content ===

    /**
     * Generate URL for a single LaTeX content string
     * Uses encoded_snip for reliable handling
     */
    generateFromContent(content: string, options: OverleafUrlOptions = {}): string {
        const params = new URLSearchParams();

        // Use encoded_snip for reliable handling of special characters
        params.set("encoded_snip", encodeURIComponent(content));

        this.addOptions(params, options);

        return `${this.baseUrl}?${params.toString()}`;
    }

    // === Generate URL from Base64 ===

    /**
     * Generate URL from base64-encoded content
     * Useful when content is already encoded
     */
    generateFromBase64(base64Content: string, options: OverleafUrlOptions = {}): string {
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

        this.addOptions(params, options);

        return `${this.baseUrl}?${params.toString()}`;
    }

    // === Generate URL from Remote File ===

    /**
     * Generate URL to open a remote .tex file
     */
    generateFromUrl(texUrl: string, options: OverleafUrlOptions = {}): string {
        const params = new URLSearchParams();

        params.set("snip_uri", texUrl);

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
        const params = new URLSearchParams();

        for (const file of files) {
            params.append("snip_uri[]", file.uri);
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
