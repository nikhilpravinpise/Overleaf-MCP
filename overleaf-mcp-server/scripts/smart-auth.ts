import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import os from 'os';

const COOKIES_FILE = path.join(os.tmpdir(), 'overleaf-cookies.txt');

async function smartAuthentication() {
    console.log('🚀 Starting smart authentication...');
    
    // Check if we already have valid cookies
    if (fs.existsSync(COOKIES_FILE)) {
        const existingCookies = fs.readFileSync(COOKIES_FILE, 'utf-8').trim();
        if (existingCookies && existingCookies.includes('overleaf_session')) {
            console.log('✅ Found existing valid cookies!');
            console.log('🎉 Authentication already complete!');
            return true;
        }
    }
    
    console.log('🌐 No valid cookies found, launching browser...');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navigate to Overleaf
        await page.goto('https://www.overleaf.com', { 
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        console.log('📋 Please log in to Overleaf in the browser window.');
        console.log('💡 Tips:');
        console.log('   - If you see "browser not secure", click "Try using a different browser"');
        console.log('   - Complete the login normally');
        console.log('   - Keep the browser open until authentication completes');
        console.log('⏱️  Waiting for you to complete login...');
        
        // Wait for user to log in - check periodically if we have cookies
        let attempts = 0;
        const maxAttempts = 30; // 30 attempts = 2.5 minutes max
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            
            try {
                // Check if page is still accessible
                await page.title();
                
                // Try to extract cookies
                const cookies = await page.cookies();
                const overleafCookies = cookies.filter(cookie => 
                    cookie.domain?.includes('overleaf')
                );
                
                if (overleafCookies.length > 0) {
                    console.log(`🍪 Found ${overleafCookies.length} Overleaf cookies!`);
                    
                    // Convert ALL Overleaf cookies to cookie header format
                    const cookieString = overleafCookies
                        .map(cookie => `${cookie.name}=${cookie.value}`)
                        .join('; ');
                    
                    // Save cookies to file
                    fs.writeFileSync(COOKIES_FILE, cookieString);
                    
                    console.log(`✅ Authentication successful!`);
                    console.log(`📝 Cookies saved to: ${COOKIES_FILE}`);
                    console.log(`🍪 Found cookies: ${overleafCookies.map(c => c.name).join(', ')}`);
                    console.log('🎉 Smart authentication complete!');
                    return true;
                }
                
                attempts++;
                if (attempts % 6 === 0) { // Every 30 seconds
                    console.log(`⏳ Still waiting... (${attempts * 5}/${maxAttempts * 5} seconds)`);
                }
                
            } catch (error) {
                console.log('❌ Browser was closed or page is no longer accessible');
                break;
            }
        }
        
        console.log('⏱️  Timeout reached. Please try again.');
        return false;
        
    } catch (error) {
        console.error('❌ Authentication failed:', error);
        return false;
    } finally {
        try {
            await browser.close();
        } catch (e) {
            // Browser might already be closed
        }
    }
}

// Run smart authentication
smartAuthentication().then(success => {
    if (!success) {
        console.log('\n❌ Smart authentication failed');
        console.log('💡 Manual option:');
        console.log('   1. Log in to Overleaf in your regular browser');
        console.log('   2. Open Developer Tools (F12)');
        console.log('   3. Go to Application > Cookies > https://www.overleaf.com');
        console.log('   4. Copy all cookies and save to:', COOKIES_FILE);
    }
}).catch(console.error);
