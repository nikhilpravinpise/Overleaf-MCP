import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import os from 'os';

const COOKIES_FILE = path.join(os.tmpdir(), 'overleaf-cookies.txt');

async function extractProjectIds() {
    console.log('🔍 Extracting Overleaf project IDs from your session...');
    
    // Check if we have cookies
    if (!fs.existsSync(COOKIES_FILE)) {
        console.log('❌ No authentication cookies found. Please run `npm run smart-auth` first.');
        return [];
    }
    
    const cookieString = fs.readFileSync(COOKIES_FILE, 'utf-8').trim();
    if (!cookieString.includes('overleaf_session')) {
        console.log('❌ Invalid cookies found. Please run `npm run smart-auth` again.');
        return [];
    }
    
    console.log('🌐 Launching browser to access your Overleaf account...');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    });
    
    try {
        const page = await browser.newPage();
        
        // Remove automation indicators
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });
        
        // Set cookies
        const cookies = cookieString.split('; ').map(cookie => {
            const [name, value] = cookie.split('=');
            return { name, value, domain: '.overleaf.com', path: '/' };
        });
        
        await page.setCookie(...cookies);
        
        // Navigate to projects page
        console.log('📋 Accessing your project dashboard...');
        await page.goto('https://www.overleaf.com/project', { 
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract project information with multiple fallback methods
        const projects = await page.evaluate(() => {
            const projects = [];
            
            // Method 1: Look for any links to projects
            const projectLinks = document.querySelectorAll('a[href*="/project/"]');
            projectLinks.forEach(link => {
                const href = link.getAttribute('href');
                const match = href.match(/\/project\/([a-f0-9]+)/);
                if (match) {
                    const projectId = match[1];
                    // Avoid duplicates
                    if (!projects.find(p => p.id === projectId)) {
                        // Try to find the title from various elements
                        let title = 'Untitled Project';
                        
                        // Check if link itself contains the title
                        if (link.textContent && link.textContent.trim()) {
                            title = link.textContent.trim();
                        } else {
                            // Look for title in parent or sibling elements
                            const parent = link.closest('tr, li, div');
                            if (parent) {
                                const titleElement = parent.querySelector('.name, .title, .project-title, td:nth-child(2), h3, h4');
                                if (titleElement && titleElement.textContent) {
                                    title = titleElement.textContent.trim();
                                }
                            }
                        }
                        
                        // Clean up title (remove common artifacts)
                        title = title.replace(/^[\s\n\r]+|[\s\n\r]+$/g, '').substring(0, 100);
                        
                        projects.push({
                            id: projectId,
                            title: title,
                            url: `https://www.overleaf.com/project/${projectId}`
                        });
                    }
                }
            });
            
            return projects;
        });
        
        if (projects.length === 0) {
            // Try alternative method - intercept API calls
            console.log('🔄 Trying alternative method...');
            
            const apiProjects = await new Promise<any[]>((resolve) => {
                page.on('response', async (response) => {
                    if (response.url().includes('/api/v1/projects') || response.url().includes('/api/project')) {
                        try {
                            const data = await response.json();
                            if (Array.isArray(data)) {
                                const formatted = data.map(p => ({
                                    id: p.id || p._id,
                                    title: p.name || p.title,
                                    url: `https://www.overleaf.com/project/${p.id || p._id}`
                                }));
                                resolve(formatted);
                            }
                        } catch (e) {
                            // Ignore errors
                        }
                    }
                });
                
                // Trigger a refresh
                setTimeout(() => resolve([]), 5000);
                page.reload();
            });
            
            if (apiProjects.length > 0) {
                projects.push(...apiProjects);
            }
        }
        
        console.log(`\n✅ Found ${projects.length} project(s):`);
        console.log('─'.repeat(60));
        
        projects.forEach((project, index) => {
            console.log(`${index + 1}. ${project.title}`);
            console.log(`   ID: ${project.id}`);
            console.log(`   URL: ${project.url}`);
            console.log('');
        });
        
        // Save to file for later use
        const projectsFile = path.join(process.cwd(), 'test-projects.json');
        fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
        console.log(`💾 Saved project list to: ${projectsFile}`);
        
        return projects;
        
    } catch (error) {
        console.error('❌ Failed to extract projects:', error);
        return [];
    } finally {
        await browser.close();
    }
}

// Run the extraction
extractProjectIds().then(projects => {
    if (projects.length > 0) {
        console.log('\n🎉 Ready to test with your projects!');
        console.log('💡 You can now use these project IDs to test the MCP server tools.');
    } else {
        console.log('\n❌ No projects found. Please ensure:');
        console.log('   1. You are logged in to Overleaf');
        console.log('   2. You have at least one project');
        console.log('   3. Your authentication cookies are valid');
    }
}).catch(console.error);
