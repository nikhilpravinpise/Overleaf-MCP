/**
 * @fileoverview Overleaf Git Integration Client
 * 
 * Handles Git operations for seamless bidirectional sync with Overleaf projects.
 * Uses Overleaf's Git integration with authentication tokens.
 * 
 * @module lib/OverleafGitClient
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const git = require('simple-git');
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');

export interface OverleafGitOptions {
    projectId: string;
    token: string;
    projectName?: string;
}

export class OverleafGitClient {
    private projectPath: string;
    private projectId: string;
    private token: string;

    constructor(options: OverleafGitOptions) {
        this.projectId = options.projectId;
        this.token = options.token;
        
        // Use provided project name or generate one from project ID
        const projectName = options.projectName || `overleaf-${options.projectId}`;
        this.projectPath = path.join(PROJECTS_DIR, projectName);
    }

    /**
     * Clone an Overleaf project using Git integration
     */
    async clone(): Promise<{ success: boolean; path: string; error?: string }> {
        try {
            // Check if project directory already exists
            try {
                await fs.access(this.projectPath);
                return {
                    success: false,
                    path: this.projectPath,
                    error: 'Project already exists locally. Use pull instead.'
                };
            } catch {
                // Directory doesn't exist, proceed with clone
            }

            // Construct Overleaf Git URL
            const gitUrl = `https://git:${this.token}@git.overleaf.com/${this.projectId}`;

            // Clone the repository
            await git().clone(gitUrl, this.projectPath);

            return {
                success: true,
                path: this.projectPath
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                path: this.projectPath,
                error: errorMessage
            };
        }
    }

    /**
     * Pull latest changes from Overleaf
     */
    async pull(): Promise<{ success: boolean; error?: string }> {
        try {
            await git(this.projectPath).pull();
            return { success: true };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Push changes back to Overleaf
     */
    async push(commitMessage: string = 'Update from MCP server'): Promise<{ success: boolean; error?: string }> {
        try {
            const gitInstance = git(this.projectPath);

            // Check if there are changes to commit
            const status = await gitInstance.status();
            if (status.files.length === 0) {
                return {
                    success: true,
                    error: 'No changes to commit'
                };
            }

            // Add all changes
            await gitInstance.add('.');

            // Commit
            await gitInstance.commit(commitMessage);

            // Push
            await gitInstance.push();

            return { success: true };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Get the project name (directory name)
     */
    getProjectName(): string {
        return path.basename(this.projectPath);
    }

    /**
     * Get the local project path
     */
    getProjectPath(): string {
        return this.projectPath;
    }
}

/**
 * Create an Overleaf Git client from environment variables or parameters
 */
export function createOverleafGitClient(
    projectId: string,
    token?: string,
    projectName?: string
): OverleafGitClient {
    // Use provided token or fall back to environment variable
    const gitToken = token || process.env.OVERLEAF_GIT_TOKEN;
    
    if (!gitToken) {
        throw new Error('Overleaf Git token is required. Set OVERLEAF_GIT_TOKEN environment variable or provide token parameter.');
    }

    return new OverleafGitClient({
        projectId,
        token: gitToken,
        projectName
    });
}
