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
 * Production configuration from environment variables.
 */
export const prodConfig = {
    /** API key for authentication (optional) */
    apiKey: process.env.MCP_API_KEY || null,

    /** Enable API key requirement */
    requireAuth: process.env.MCP_REQUIRE_AUTH === 'true',

    /** Rate limit: requests per minute per IP */
    rateLimit: parseInt(process.env.MCP_RATE_LIMIT || '60', 10),

    /** Enable request logging */
    enableLogging: process.env.MCP_ENABLE_LOGGING !== 'false',

    /** Log level */
    logLevel: process.env.MCP_LOG_LEVEL || 'info',

    /** CORS origins (comma-separated) */
    corsOrigins: process.env.MCP_CORS_ORIGINS || '*',

    /** Server port */
    port: parseInt(process.env.PORT || '3000', 10),
};

// ============================================
// Rate Limiting
// ============================================

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter.
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
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    const entry = rateLimitStore.get(ip);

    if (!entry || now > entry.resetTime) {
        // New window
        rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
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

// Clean up every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

// ============================================
// Authentication
// ============================================

/**
 * Validate API key from request headers.
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

    // Support both "Bearer <key>" and raw key
    const key = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

    return key === prodConfig.apiKey;
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
    const configLevel = logLevels[prodConfig.logLevel as LogLevel] || 1;
    if (logLevels[level] < configLevel) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data) {
        console.log(prefix, message, JSON.stringify(data));
    } else {
        console.log(prefix, message);
    }
}

/**
 * Log a request for monitoring.
 */
export function logRequest(log: RequestLog): void {
    if (!prodConfig.enableLogging) return;

    requestLogs.push(log);
    if (requestLogs.length > MAX_LOGS) {
        requestLogs.shift();
    }

    logger.info(`${log.method} ${log.path}`, {
        ip: log.ip,
        duration: log.duration,
        status: log.statusCode,
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
 * Get server health status.
 */
export function getHealthStatus(): HealthStatus {
    const checks: HealthStatus['checks'] = [
        {
            name: 'memory',
            status: process.memoryUsage().heapUsed < 500 * 1024 * 1024 ? 'pass' : 'fail',
            message: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`,
        },
        {
            name: 'rate_limit_store',
            status: rateLimitStore.size < 10000 ? 'pass' : 'fail',
            message: `${rateLimitStore.size} entries`,
        },
    ];

    const allPass = checks.every(c => c.status === 'pass');

    return {
        status: allPass ? 'healthy' : 'degraded',
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
 * Security headers for responses.
 */
export const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
};
