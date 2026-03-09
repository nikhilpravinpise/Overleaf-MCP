/**
 * @fileoverview Local file system storage for LaTeX projects.
 * 
 * Handles all file operations including:
 * - Project creation, listing, and deletion
 * - File read/write/delete operations
 * - Archive creation (tarball for LaTeX.Online, ZIP for Overleaf)
 * - Caching of compiled PDFs and logs
 * 
 * @module lib/LocalProjectStore
 */

import { readdir, readFile, writeFile, mkdir, rm, stat, access, constants } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import type { Project, ProjectFile, ProjectStatus, CompileResult } from "./types.js";
import { parseLog } from "./LogParser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Default directory for storing user projects */
const PROJECTS_DIR = path.join(__dirname, "..", "projects");
/** Default directory for caching compiled PDFs and logs */
const CACHE_DIR = path.join(__dirname, "..", "cache");

/**
 * Manages local LaTeX project storage and file operations.
 * 
 * @example
 * ```typescript
 * // Create and use the default instance
 * import { projectStore } from './lib';
 * 
 * // Create a project
 * const project = await projectStore.createProject('my-thesis');
 * 
 * // Write a file
 * await projectStore.writeFile('my-thesis', 'main.tex', content);
 * 
 * // Create tarball for compilation
 * const tarball = await projectStore.createTarball('my-thesis');
 * ```
 */
export class LocalProjectStore {
    private projectsDir: string;
    private cacheDir: string;

    /**
     * Create a new LocalProjectStore instance.
     * 
     * @param projectsDir - Custom projects directory (defaults to ./projects)
     * @param cacheDir - Custom cache directory (defaults to ./cache)
     */
    constructor(projectsDir?: string, cacheDir?: string) {
        this.projectsDir = projectsDir || PROJECTS_DIR;
        this.cacheDir = cacheDir || CACHE_DIR;
    }

    // === Security Guards ===

    /**
     * Validate and sanitize a project name to prevent path traversal.
     * @throws {Error} If name contains invalid characters
     */
    private sanitizeProjectName(name: string): string {
        if (!name || typeof name !== 'string') {
            throw new Error('Project name is required');
        }
        // Only allow alphanumeric, hyphens, underscores, dots (no path separators)
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_\-\.]*$/.test(name)) {
            throw new Error('Invalid project name. Use only letters, numbers, hyphens, underscores, and dots.');
        }
        if (name === '.' || name === '..') {
            throw new Error('Invalid project name');
        }
        return name;
    }

    /**
     * Resolve and validate a file path to prevent path traversal.
     * @throws {Error} If path escapes the allowed directory
     */
    private safePath(baseParts: string[], relativePath: string): string {
        const baseDir = path.resolve(...baseParts);
        const fullPath = path.resolve(baseDir, relativePath);
        if (!fullPath.startsWith(baseDir + path.sep) && fullPath !== baseDir) {
            throw new Error('Path traversal detected: path escapes allowed directory');
        }
        return fullPath;
    }

    // === Directory Setup ===

    /**
     * Ensure project and cache directories exist.
     * Called automatically by most operations.
     */
    async ensureDirectories(): Promise<void> {
        await mkdir(this.projectsDir, { recursive: true });
        await mkdir(this.cacheDir, { recursive: true });
    }

    // === Project Operations ===

    /**
     * Create a new LaTeX project.
     * 
     * @param name - Project name (used as directory name)
     * @param template - Optional initial content for main.tex
     * @returns The created project metadata
     * @throws {Error} If project already exists
     */
    async createProject(name: string, template?: string): Promise<Project> {
        const safeName = this.sanitizeProjectName(name);
        await this.ensureDirectories();

        const projectPath = path.join(this.projectsDir, safeName);

        // Check if already exists
        if (await this.exists(projectPath)) {
            throw new Error(`Project "${safeName}" already exists`);
        }

        await mkdir(projectPath, { recursive: true });

        // Create default main.tex
        const mainContent = template || this.getDefaultTemplate();
        await writeFile(path.join(projectPath, "main.tex"), mainContent, "utf-8");

        return this.getProject(safeName);
    }

    async listProjects(): Promise<Project[]> {
        await this.ensureDirectories();

        try {
            const entries = await readdir(this.projectsDir, { withFileTypes: true });
            const projects: Project[] = [];

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    try {
                        const project = await this.getProject(entry.name);
                        projects.push(project);
                    } catch {
                        // Skip invalid projects
                    }
                }
            }

            return projects;
        } catch {
            return [];
        }
    }

    async getProject(name: string): Promise<Project> {
        const safeName = this.sanitizeProjectName(name);
        const projectPath = path.join(this.projectsDir, safeName);

        if (!(await this.exists(projectPath))) {
            throw new Error(`Project "${safeName}" not found`);
        }

        const stats = await stat(projectPath);
        const files = await this.listFiles(name);
        const mainFile = await this.findMainFile(name);

        return {
            name,
            path: projectPath,
            createdAt: stats.birthtime,
            lastModified: stats.mtime,
            mainFile,
            fileCount: files.length,
        };
    }

    async deleteProject(name: string): Promise<boolean> {
        const safeName = this.sanitizeProjectName(name);
        const projectPath = path.join(this.projectsDir, safeName);

        if (!(await this.exists(projectPath))) {
            throw new Error(`Project "${safeName}" not found`);
        }

        await rm(projectPath, { recursive: true, force: true });

        // Also clean cache
        const cachePath = path.join(this.cacheDir, name);
        await rm(cachePath, { recursive: true, force: true }).catch(() => { });

        return true;
    }

    async getProjectStatus(name: string): Promise<ProjectStatus> {
        const project = await this.getProject(name);
        const files = await this.listFiles(name);

        const texFiles = files.filter((f) => f.extension === ".tex").map((f) => f.path);
        const hasImages = files.some((f) =>
            [".png", ".jpg", ".jpeg", ".pdf", ".eps", ".svg"].includes(f.extension)
        );
        const hasBibliography = files.some((f) => f.extension === ".bib");

        // Try to load last compile result from cached log
        let lastCompile: CompileResult | undefined;
        try {
            const logPath = path.join(this.cacheDir, name, "last.log");
            await access(logPath, constants.F_OK);
            const logContent = await readFile(logPath, "utf-8");
            const parsed = parseLog(logContent);
            lastCompile = {
                success: parsed.errors.length === 0,
                errors: parsed.errors,
                warnings: parsed.warnings,
                rawLog: logContent,
                duration: 0,
            };
        } catch {
            // No cached compile log
        }

        return {
            project,
            files,
            texFiles,
            hasImages,
            hasBibliography,
            lastCompile,
        };
    }

    // === File Operations ===

    async listFiles(projectName: string, subPath?: string): Promise<ProjectFile[]> {
        const safeName = this.sanitizeProjectName(projectName);
        const projectPath = path.join(this.projectsDir, safeName);
        const targetPath = subPath
            ? this.safePath([this.projectsDir, safeName], subPath)
            : projectPath;

        if (!(await this.exists(targetPath))) {
            throw new Error(`Path not found: ${subPath || safeName}`);
        }

        const files: ProjectFile[] = [];
        await this.walkDirectory(targetPath, projectPath, files);

        return files;
    }

    private async walkDirectory(
        currentPath: string,
        basePath: string,
        files: ProjectFile[]
    ): Promise<void> {
        const entries = await readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = path.relative(basePath, fullPath).replace(/\\/g, "/");

            if (entry.isDirectory()) {
                files.push({
                    path: relativePath,
                    name: entry.name,
                    extension: "",
                    size: 0,
                    isDirectory: true,
                });
                await this.walkDirectory(fullPath, basePath, files);
            } else {
                const stats = await stat(fullPath);
                files.push({
                    path: relativePath,
                    name: entry.name,
                    extension: path.extname(entry.name).toLowerCase(),
                    size: stats.size,
                    isDirectory: false,
                });
            }
        }
    }

    async readFile(projectName: string, filePath: string): Promise<string> {
        const safeName = this.sanitizeProjectName(projectName);
        const fullPath = this.safePath([this.projectsDir, safeName], filePath);

        if (!(await this.exists(fullPath))) {
            throw new Error(`File not found: ${filePath}`);
        }

        const stats = await stat(fullPath);
        if (stats.size > 2 * 1024 * 1024) {
            throw new Error(`File exceeds 2MB limit (${Math.round(stats.size / 1024 / 1024)}MB)`);
        }

        return readFile(fullPath, "utf-8");
    }

    async writeFile(projectName: string, filePath: string, content: string): Promise<boolean> {
        const safeName = this.sanitizeProjectName(projectName);
        const projectPath = path.join(this.projectsDir, safeName);
        const fullPath = this.safePath([this.projectsDir, safeName], filePath);

        if (!(await this.exists(projectPath))) {
            throw new Error(`Project "${safeName}" not found`);
        }

        // Ensure parent directory exists
        const parentDir = path.dirname(fullPath);
        await mkdir(parentDir, { recursive: true });

        // Check size
        if (content.length > 2 * 1024 * 1024) {
            throw new Error("Content exceeds 2MB limit");
        }

        await writeFile(fullPath, content, "utf-8");
        return true;
    }

    async deleteFile(projectName: string, filePath: string): Promise<boolean> {
        const safeName = this.sanitizeProjectName(projectName);
        const fullPath = this.safePath([this.projectsDir, safeName], filePath);

        if (!(await this.exists(fullPath))) {
            throw new Error(`File not found: ${filePath}`);
        }

        await rm(fullPath);
        return true;
    }

    // === Archive Operations ===

    async createTarball(projectName: string): Promise<Buffer> {
        const safeName = this.sanitizeProjectName(projectName);
        const projectPath = path.join(this.projectsDir, safeName);

        if (!(await this.exists(projectPath))) {
            throw new Error(`Project "${safeName}" not found`);
        }

        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            const archive = archiver("tar", { gzip: true });

            archive.on("data", (chunk) => chunks.push(chunk));
            archive.on("end", () => resolve(Buffer.concat(chunks)));
            archive.on("error", reject);

            archive.directory(projectPath, false);
            archive.finalize();
        });
    }

    async createZip(projectName: string): Promise<Buffer> {
        const safeName = this.sanitizeProjectName(projectName);
        const projectPath = path.join(this.projectsDir, safeName);

        if (!(await this.exists(projectPath))) {
            throw new Error(`Project "${safeName}" not found`);
        }

        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            const archive = archiver("zip", { zlib: { level: 9 } });

            archive.on("data", (chunk) => chunks.push(chunk));
            archive.on("end", () => resolve(Buffer.concat(chunks)));
            archive.on("error", reject);

            archive.directory(projectPath, false);
            archive.finalize();
        });
    }

    // === Cache Operations ===

    async savePdfToCache(projectName: string, pdfBuffer: Buffer): Promise<string> {
        const cacheProjectDir = path.join(this.cacheDir, projectName);
        await mkdir(cacheProjectDir, { recursive: true });

        const pdfPath = path.join(cacheProjectDir, "output.pdf");
        await writeFile(pdfPath, pdfBuffer);
        return pdfPath;
    }

    async saveLogToCache(projectName: string, log: string): Promise<string> {
        const cacheProjectDir = path.join(this.cacheDir, projectName);
        await mkdir(cacheProjectDir, { recursive: true });

        const logPath = path.join(cacheProjectDir, "last.log");
        await writeFile(logPath, log, "utf-8");
        return logPath;
    }

    async getCachedPdf(projectName: string): Promise<Buffer | null> {
        const pdfPath = path.join(this.cacheDir, projectName, "output.pdf");
        try {
            return await readFile(pdfPath);
        } catch {
            return null;
        }
    }

    async getCachedLog(projectName: string): Promise<string | null> {
        const logPath = path.join(this.cacheDir, projectName, "last.log");
        try {
            return await readFile(logPath, "utf-8");
        } catch {
            return null;
        }
    }

    // === Helpers ===

    async findMainFile(projectName: string): Promise<string | null> {
        const files = await this.listFiles(projectName);
        const texFiles = files.filter((f) => f.extension === ".tex");

        // Priority: main.tex > first file with \documentclass
        const mainTex = texFiles.find((f) => f.name.toLowerCase() === "main.tex");
        if (mainTex) return mainTex.path;

        for (const file of texFiles) {
            try {
                const content = await this.readFile(projectName, file.path);
                if (content.includes("\\documentclass")) {
                    return file.path;
                }
            } catch {
                continue;
            }
        }

        return texFiles[0]?.path || null;
    }

    private async exists(filePath: string): Promise<boolean> {
        try {
            await access(filePath, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    private getDefaultTemplate(): string {
        return `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{My Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Welcome to your new LaTeX document!

\\end{document}
`;
    }

    // === ChatGPT Deep Research Support ===

    /**
     * Search across all projects for content matching the query.
     * Used by ChatGPT Connectors and Deep Research.
     * 
     * @param query - Search query string
     * @param limit - Maximum results to return (default: 20)
     * @returns Array of search results with snippets
     */
    async searchContent(query: string, limit = 20): Promise<Array<{
        project: string;
        filePath: string;
        fileName: string;
        snippet: string;
        score: number;
    }>> {
        const results: Array<{
            project: string;
            filePath: string;
            fileName: string;
            snippet: string;
            score: number;
        }> = [];

        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

        try {
            const projects = await this.listProjects();

            for (const project of projects) {
                const files = await this.listFiles(project.name);
                const texFiles = files.filter(f => f.extension === ".tex");

                for (const file of texFiles) {
                    try {
                        const content = await this.readFile(project.name, file.path);
                        const contentLower = content.toLowerCase();

                        // Calculate relevance score
                        let score = 0;

                        // Check project name match
                        if (project.name.toLowerCase().includes(queryLower)) {
                            score += 50;
                        }

                        // Check file name match
                        if (file.name.toLowerCase().includes(queryLower)) {
                            score += 30;
                        }

                        // Check content matches
                        for (const word of queryWords) {
                            // Escape regex special chars to prevent ReDoS
                            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const matches = (contentLower.match(new RegExp(escaped, 'g')) || []).length;
                            score += matches * 5;
                        }

                        // Only include if there's some match
                        if (score > 0) {
                            // Extract snippet around first match
                            const matchIndex = contentLower.indexOf(queryLower);
                            let snippet = "";

                            if (matchIndex >= 0) {
                                const start = Math.max(0, matchIndex - 100);
                                const end = Math.min(content.length, matchIndex + query.length + 100);
                                snippet = content.substring(start, end).trim();
                                if (start > 0) snippet = "..." + snippet;
                                if (end < content.length) snippet = snippet + "...";
                            } else {
                                // Use first 200 chars as snippet
                                snippet = content.substring(0, 200).trim() + "...";
                            }

                            results.push({
                                project: project.name,
                                filePath: file.path,
                                fileName: file.name,
                                snippet,
                                score
                            });
                        }
                    } catch {
                        // Skip unreadable files
                    }
                }
            }

            // Sort by score descending and limit
            results.sort((a, b) => b.score - a.score);
            return results.slice(0, limit);
        } catch {
            return [];
        }
    }
}

// Export singleton
export const projectStore = new LocalProjectStore();
