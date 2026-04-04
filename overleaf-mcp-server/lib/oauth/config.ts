/**
 * @fileoverview OAuth 2.1 configuration from environment variables.
 * @module lib/oauth/config
 */

/**
 * Validate and sanitize OAuth configuration values.
 */
function validateValue(value: string | undefined, name: string, required = false): string | undefined {
    if (!value) {
        if (required) {
            throw new Error(`${name} is required`);
        }
        return undefined;
    }
    
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        if (required) {
            throw new Error(`${name} cannot be empty`);
        }
        return undefined;
    }
    
    return trimmed;
}

/**
 * Validate TTL values (must be positive integers).
 */
function validateTTL(value: string | undefined, name: string, defaultValue: number): number {
    const str = validateValue(value, name) || String(defaultValue);
    const num = parseInt(str, 10);
    
    if (isNaN(num) || num <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
    
    // Reasonable limits
    if (name.includes('accessToken') && num > 86400) {
        throw new Error(`Access token TTL too long (max 24 hours)`);
    }
    if (name.includes('refreshToken') && num > 2592000) {
        throw new Error(`Refresh token TTL too long (max 30 days)`);
    }
    if (name.includes('code') && num > 3600) {
        throw new Error(`Authorization code TTL too long (max 1 hour)`);
    }
    
    return num;
}

/**
 * Validate URL format.
 */
function validateUrl(value: string | undefined, name: string): string {
    const url = validateValue(value, name, true)!;
    
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error(`${name} must use HTTP or HTTPS protocol`);
        }
        return parsed.toString().replace(/\/$/, ''); // Remove trailing slash
    } catch (error) {
        if (error instanceof Error && error.message.includes('protocol')) {
            throw error;
        }
        throw new Error(`${name} must be a valid URL`);
    }
}

/**
 * Validate JWT secret strength.
 */
function validateJWTSecret(secret: string | undefined): string {
    const value = validateValue(secret, 'JWT secret', true)!;
    
    if (value.length < 32) {
        throw new Error('JWT secret must be at least 32 characters long');
    }
    
    if (value === 'dev-secret-change-in-production') {
        console.warn('⚠️  WARNING: Using default JWT secret in production!');
    }
    
    // Check for common weak patterns
    if (/^(test|dev|example|sample)/i.test(value)) {
        console.warn('⚠️  WARNING: JWT secret appears to be a test/development value');
    }
    
    return value;
}

/**
 * Validate email format.
 */
function validateEmail(value: string | undefined, name: string): string | undefined {
    const email = validateValue(value, name);
    if (!email) return undefined;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error(`${name} must be a valid email address`);
    }
    
    return email.toLowerCase();
}

/**
 * Validate scope strings.
 */
function validateScopes(scopes: string, name: string): string[] {
    const trimmed = validateValue(scopes, name) || '';
    if (trimmed.length === 0) return [];
    
    const scopeList = trimmed.split(/\s+/).filter(s => s.length > 0);
    
    // Validate each scope
    for (const scope of scopeList) {
        if (!/^[a-zA-Z0-9_-]+$/.test(scope)) {
            throw new Error(`Invalid scope in ${name}: ${scope}`);
        }
    }
    
    return scopeList;
}

/**
 * Validate required OAuth configuration.
 */
function validateOAuthConfig() {
    if (oauthConfig.enabled && !oauthConfig.jwtSecret) {
        throw new Error('OAUTH_JWT_SECRET is required when OAuth is enabled');
    }
    
    // Validate issuer URL format
    try {
        new URL(oauthConfig.issuer);
    } catch {
        throw new Error('OAUTH_ISSUER must be a valid URL');
    }
    
    // Validate TTL ranges
    if (oauthConfig.accessTokenTTL <= 0 || oauthConfig.accessTokenTTL > 86400) {
        throw new Error('OAUTH_ACCESS_TOKEN_TTL must be between 1 second and 24 hours');
    }
    
    if (oauthConfig.refreshTokenTTL <= 0 || oauthConfig.refreshTokenTTL > 2592000) {
        throw new Error('OAUTH_REFRESH_TOKEN_TTL must be between 1 second and 30 days');
    }
    
    if (oauthConfig.codeTTL <= 0 || oauthConfig.codeTTL > 3600) {
        throw new Error('OAUTH_CODE_TTL must be between 1 second and 1 hour');
    }
    
    // Validate admin credentials consistency
    if (oauthConfig.adminEmail && !oauthConfig.adminPassword) {
        throw new Error('OAUTH_ADMIN_PASSWORD is required when OAUTH_ADMIN_EMAIL is set');
    }
    if (oauthConfig.adminPassword && !oauthConfig.adminEmail) {
        throw new Error('OAUTH_ADMIN_EMAIL is required when OAUTH_ADMIN_PASSWORD is set');
    }
}

/**
 * OAuth configuration loaded from environment with validation.
 */
export const oauthConfig = {
    /** Enable OAuth authentication */
    enabled: process.env.OAUTH_ENABLED === 'true',

    /** Issuer URL (server base URL) */
    issuer: process.env.OAUTH_ENABLED === 'true'
        ? validateUrl(process.env.OAUTH_ISSUER || process.env.BASE_URL, 'OAUTH_ISSUER')
        : (() => {
            const base = validateValue(process.env.BASE_URL, 'BASE_URL');
            const fallback = `http://localhost:${process.env.PORT || 3000}`;
            return base ? validateUrl(base, 'BASE_URL') : fallback;
        })(),

    /** JWT signing secret (must be secure in production) */
    jwtSecret: process.env.OAUTH_ENABLED === 'true'
        ? validateJWTSecret(process.env.OAUTH_JWT_SECRET)
        : (process.env.OAUTH_JWT_SECRET || 'dev-secret-change-in-production'),

    /** Access token TTL in seconds (default: 1 hour) */
    accessTokenTTL: validateTTL(process.env.OAUTH_ACCESS_TOKEN_TTL, 'OAUTH_ACCESS_TOKEN_TTL', 3600),

    /** Refresh token TTL in seconds (default: 7 days) */
    refreshTokenTTL: validateTTL(process.env.OAUTH_REFRESH_TOKEN_TTL, 'OAUTH_REFRESH_TOKEN_TTL', 604800),

    /** Authorization code TTL in seconds (default: 10 minutes) */
    codeTTL: validateTTL(process.env.OAUTH_CODE_TTL, 'OAUTH_CODE_TTL', 600),

    /** Default scopes for new clients */
    defaultScopes: validateScopes(process.env.OAUTH_DEFAULT_SCOPES || 'read write', 'OAUTH_DEFAULT_SCOPES').join(' '),

    /** Supported scopes */
    supportedScopes: validateScopes(process.env.OAUTH_SUPPORTED_SCOPES || 'read write admin', 'OAUTH_SUPPORTED_SCOPES'),

    /** Pre-configured admin user (optional) */
    adminEmail: validateEmail(process.env.OAUTH_ADMIN_EMAIL, 'OAUTH_ADMIN_EMAIL'),
    adminPassword: validateValue(process.env.OAUTH_ADMIN_PASSWORD, 'OAUTH_ADMIN_PASSWORD'),

    /** Data directory for storage */
    dataDir: validateValue(process.env.OAUTH_DATA_DIR, 'OAUTH_DATA_DIR') || './data/oauth',
};

// Validate configuration on import
if (oauthConfig.enabled) {
    try {
        validateOAuthConfig();
    } catch (error) {
        console.error('❌ OAuth configuration validation failed:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

/**
 * Get OAuth endpoint URLs based on issuer.
 */
export function getOAuthEndpoints() {
    const base = oauthConfig.issuer;
    return {
        issuer: base,
        authorization_endpoint: `${base}/authorize`,
        token_endpoint: `${base}/token`,
        registration_endpoint: `${base}/register`,
        revocation_endpoint: `${base}/revoke`,
        userinfo_endpoint: `${base}/userinfo`,
    };
}
