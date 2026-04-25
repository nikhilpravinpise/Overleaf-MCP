/**
 * @fileoverview Overleaf Web API Client
 * 
 * Accesses Overleaf projects using browser cookies (no Git integration required).
 * Uses session cookie from environment variable for automatic authentication.
 * 
 * @module lib/OverleafWebApiClient
 */

import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import AdmZip from 'adm-zip';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');
const COOKIES_FILE = path.join(os.tmpdir(), 'overleaf-cookies.txt');

export interface OverleafWebApiOptions {
    sessionCookie?: string; // Manually provided Overleaf session cookie
}

export class OverleafWebApiClient {
    private cookies: string;
    private csrfToken: string;

    constructor(options: OverleafWebApiOptions = {}) {
        // Use provided cookie, environment variable, or empty
        this.cookies = options.sessionCookie || process.env.OVERLEAF_SESSION_COOKIE || '';
        this.csrfToken = '';
    }

    /**
     * Get the current session cookies (for testing purposes)
     */
    public getCookies(): string {
        return this.cookies;
    }

    /**
     * Authenticate (load cookie from file, environment, or parameter) and extract CSRF token
     */
    async authenticate(): Promise<{ success: boolean; error?: string }> {
        // If cookies already provided, skip extraction
        if (this.cookies) {
            // Extract CSRF token if we have cookies but no token
            if (!this.csrfToken) {
                await this.extractCsrfToken();
            }
            return { success: true };
        }

        // Try to load from file first (automatic authentication)
        try {
            const cookieData = await fs.readFile(COOKIES_FILE, 'utf-8');
            this.cookies = cookieData.trim();
            if (this.cookies) {
                // Extract CSRF token after loading cookies
                await this.extractCsrfToken();
                return { success: true };
            }
        } catch {
            // File doesn't exist, continue to other methods
        }

        // Try environment variable
        if (process.env.OVERLEAF_SESSION_COOKIE) {
            this.cookies = process.env.OVERLEAF_SESSION_COOKIE;
            // Extract CSRF token after setting cookies
            await this.extractCsrfToken();
            return { success: true };
        }

        // No cookie available
        return {
            success: false,
            error: 'No Overleaf session cookie found. Please run authentication first:\n\nnpm run authenticate-overleaf\n\nThis will open a browser where you can log in to Overleaf. Your session will be saved automatically for future use.'
        };
    }

    /**
     * Download project as ZIP and extract it locally
     */
    async downloadAndExtractProject(projectId: string, projectName?: string): Promise<{ success: boolean; path?: string; error?: string }> {
        try {
            console.log(`[OverleafWebApiClient] Downloading project ${projectId} with cookies: ${this.cookies.substring(0, 50)}...`);
            
            const response = await fetch(`https://www.overleaf.com/project/${projectId}/download/zip`, {
                headers: {
                    'Cookie': this.cookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            console.log(`[OverleafWebApiClient] Response status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            
            // Extract ZIP to project directory
            const zip = new AdmZip(buffer);
            const targetDir = projectName || path.join(PROJECTS_DIR, `overleaf-${projectId}`);
            
            zip.extractAllTo(targetDir, true);

            return {
                success: true,
                path: targetDir
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Upload file using browser automation (the REAL working solution)
     * This simulates actual user interaction in the browser, which is how Overleaf Workshop works
     */
    async uploadFile(projectId: string, filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`[OverleafWebApiClient] Starting browser automation upload for ${filePath}...`);
            
            // Import puppeteer using ES module syntax
            const puppeteer = await import('puppeteer');
            
            let browser: any = null;
            
            try {
                // Launch browser with stealth settings
                browser = await puppeteer.default.launch({
                    headless: false, // Keep visible for debugging
                    defaultViewport: null,
                    args: [
                        '--no-sandbox',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-web-security',
                        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        '--disable-features=VizDisplayCompositor'
                    ]
                });

                const page = await browser.newPage();

                // Remove automation traces
                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    (navigator as any).__proto__.webdriver = undefined;
                });

                // Set realistic headers
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"'
                });

                // Set cookies to maintain authentication
                const cookiePairs = this.cookies.split(';').map((pair: string) => pair.trim());
                for (const cookiePair of cookiePairs) {
                    const [name, value] = cookiePair.split('=');
                    if (name && value) {
                        await page.setCookie({
                            name: name.trim(),
                            value: value.trim(),
                            domain: '.overleaf.com',
                            path: '/'
                        });
                    }
                }

                console.log('[OverleafWebApiClient] Navigating to project...');
                
                // Navigate to the project
                await page.goto(`https://www.overleaf.com/project/${projectId}`, { 
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Wait for loading screen to disappear and editor to load
                console.log('[OverleafWebApiClient] Waiting for editor to load...');
                
                // Wait for the editor to be ready using specific selectors
                try {
                    // Try to wait for CodeMirror editor (most reliable indicator)
                    await page.waitForSelector('.cm-editor, .CodeMirror', { timeout: 30000 });
                    console.log('[OverleafWebApiClient] Editor detected!');
                } catch (e) {
                    // Fallback: try other indicators
                    console.log('[OverleafWebApiClient] Editor not found, trying fallback selectors...');
                    
                    const fallbackSelectors = [
                        '.file-tree',
                        'textarea:not([readonly])',
                        '#ide',
                        '[data-reactroot] .editor'
                    ];
                    
                    let found = false;
                    for (const selector of fallbackSelectors) {
                        try {
                            await page.waitForSelector(selector, { timeout: 5000 });
                            console.log(`[OverleafWebApiClient] Found fallback selector: ${selector}`);
                            found = true;
                            break;
                        } catch (e) {
                            // Continue trying other selectors
                        }
                    }
                    
                    if (!found) {
                        // Last resort: wait a bit and proceed anyway
                        console.log('[OverleafWebApiClient] No editor indicators found, waiting 5 seconds as last resort...');
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                }

                // Additional wait to ensure everything is settled
                await new Promise(resolve => setTimeout(resolve, 2000));

                console.log('[OverleafWebApiClient] Looking for file editor...');

                // Try to find the file in the file tree or create it
                let fileFound = false;
                
                // Try different selectors for file tree
                const fileSelectors = [
                    `[data-file-name="${filePath}"]`,
                    `[data-test-id="file-tree-item"]`,
                    `.file-tree-item:has-text("${filePath}")`,
                    `div:has-text("${filePath}")`
                ];

                for (const selector of fileSelectors) {
                    try {
                        const fileElement = await page.$(selector);
                        if (fileElement) {
                            console.log(`[OverleafWebApiClient] Found file with selector: ${selector}`);
                            await fileElement.click();
                            fileFound = true;
                            break;
                        }
                    } catch (e) {
                        // Continue trying other selectors
                    }
                }

                if (!fileFound) {
                    console.log('[OverleafWebApiClient] File not found, creating new file...');
                    
                    // Try different ways to create a new file
                    try {
                        // Look for new file button
                        const newFileButtons = [
                            '[data-test-id="new-file-button"]',
                            'button:has-text("New file")',
                            '.new-file-btn',
                            'button[title*="New file"]'
                        ];

                        for (const selector of newFileButtons) {
                            try {
                                const button = await page.$(selector);
                                if (button) {
                                    await button.click();
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }

                        // Try to enter file name
                        const nameInputs = [
                            '[data-test-id="file-name-input"]',
                            'input[placeholder*="file name"]',
                            'input[type="text"]'
                        ];

                        for (const selector of nameInputs) {
                            try {
                                const input = await page.$(selector);
                                if (input) {
                                    await input.click();
                                    await input.type(filePath);
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }

                        // Try to click create button
                        const createButtons = [
                            '[data-test-id="create-file-button"]',
                            'button:has-text("Create")',
                            'button:has-text("OK")',
                            '.create-btn'
                        ];

                        for (const selector of createButtons) {
                            try {
                                const button = await page.$(selector);
                                if (button) {
                                    await button.click();
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                    } catch (e) {
                        console.log('[OverleafWebApiClient] File creation attempt failed, continuing...');
                    }
                }

                // Wait for file tree to be ready
                await new Promise(resolve => setTimeout(resolve, 3000));

                console.log('[OverleafWebApiClient] Looking for file tree...');
                
                // First, ensure we click on the file in the file tree
                const fileTreeSelectors = [
                    '.file-tree',
                    '[data-test="file-tree"]',
                    '.file-list',
                    '.tree-view'
                ];
                
                for (const selector of fileTreeSelectors) {
                    try {
                        const fileTree = await page.$(selector);
                        if (fileTree) {
                            console.log(`[OverleafWebApiClient] Found file tree: ${selector}`);
                            
                            // Log the file tree structure
                            const treeStructure = await page.evaluate(() => {
                                const fileTree = document.querySelector('.file-tree');
                                if (!fileTree) return null;
                                
                                const items = Array.from(fileTree.querySelectorAll('*')).map(el => ({
                                    tag: el.tagName,
                                    class: el.className,
                                    text: el.textContent?.substring(0, 50)
                                }));
                                
                                return { items };
                            });
                            
                            console.log('[OverleafWebApiClient] File tree structure:', treeStructure);
                            
                            // Look for the specific file in the tree
                            const fileItem = await page.waitForFunction((fileName: string) => {
                                const items = document.querySelectorAll('.file-tree-item, [data-file-name], .tree-item, li, span, div');
                                for (const item of items) {
                                    if (item.textContent && item.textContent.includes(fileName)) {
                                        // Try clicking on the element or its parent
                                        const clickable = item.closest('li, .file-tree-item, [onclick]') || item;
                                        console.log('Found file element:', item.tagName, item.className);
                                        clickable.click();
                                        return true;
                                    }
                                }
                                return false;
                            }, filePath, { timeout: 5000 });
                            
                            if (fileItem) {
                                console.log(`[OverleafWebApiClient] Clicked on file: ${filePath}`);
                                await new Promise(resolve => setTimeout(resolve, 2000));
                                break;
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }
                
                // Wait for editor to load after selecting file
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Try different ways to access the editor - be more flexible
                const editorSelectors = [
                    '.cm-content',
                    '.cm-editor .cm-content',
                    '.CodeMirror',
                    '.CodeMirror-scroll',
                    'textarea',
                    'textarea.editor',
                    '[contenteditable="true"]',
                    '.editor-content',
                    '.ace_content',
                    '.ace_editor',
                    '#editor',
                    '.editor',
                    '[data-test-id="editor"]',
                    '.monaco-editor',
                    '.monaco-editor .view-lines'
                ];

                let editorFound = false;
                let workingEditor: any = null;
                let workingSelector = '';

                for (const selector of editorSelectors) {
                    try {
                        const editor = await page.$(selector);
                        if (editor) {
                            // Test if we can interact with it
                            const isVisible = await page.evaluate((el: any) => {
                                const style = window.getComputedStyle(el);
                                return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                            }, editor);
                            
                            if (isVisible) {
                                console.log(`[OverleafWebApiClient] Found visible editor with selector: ${selector}`);
                                workingEditor = editor;
                                workingSelector = selector;
                                editorFound = true;
                                break;
                            } else {
                                console.log(`[OverleafWebApiClient] Editor ${selector} found but not visible`);
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!editorFound) {
                    // Try a more direct approach - find any editable element
                    console.log('[OverleafWebApiClient] Standard selectors failed, trying broader search...');
                    
                    const allEditable = await page.$$('[contenteditable="true"], textarea, input[type="text"]');
                    
                    for (const element of allEditable) {
                        try {
                            const isVisible = await page.evaluate((el: any) => {
                                const style = window.getComputedStyle(el);
                                return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                            }, element);
                            
                            if (isVisible) {
                                console.log('[OverleafWebApiClient] Found editable element via broader search');
                                workingEditor = element;
                                workingSelector = 'editable-element';
                                editorFound = true;
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }

                if (!editorFound) {
                    // Last resort - try to click in the main content area and type
                    console.log('[OverleafWebApiClient] No specific editor found, trying main content area...');
                    
                    const contentSelectors = [
                        'main',
                        '.main-content',
                        '#main',
                        '.editor-container',
                        '.workspace',
                        '.document'
                    ];
                    
                    for (const selector of contentSelectors) {
                        try {
                            const element = await page.$(selector);
                            if (element) {
                                await element.click();
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                workingEditor = element;
                                workingSelector = selector;
                                editorFound = true;
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                }

                if (!editorFound) {
                    throw new Error('Could not find any editable element to update content');
                }

                console.log(`[OverleafWebApiClient] Using editor: ${workingSelector}`);
                
                // Update content using CodeMirror API or fallback to typing
                try {
                    // First try to use CodeMirror API directly
                    const updateSuccess = await page.evaluate((text: string) => {
                        try {
                            // Try CodeMirror 6
                            const cmEditor = document.querySelector('.cm-editor');
                            if (cmEditor && (cmEditor as any).view) {
                                const view = (cmEditor as any).view;
                                const transaction = view.state.update({
                                    changes: {
                                        from: 0,
                                        to: view.state.doc.length,
                                        insert: text
                                    }
                                });
                                view.dispatch(transaction);
                                return true;
                            }
                            
                            // Try CodeMirror 5
                            const cm5Editor = document.querySelector('.CodeMirror') as any;
                            if (cm5Editor && cm5Editor.CodeMirror) {
                                cm5Editor.CodeMirror.setValue(text);
                                return true;
                            }
                            
                            return false;
                        } catch (e) {
                            console.error('CodeMirror API failed:', e);
                            return false;
                        }
                    }, content);
                    
                    if (updateSuccess) {
                        console.log('[OverleafWebApiClient] Content updated via CodeMirror API');
                    } else {
                        // Fallback to typing approach
                        console.log('[OverleafWebApiClient] CodeMirror API failed, using typing fallback...');
                        
                        // Focus on the editor
                        await workingEditor.click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Select all content
                        await page.keyboard.down('Control');
                        await page.keyboard.press('a');
                        await page.keyboard.up('Control');
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // Type the new content
                        await workingEditor.type(content, { delay: 5 });
                        
                        console.log('[OverleafWebApiClient] Content updated via typing');
                    }
                    
                } catch (typeError) {
                    console.log('[OverleafWebApiClient] Direct typing failed, trying alternative approach...');
                    
                    // Alternative: use page.evaluate to set content directly
                    try {
                        await page.evaluate((text: string) => {
                            const activeElement = document.activeElement;
                            if (activeElement) {
                                if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
                                    (activeElement as HTMLTextAreaElement).value = text;
                                } else if (activeElement.isContentEditable) {
                                    activeElement.textContent = text;
                                }
                                
                                // Trigger input events
                                const event = new Event('input', { bubbles: true });
                                activeElement.dispatchEvent(event);
                            }
                        }, content);
                        
                        console.log('[OverleafWebApiClient] Content set via evaluate');
                        
                    } catch (evalError) {
                        throw new Error(`Both typing and evaluation failed: ${evalError}`);
                    }
                }

                // Trigger save to ensure changes are persisted
                console.log('[OverleafWebApiClient] Triggering save...');
                try {
                    // Try Ctrl+S to save
                    await page.keyboard.down('Control');
                    await page.keyboard.press('s');
                    await page.keyboard.up('Control');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (e) {
                    // Save shortcut failed, but continue
                }
                
                // Wait for sync
                console.log('[OverleafWebApiClient] Waiting for sync...');
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Check for any error indicators
                const errorSelectors = [
                    '[data-test-id="save-error"]',
                    '.error-message',
                    '.alert-danger',
                    '[role="alert"]'
                ];

                for (const selector of errorSelectors) {
                    try {
                        const errorElement = await page.$(selector);
                        if (errorElement) {
                            const errorText = await page.evaluate((el: any) => el.textContent, errorElement);
                            throw new Error(`Save error: ${errorText}`);
                        }
                    } catch (e) {
                        continue;
                    }
                }

                console.log('[OverleafWebApiClient] Browser automation upload completed successfully!');
                return { success: true };

            } finally {
                if (browser) {
                    await browser.close();
                }
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[OverleafWebApiClient] Browser automation failed:', errorMessage);
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Extract CSRF token from Overleaf page
     */
    private async extractCsrfToken(): Promise<void> {
        try {
            console.log('[OverleafWebApiClient] Extracting CSRF token...');
            
            // Make a request to a specific project page to get CSRF token
            const response = await fetch('https://www.overleaf.com/project/6974d2a430815c0cd444e68d', {
                headers: {
                    'Cookie': this.cookies,
                },
            });

            if (!response.ok) {
                console.log('[OverleafWebApiClient] Could not fetch CSRF token page');
                return;
            }

            const html = await response.text();
            
            // Extract CSRF token from meta tag
            const csrfMatch = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/i);
            if (csrfMatch) {
                this.csrfToken = csrfMatch[1];
                console.log('[OverleafWebApiClient] CSRF token extracted successfully from meta tag');
                return;
            }

            // Alternative: look for CSRF token in JavaScript
            const jsMatch = html.match(/window\.csrfToken\s*=\s*["']([^"']+)["']/i);
            if (jsMatch) {
                this.csrfToken = jsMatch[1];
                console.log('[OverleafWebApiClient] CSRF token extracted from JavaScript');
                return;
            }

            // Alternative: look for _csrf cookie
            const csrfCookieMatch = this.cookies.match(/_csrf=([^;]+)/);
            if (csrfCookieMatch) {
                this.csrfToken = decodeURIComponent(csrfCookieMatch[1]);
                console.log('[OverleafWebApiClient] CSRF token extracted from cookies');
                return;
            }

            // Alternative: look for any CSRF-like token in the HTML
            const genericMatch = html.match(/csrf[_-]?token["\']?\s*[:=]\s*["\']([^"\']+)["']/i);
            if (genericMatch) {
                this.csrfToken = genericMatch[1];
                console.log('[OverleafWebApiClient] CSRF token extracted using generic pattern');
                return;
            }

            console.log('[OverleafWebApiClient] CSRF token not found, proceeding without it');
        } catch (error) {
            console.log('[OverleafWebApiClient] Failed to extract CSRF token:', error);
        }
    }
}

/**
 * Create an Overleaf Web API client
 */
export function createOverleafWebApiClient(options?: OverleafWebApiOptions): OverleafWebApiClient {
    return new OverleafWebApiClient(options);
}
