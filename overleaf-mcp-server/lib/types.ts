/**
 * @fileoverview Core type definitions for the Overleaf MCP Server.
 * 
 * This module defines all TypeScript interfaces and types used throughout
 * the server for project management, compilation, and external service integration.
 * 
 * @module lib/types
 * @license MIT
 */

// ============================================
// Project Types
// ============================================

/**
 * Represents a LaTeX project stored locally.
 * 
 * @example
 * ```typescript
 * const project: Project = {
 *   name: "my-thesis",
 *   path: "/projects/my-thesis",
 *   createdAt: new Date(),
 *   lastModified: new Date(),
 *   mainFile: "main.tex",
 *   fileCount: 15
 * };
 * ```
 */
export interface Project {
    /** Unique project name (used as directory name) */
    name: string;
    /** Absolute path to the project directory */
    path: string;
    /** When the project was created */
    createdAt: Date;
    /** When any file in the project was last modified */
    lastModified: Date;
    /** Main .tex file to compile (auto-detected or user-specified) */
    mainFile: string | null;
    /** Total number of files in the project */
    fileCount: number;
}

/**
 * Represents a file or directory within a project.
 */
export interface ProjectFile {
    /** Relative path from project root */
    path: string;
    /** File or directory name */
    name: string;
    /** File extension (lowercase, without dot) */
    extension: string;
    /** File size in bytes (0 for directories) */
    size: number;
    /** True if this is a directory */
    isDirectory: boolean;
}

/**
 * Comprehensive status of a project including files and compilation state.
 */
export interface ProjectStatus {
    /** The project metadata */
    project: Project;
    /** All files in the project */
    files: ProjectFile[];
    /** Paths to all .tex files */
    texFiles: string[];
    /** Whether project contains image files */
    hasImages: boolean;
    /** Whether project contains .bib bibliography files */
    hasBibliography: boolean;
    /** Last compilation result (if cached) */
    lastCompile?: CompileResult;
}

// ============================================
// Compilation Types
// ============================================

/**
 * Result of a LaTeX compilation attempt.
 * 
 * @example
 * ```typescript
 * // Successful compilation
 * const result: CompileResult = {
 *   success: true,
 *   pdfPath: "/cache/my-thesis/output.pdf",
 *   pdfBase64: "JVBERi0xLjQK...",
 *   errors: [],
 *   warnings: [{ message: "Underfull hbox", type: "other" }],
 *   duration: 3500
 * };
 * ```
 */
export interface CompileResult {
    /** Whether compilation produced a valid PDF */
    success: boolean;
    /** Local path to cached PDF (if successful) */
    pdfPath?: string;
    /** Base64-encoded PDF content (for widget display) */
    pdfBase64?: string;
    /** Local path to cached log file */
    logPath?: string;
    /** Raw log text from compilation (for caching and analysis) */
    rawLog?: string;
    /** All errors extracted from the log */
    errors: CompileError[];
    /** All warnings extracted from the log */
    warnings: CompileWarning[];
    /** Compilation time in milliseconds */
    duration: number;
}

/**
 * A compilation error extracted from the LaTeX log.
 */
export interface CompileError {
    /** Line number where the error occurred (0 if unknown) */
    line: number;
    /** Error message text */
    message: string;
    /** File where the error occurred (if multi-file project) */
    file?: string;
    /** Error category for filtering/grouping */
    type: "syntax" | "undefined" | "missing" | "other";
}

/**
 * A compilation warning extracted from the LaTeX log.
 */
export interface CompileWarning {
    /** Line number (optional, many warnings don't have one) */
    line?: number;
    /** Warning message text */
    message: string;
    /** Warning category for filtering/grouping */
    type: "reference" | "font" | "package" | "other";
}

/**
 * Available LaTeX compilation engines.
 * 
 * - `pdflatex`: Standard engine, best compatibility
 * - `xelatex`: Unicode/font support
 * - `lualatex`: Lua scripting, modern fonts
 */
export type CompileEngine = "pdflatex" | "xelatex" | "lualatex";

// ============================================
// Open in Overleaf Types
// ============================================

/**
 * Options for generating "Open in Overleaf" URLs.
 * 
 * @see https://www.overleaf.com/devs
 */
export interface OverleafUrlOptions {
    /** LaTeX engine to use in Overleaf */
    engine?: CompileEngine;
    /** Main document path (auto-detected if not specified) */
    mainDocument?: string;
    /** Start in visual editor mode (default: false) */
    visualEditor?: boolean;
}

// ============================================
// CTAN Package Types
// ============================================

/**
 * Information about a LaTeX package from CTAN.
 * 
 * @see https://ctan.org/json/2.0
 */
export interface CTANPackage {
    /** Package name (e.g., "amsmath") */
    name: string;
    /** Short one-line description */
    caption: string;
    /** Full package description */
    description: string;
    /** Current version number */
    version?: string;
    /** License type (e.g., "lppl1.3c") */
    license?: string;
    /** URL to package documentation */
    documentationUrl?: string;
}

/**
 * Result of a CTAN package search.
 */
export interface CTANSearchResult {
    /** Matching packages (limited by query) */
    packages: CTANPackage[];
    /** Total number of matches on CTAN */
    total: number;
}

// ============================================
// Log Parsing Types
// ============================================

/**
 * Parsed LaTeX compilation log with structured data.
 */
export interface ParsedLog {
    /** Extracted errors */
    errors: CompileError[];
    /** Extracted warnings */
    warnings: CompileWarning[];
    /** Original log content */
    rawLog: string;
    /** Human-readable summary (e.g., "3 errors, 5 warnings") */
    summary: string;
}

// ============================================
// Configuration
// ============================================

/**
 * Privacy mode for external service usage.
 * 
 * - `ask`: Prompt before sending to external services
 * - `allow`: Allow external compilation (LaTeX.Online)
 * - `local`: Never send data externally (compile disabled)
 */
export type PrivacyMode = "ask" | "allow" | "local";

/**
 * Server configuration options.
 * 
 * @see config.example.json
 */
export interface Config {
    /** Privacy settings for external services */
    privacy: {
        /** How to handle external service requests */
        mode: PrivacyMode;
        /** Warn if project size exceeds this (bytes) */
        warnSize: number;
    };
    /** Compilation settings */
    compilation: {
        /** Default LaTeX engine */
        engine: CompileEngine;
        /** Compilation timeout in milliseconds */
        timeout: number;
    };
    /** Caching settings */
    cache: {
        /** Whether to cache compiled PDFs and logs */
        enabled: boolean;
        /** Max cache age in milliseconds */
        maxAge: number;
    };
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Config = {
    privacy: {
        mode: "ask",
        warnSize: 5 * 1024 * 1024, // 5MB
    },
    compilation: {
        engine: "pdflatex",
        timeout: 60000, // 1 minute
    },
    cache: {
        enabled: true,
        maxAge: 3600000, // 1 hour
    },
};

// ============================================
// Validation Types
// ============================================

/**
 * Result of quick LaTeX validation (without compilation).
 */
export interface ValidationResult {
    /** Whether content passed all checks */
    valid: boolean;
    /** List of issue descriptions */
    issues: string[];
}



// ============================================
// ChatGPT Connector Types (Deep Research)
// ============================================

/**
 * Search result format required by ChatGPT Connectors and Deep Research.
 * 
 * @see https://platform.openai.com/docs/guides/mcp
 */
export interface ChatGPTSearchResult {
    /** Unique document identifier (format: projectName:filePath) */
    id: string;
    /** Human-readable title */
    title: string;
    /** URL for citation (format: latex://projectName/filePath) */
    url: string;
    /** Optional text snippet from the document */
    text?: string;
}

/**
 * Fetch result format required by ChatGPT Connectors and Deep Research.
 * 
 * @see https://platform.openai.com/docs/guides/mcp
 */
export interface ChatGPTFetchResult {
    /** Unique document identifier */
    id: string;
    /** Human-readable title */
    title: string;
    /** Full text content of the document */
    text: string;
    /** URL for citation */
    url: string;
    /** Optional metadata about the document */
    metadata?: Record<string, any>;
}

/**
 * Internal search result with match details.
 */
export interface ContentSearchResult {
    /** Project name */
    project: string;
    /** File path within project */
    filePath: string;
    /** File name */
    fileName: string;
    /** Text snippet containing match */
    snippet: string;
    /** Match score (higher = better) */
    score: number;
}
