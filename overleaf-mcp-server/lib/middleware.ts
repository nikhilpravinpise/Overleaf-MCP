/**
 * @fileoverview Production middleware for authentication, rate limiting, and logging.
 * 
 * @module lib/middleware
 */

// ============================================
// Types
// ============================================

export interface RateLimitEntry {
    count: number;
    resetTime: number;
}

export interface RequestLog {
    timestamp: string;
    method: string;
    path: string;
    ip: string;
    userAgent: string;
    statusCode?: number;
    duration?: number;
}

// ============================================
// Configuration
// ============================================

/**
 * Production configuration from environment variables with validation.
 */
export const prodConfig = {
    /** API key for authentication (optional) */
    apiKey: process.env.MCP_API_KEY || null,

    /** Enable API key requirement */
    requireAuth: process.env.MCP_REQUIRE_AUTH === 'true',

    /** Rate limit: requests per minute per IP */
    get rateLimit() {
        const value = parseInt(process.env.MCP_RATE_LIMIT || '60', 10);
        if (isNaN(value) || value < 1 || value > 10000) {
            console.warn('⚠️  Invalid MCP_RATE_LIMIT, using default (60)');
            return 60;
        }
        return value;
    },

    /** Enable request logging */
    enableLogging: process.env.MCP_ENABLE_LOGGING !== 'false',

    /** Log level */
    get logLevel() {
        const level = process.env.MCP_LOG_LEVEL || 'info';
        const validLevels = ['debug', 'info', 'warn', 'error'];
        if (!validLevels.includes(level)) {
            console.warn('⚠️  Invalid MCP_LOG_LEVEL, using default (info)');
            return 'info';
        }
        return level;
    },

    /** CORS origins (comma-separated) */
    get corsOrigins() {
        const origins = process.env.MCP_CORS_ORIGINS || '*';
        if (origins === '*') return '*';
        
        // Validate each origin
        const originList = origins.split(',').map(o => o.trim()).filter(o => o.length > 0);
        for (const origin of originList) {
            if (origin !== '*') {
                try {
                    new URL(origin);
                } catch {
                    console.warn(`⚠️  Invalid CORS origin: ${origin}`);
                    return '*'; // Fallback to permissive
                }
            }
        }
        return origins;
    },

    /** Server port */
    get port() {
        const port = parseInt(process.env.PORT || '3000', 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            console.warn('⚠️  Invalid PORT, using default (3000)');
            return 3000;
        }
        return port;
    },
};

// ============================================
// Rate Limiting
// ============================================

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter with security enhancements.
 * 
 * @param ip - Client IP address
 * @param limit - Max requests per minute
 * @returns Whether the request is allowed
 */
export function checkRateLimit(ip: string, limit: number = prodConfig.rateLimit): {
    allowed: boolean;
    remaining: number;
    resetIn: number;
} {
    // Input validation
    if (!ip || typeof ip !== 'string') {
        throw new Error('IP address is required and must be a string');
    }
    
    if (typeof limit !== 'number' || limit < 1 || limit > 10000) {
        throw new Error('Rate limit must be between 1 and 10000');
    }
    
    // Normalize IP (remove potential whitespace)
    const normalizedIp = ip.trim();
    if (normalizedIp.length === 0) {
        throw new Error('IP address cannot be empty');
    }
    
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    const entry = rateLimitStore.get(normalizedIp);

    if (!entry || now > entry.resetTime) {
        // New window
        rateLimitStore.set(normalizedIp, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: limit - 1, resetIn: windowMs };
    }

    if (entry.count >= limit) {
        return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetIn: entry.resetTime - now };
}

/**
 * Clean up expired rate limit entries (call periodically).
 */
export function cleanupRateLimits(): void {
    const now = Date.now();
    for (const [ip, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(ip);
        }
    }
}

// CQ-15: Lazy cleanup — start only when needed
let rateLimitCleanupTimer: ReturnType<typeof setInterval> | null = null;
export function startRateLimitCleanup(): void {
    if (rateLimitCleanupTimer) return;
    rateLimitCleanupTimer = setInterval(cleanupRateLimits, 5 * 60 * 1000);
    if (rateLimitCleanupTimer.unref) rateLimitCleanupTimer.unref();
}

// ============================================
// Authentication
// ============================================

/**
 * Validate API key from request headers with enhanced security.
 * 
 * @param authHeader - Authorization header value
 * @returns Whether the API key is valid
 */
export function validateApiKey(authHeader: string | null): boolean {
    if (!prodConfig.requireAuth || !prodConfig.apiKey) {
        return true; // Auth not required
    }

    if (!authHeader) {
        return false;
    }

    // Input validation
    if (typeof authHeader !== 'string') {
        return false;
    }
    
    const trimmed = authHeader.trim();
    if (trimmed.length === 0) {
        return false;
    }
    
    // Prevent extremely long headers
    if (trimmed.length > 1000) {
        return false;
    }

    // Support both "Bearer <key>" and raw key
    const key = trimmed.startsWith('Bearer ')
        ? trimmed.slice(7).trim()
        : trimmed;

    // Validate key format
    if (key.length === 0 || key.length > 500) {
        return false;
    }

    // Constant-time comparison to prevent timing attacks
    if (key.length !== prodConfig.apiKey.length) {
        return false;
    }
    
    // Simple timing-safe comparison
    let result = 0;
    for (let i = 0; i < key.length; i++) {
        result |= key.charCodeAt(i) ^ prodConfig.apiKey.charCodeAt(i);
    }
    
    return result === 0;
}

// ============================================
// Logging
// ============================================

const requestLogs: RequestLog[] = [];
const MAX_LOGS = 1000;

/**
 * Log levels for filtering.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Logger with level filtering.
 */
export const logger = {
    debug: (message: string, data?: any) => log('debug', message, data),
    info: (message: string, data?: any) => log('info', message, data),
    warn: (message: string, data?: any) => log('warn', message, data),
    error: (message: string, data?: any) => log('error', message, data),
};

function log(level: LogLevel, message: string, data?: any): void {
    // Input validation
    if (typeof level !== 'string' || !logLevels.hasOwnProperty(level)) {
        return; // Invalid level, skip logging
    }
    
    if (typeof message !== 'string') {
        message = String(message); // Convert to string
    }
    
    if (message.length > 10000) {
        message = message.substring(0, 10000) + '... (truncated)';
    }
    
    const configLevel = logLevels[prodConfig.logLevel as LogLevel] || 1;
    if (logLevels[level] < configLevel) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    try {
        if (data) {
            // Sanitize data to prevent log injection
            const sanitizedData = typeof data === 'string' ? data : JSON.stringify(data);
            const cleanData = sanitizedData.replace(/[\r\n]/g, ' ').substring(0, 1000);
            console.log(prefix, message, cleanData);
        } else {
            console.log(prefix, message);
        }
    } catch (error) {
        // Fallback logging if JSON.stringify fails
        console.log(prefix, message, '[Unable to serialize data]');
    }
}

/**
 * Log a request for monitoring with validation.
 */
export function logRequest(log: RequestLog): void {
    if (!prodConfig.enableLogging) return;
    
    // Input validation
    if (!log || typeof log !== 'object') {
        return;
    }
    
    // Validate required fields
    if (!log.timestamp || typeof log.timestamp !== 'string') {
        return;
    }
    
    if (!log.method || typeof log.method !== 'string') {
        return;
    }
    
    if (!log.path || typeof log.path !== 'string') {
        return;
    }
    
    if (!log.ip || typeof log.ip !== 'string') {
        return;
    }
    
    // Sanitize potentially dangerous fields
    const sanitizedLog: RequestLog = {
        timestamp: log.timestamp,
        method: log.method.substring(0, 10), // Limit method length
        path: log.path.substring(0, 1000), // Limit path length
        ip: log.ip.substring(0, 45), // IPv6 max length
        userAgent: typeof log.userAgent === 'string' ? log.userAgent.substring(0, 500) : '',
        statusCode: typeof log.statusCode === 'number' ? Math.min(999, Math.max(0, log.statusCode)) : undefined,
        duration: typeof log.duration === 'number' ? Math.max(0, log.duration) : undefined,
    };

    requestLogs.push(sanitizedLog);
    if (requestLogs.length > MAX_LOGS) {
        requestLogs.shift();
    }

    logger.info(`${sanitizedLog.method} ${sanitizedLog.path}`, {
        ip: sanitizedLog.ip,
        duration: sanitizedLog.duration,
        status: sanitizedLog.statusCode,
    });
}

/**
 * Get recent request logs for monitoring.
 */
export function getRequestLogs(limit = 100): RequestLog[] {
    return requestLogs.slice(-limit);
}

// ============================================
// Health Check
// ============================================

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    timestamp: string;
    version: string;
    checks: {
        name: string;
        status: 'pass' | 'fail';
        message?: string;
    }[];
}

const startTime = Date.now();

/**
 * Get server health status with enhanced checks.
 */
export function getHealthStatus(): HealthStatus {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    const checks: HealthStatus['checks'] = [
        {
            name: 'memory',
            status: heapUsedMB < 500 ? 'pass' : heapUsedMB < 800 ? 'fail' : 'fail',
            message: `${heapUsedMB}MB used / ${heapTotalMB}MB total`,
        },
        {
            name: 'rate_limit_store',
            status: rateLimitStore.size < 10000 ? 'pass' : 'fail',
            message: `${rateLimitStore.size} entries`,
        },
        {
            name: 'request_logs',
            status: requestLogs.length < MAX_LOGS ? 'pass' : 'fail',
            message: `${requestLogs.length} / ${MAX_LOGS} logs`,
        },
        {
            name: 'uptime',
            status: true ? 'pass' : 'pass',
            message: `${Math.round((Date.now() - startTime) / 1000)}s`,
        },
    ];

    const failedChecks = checks.filter(c => c.status === 'fail');
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (failedChecks.length === 0) {
        status = 'healthy';
    } else if (failedChecks.length === 1) {
        status = 'degraded';
    } else {
        status = 'unhealthy';
    }

    return {
        status,
        uptime: Math.round((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        checks,
    };
}

// ============================================
// Security Headers
// ============================================

/**
 * Security headers for responses with enhanced policies.
 */
export const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    // HSTS only in production with HTTPS
    ...(process.env.NODE_ENV === 'production' && process.env.BASE_URL?.startsWith('https://') 
        ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload' }
        : {}),
    // CSP varies by environment
    'Content-Security-Policy': process.env.NODE_ENV === 'production'
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
        : "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
};
