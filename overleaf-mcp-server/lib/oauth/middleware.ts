/**
 * @fileoverview Bearer token validation middleware for MCP routes.
 * @module lib/oauth/middleware
 */

import { verifyAccessToken } from './jwt.js';
import { getToken, getUser } from './store.js';
import { oauthConfig } from './config.js';
import type { JWTPayload, OAuthUser } from './types.js';

/**
 * Validated request context after OAuth middleware.
 */
export interface OAuthContext {
    user: OAuthUser;
    token: JWTPayload;
    scopes: string[];
}

/**
 * Extract and validate Bearer token from Authorization header.
 * 
 * @param authHeader - Authorization header value
 * @returns OAuth context if valid, null otherwise
 */
export async function validateBearerToken(authHeader: string | null): Promise<OAuthContext | null> {
    if (!oauthConfig.enabled) {
        // OAuth disabled, allow all requests
        return null;
    }

    if (!authHeader) {
        return null;
    }

    // Extract token from "Bearer <token>"
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7);
    if (!token) {
        return null;
    }

    // Verify JWT
    const payload = verifyAccessToken(token);
    if (!payload) {
        return null;
    }

    // Check if token is revoked
    const storedToken = await getToken(payload.jti);
    if (!storedToken || storedToken.revoked) {
        return null;
    }

    // Get user
    const user = await getUser(payload.sub);
    if (!user) {
        return null;
    }

    return {
        user,
        token: payload,
        scopes: payload.scope.split(' '),
    };
}

/**
 * Check if context has required scope.
 */
export function hasScope(context: OAuthContext, requiredScope: string): boolean {
    return context.scopes.includes(requiredScope) || context.scopes.includes('admin');
}

/**
 * Check if OAuth is enabled.
 */
export function isOAuthEnabled(): boolean {
    return oauthConfig.enabled;
}

/**
 * Get user ID from context (for multi-user project isolation).
 */
export function getUserId(context: OAuthContext | null): string | null {
    return context?.user?.user_id || null;
}
