/**
 * @fileoverview PKCE (Proof Key for Code Exchange) utilities.
 * @module lib/oauth/pkce
 */

import { createHash, randomBytes } from 'crypto';

/**
 * Generate a cryptographically random code verifier.
 * @returns 43-128 character URL-safe string
 */
export function generateCodeVerifier(): string {
    return randomBytes(32)
        .toString('base64url')
        .slice(0, 43);
}

/**
 * Generate code challenge from verifier using S256 method.
 * @param verifier - The code verifier
 * @returns Base64URL-encoded SHA256 hash
 */
export function generateCodeChallenge(verifier: string): string {
    return createHash('sha256')
        .update(verifier)
        .digest('base64url');
}

/**
 * Verify PKCE code challenge.
 * @param verifier - The code verifier from token request
 * @param challenge - The code challenge from authorization request
 * @param method - Challenge method (only S256 supported)
 * @returns Whether verification passed
 */
export function verifyCodeChallenge(
    verifier: string,
    challenge: string,
    method: string = 'S256'
): boolean {
    if (method !== 'S256') {
        throw new Error('Only S256 code challenge method is supported');
    }

    const computedChallenge = generateCodeChallenge(verifier);
    return computedChallenge === challenge;
}

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState(): string {
    return randomBytes(16).toString('base64url');
}

/**
 * Generate a random authorization code.
 */
export function generateAuthorizationCode(): string {
    return randomBytes(32).toString('base64url');
}
