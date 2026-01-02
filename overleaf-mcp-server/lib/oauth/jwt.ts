/**
 * @fileoverview JWT token generation and validation.
 * @module lib/oauth/jwt
 */

import { createHmac, randomUUID } from 'crypto';
import { oauthConfig } from './config.js';
import type { JWTPayload } from './types.js';

/**
 * Base64URL encode a string.
 */
function base64UrlEncode(str: string): string {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Base64URL decode a string.
 */
function base64UrlDecode(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = str.length % 4;
    if (pad) {
        str += '='.repeat(4 - pad);
    }
    return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Sign data with HMAC-SHA256.
 */
function sign(data: string, secret: string): string {
    return createHmac('sha256', secret)
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Generate a JWT access token.
 */
export function generateAccessToken(payload: {
    userId: string;
    clientId: string;
    scope: string;
}): { token: string; jti: string; expiresAt: Date } {
    const now = Math.floor(Date.now() / 1000);
    const jti = randomUUID();
    const expiresAt = new Date((now + oauthConfig.accessTokenTTL) * 1000);

    const jwtPayload: JWTPayload = {
        iss: oauthConfig.issuer,
        sub: payload.userId,
        aud: oauthConfig.issuer,
        exp: now + oauthConfig.accessTokenTTL,
        iat: now,
        jti,
        scope: payload.scope,
        client_id: payload.clientId,
    };

    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify(jwtPayload));
    const signature = sign(`${header}.${body}`, oauthConfig.jwtSecret);

    return {
        token: `${header}.${body}.${signature}`,
        jti,
        expiresAt,
    };
}

/**
 * Generate a refresh token.
 */
export function generateRefreshToken(): { token: string; jti: string; expiresAt: Date } {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + oauthConfig.refreshTokenTTL * 1000);

    // Refresh token is just a signed reference to the jti
    const payload = { jti, type: 'refresh', exp: Math.floor(expiresAt.getTime() / 1000) };
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify(payload));
    const signature = sign(`${header}.${body}`, oauthConfig.jwtSecret);

    return {
        token: `${header}.${body}.${signature}`,
        jti,
        expiresAt,
    };
}

/**
 * Verify and decode a JWT token.
 * @returns Decoded payload or null if invalid
 */
export function verifyAccessToken(token: string): JWTPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [header, body, signature] = parts;

        // Verify signature
        const expectedSignature = sign(`${header}.${body}`, oauthConfig.jwtSecret);
        if (signature !== expectedSignature) return null;

        // Decode payload
        const payload: JWTPayload = JSON.parse(base64UrlDecode(body));

        // Check expiration
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;

        // Check issuer
        if (payload.iss !== oauthConfig.issuer) return null;

        return payload;
    } catch {
        return null;
    }
}

/**
 * Decode a refresh token and get the jti.
 */
export function decodeRefreshToken(token: string): { jti: string } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [header, body, signature] = parts;

        // Verify signature
        const expectedSignature = sign(`${header}.${body}`, oauthConfig.jwtSecret);
        if (signature !== expectedSignature) return null;

        // Decode payload
        const payload = JSON.parse(base64UrlDecode(body));

        // Check expiration
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;

        return { jti: payload.jti };
    } catch {
        return null;
    }
}
