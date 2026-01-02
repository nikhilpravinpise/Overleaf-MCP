/**
 * @fileoverview OAuth 2.1 configuration from environment variables.
 * @module lib/oauth/config
 */

/**
 * OAuth configuration loaded from environment.
 */
export const oauthConfig = {
    /** Enable OAuth authentication */
    enabled: process.env.OAUTH_ENABLED === 'true',

    /** Issuer URL (server base URL) */
    issuer: process.env.OAUTH_ISSUER || process.env.BASE_URL || 'http://localhost:3000',

    /** JWT signing secret (must be secure in production) */
    jwtSecret: process.env.OAUTH_JWT_SECRET || 'dev-secret-change-in-production',

    /** Access token TTL in seconds (default: 1 hour) */
    accessTokenTTL: parseInt(process.env.OAUTH_ACCESS_TOKEN_TTL || '3600', 10),

    /** Refresh token TTL in seconds (default: 7 days) */
    refreshTokenTTL: parseInt(process.env.OAUTH_REFRESH_TOKEN_TTL || '604800', 10),

    /** Authorization code TTL in seconds (default: 10 minutes) */
    codeTTL: parseInt(process.env.OAUTH_CODE_TTL || '600', 10),

    /** Default scopes for new clients */
    defaultScopes: 'read write',

    /** Supported scopes */
    supportedScopes: ['read', 'write', 'admin'],

    /** Pre-configured admin user (optional) */
    adminEmail: process.env.OAUTH_ADMIN_EMAIL || null,
    adminPassword: process.env.OAUTH_ADMIN_PASSWORD || null,

    /** Data directory for storage */
    dataDir: process.env.OAUTH_DATA_DIR || './data/oauth',
};

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
