/**
 * @fileoverview OAuth 2.1 HTTP endpoint handlers.
 * @module lib/oauth/handlers
 */

import { oauthConfig, getOAuthEndpoints } from './config.js';
import {
    createClient,
    getClient,
    verifyClientSecret,
    createUser,
    verifyUserPassword,
    createAuthorizationCode,
    getAuthorizationCode,
    markCodeUsed,
    storeToken,
    getToken,
    revokeToken,
    initializeStore,
} from './store.js';
import { generateAccessToken, generateRefreshToken, decodeRefreshToken } from './jwt.js';
import { verifyCodeChallenge } from './pkce.js';
import type {
    AuthorizationServerMetadata,
    ClientRegistrationResponse,
    TokenResponse,
    OAuthError,
} from './types.js';

// ============================================
// Server Metadata (RFC 8414)
// ============================================

/**
 * GET /.well-known/oauth-authorization-server
 */
export function handleMetadata(): AuthorizationServerMetadata {
    const endpoints = getOAuthEndpoints();

    return {
        issuer: endpoints.issuer,
        authorization_endpoint: endpoints.authorization_endpoint,
        token_endpoint: endpoints.token_endpoint,
        registration_endpoint: endpoints.registration_endpoint,
        revocation_endpoint: endpoints.revocation_endpoint,
        scopes_supported: oauthConfig.supportedScopes,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    };
}

// ============================================
// Dynamic Client Registration (RFC 7591)
// ============================================

/**
 * POST /register
 */
export async function handleClientRegistration(body: {
    client_name: string;
    redirect_uris: string[];
    grant_types?: string[];
}): Promise<ClientRegistrationResponse> {
    await initializeStore();

    if (!body.client_name || !body.redirect_uris?.length) {
        throw createOAuthError('invalid_request', 'client_name and redirect_uris are required');
    }

    // Validate redirect URIs (must be HTTPS or localhost)
    for (const uri of body.redirect_uris) {
        if (!uri.startsWith('https://') && !uri.startsWith('http://localhost')) {
            throw createOAuthError('invalid_request', 'redirect_uris must be HTTPS or localhost');
        }
    }

    const { client, clientSecret } = await createClient({
        clientName: body.client_name,
        redirectUris: body.redirect_uris,
        grantTypes: body.grant_types,
    });

    return {
        client_id: client.client_id,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(new Date(client.created_at).getTime() / 1000),
        client_secret_expires_at: 0, // Never expires
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types,
        response_types: client.response_types,
        client_name: client.client_name,
    };
}

// ============================================
// Authorization Endpoint
// ============================================

/**
 * GET /authorize - Returns HTML login/consent page
 */
export function handleAuthorizeGet(params: {
    response_type: string;
    client_id: string;
    redirect_uri: string;
    scope?: string;
    state: string;
    code_challenge: string;
    code_challenge_method: string;
}): string {
    // Validate required params
    if (params.response_type !== 'code') {
        return errorPage('unsupported_response_type', 'Only "code" response type is supported');
    }
    if (!params.client_id) {
        return errorPage('invalid_request', 'client_id is required');
    }
    if (!params.state) {
        return errorPage('invalid_request', 'state is required');
    }
    if (!params.code_challenge || params.code_challenge_method !== 'S256') {
        return errorPage('invalid_request', 'PKCE with S256 is required');
    }

    // Return login/consent HTML
    return getConsentPage({
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        scope: params.scope || oauthConfig.defaultScopes,
        state: params.state,
        codeChallenge: params.code_challenge,
    });
}

/**
 * POST /authorize - Process login form
 */
export async function handleAuthorizePost(body: {
    email: string;
    password: string;
    action: 'login' | 'register';
    display_name?: string;
    client_id: string;
    redirect_uri: string;
    scope: string;
    state: string;
    code_challenge: string;
}): Promise<{ redirectUrl: string } | { error: string; html: string }> {
    await initializeStore();

    // Validate client
    const client = await getClient(body.client_id);
    if (!client) {
        return { error: 'invalid_client', html: errorPage('invalid_client', 'Unknown client') };
    }

    // Validate redirect URI
    if (!client.redirect_uris.includes(body.redirect_uri)) {
        return { error: 'invalid_request', html: errorPage('invalid_request', 'Invalid redirect_uri') };
    }

    let user;

    if (body.action === 'register') {
        // Register new user
        if (!body.display_name) {
            return {
                error: 'invalid_request',
                html: getConsentPage({
                    clientId: body.client_id,
                    redirectUri: body.redirect_uri,
                    scope: body.scope,
                    state: body.state,
                    codeChallenge: body.code_challenge,
                    error: 'Display name is required for registration',
                }),
            };
        }

        try {
            user = await createUser({
                email: body.email,
                password: body.password,
                displayName: body.display_name,
            });
        } catch (e: any) {
            return {
                error: 'registration_failed',
                html: getConsentPage({
                    clientId: body.client_id,
                    redirectUri: body.redirect_uri,
                    scope: body.scope,
                    state: body.state,
                    codeChallenge: body.code_challenge,
                    error: e.message || 'Registration failed',
                }),
            };
        }
    } else {
        // Login existing user
        user = await verifyUserPassword(body.email, body.password);
        if (!user) {
            return {
                error: 'invalid_credentials',
                html: getConsentPage({
                    clientId: body.client_id,
                    redirectUri: body.redirect_uri,
                    scope: body.scope,
                    state: body.state,
                    codeChallenge: body.code_challenge,
                    error: 'Invalid email or password',
                }),
            };
        }
    }

    // Generate authorization code
    const code = await createAuthorizationCode({
        clientId: body.client_id,
        userId: user.user_id,
        redirectUri: body.redirect_uri,
        scope: body.scope,
        codeChallenge: body.code_challenge,
    });

    // Redirect with code
    const redirectUrl = new URL(body.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', body.state);

    return { redirectUrl: redirectUrl.toString() };
}

// ============================================
// Token Endpoint
// ============================================

/**
 * POST /token
 */
export async function handleToken(body: {
    grant_type: string;
    code?: string;
    redirect_uri?: string;
    client_id: string;
    client_secret?: string;
    code_verifier?: string;
    refresh_token?: string;
}): Promise<TokenResponse> {
    await initializeStore();

    // Validate client
    const client = await getClient(body.client_id);
    if (!client) {
        throw createOAuthError('invalid_client', 'Unknown client');
    }

    // Verify client secret if provided
    if (body.client_secret && !(await verifyClientSecret(body.client_id, body.client_secret))) {
        throw createOAuthError('invalid_client', 'Invalid client credentials');
    }

    if (body.grant_type === 'authorization_code') {
        return handleAuthorizationCodeGrant(body, client);
    } else if (body.grant_type === 'refresh_token') {
        return handleRefreshTokenGrant(body, client);
    } else {
        throw createOAuthError('unsupported_grant_type', `Grant type "${body.grant_type}" is not supported`);
    }
}

async function handleAuthorizationCodeGrant(body: any, client: any): Promise<TokenResponse> {
    if (!body.code || !body.code_verifier || !body.redirect_uri) {
        throw createOAuthError('invalid_request', 'code, code_verifier, and redirect_uri are required');
    }

    // Get and validate authorization code
    const authCode = await getAuthorizationCode(body.code);
    if (!authCode) {
        throw createOAuthError('invalid_grant', 'Invalid or expired authorization code');
    }

    if (authCode.used) {
        throw createOAuthError('invalid_grant', 'Authorization code has already been used');
    }

    if (authCode.client_id !== body.client_id) {
        throw createOAuthError('invalid_grant', 'Authorization code was not issued to this client');
    }

    if (authCode.redirect_uri !== body.redirect_uri) {
        throw createOAuthError('invalid_grant', 'redirect_uri does not match');
    }

    if (new Date(authCode.expires_at) < new Date()) {
        throw createOAuthError('invalid_grant', 'Authorization code has expired');
    }

    // Verify PKCE
    if (!verifyCodeChallenge(body.code_verifier, authCode.code_challenge, 'S256')) {
        throw createOAuthError('invalid_grant', 'PKCE verification failed');
    }

    // Mark code as used
    await markCodeUsed(body.code);

    // Generate tokens
    const accessToken = generateAccessToken({
        userId: authCode.user_id,
        clientId: authCode.client_id,
        scope: authCode.scope,
    });

    const refreshToken = generateRefreshToken();

    // Store tokens
    await storeToken({
        jti: accessToken.jti,
        tokenType: 'access',
        userId: authCode.user_id,
        clientId: authCode.client_id,
        scope: authCode.scope,
        expiresAt: accessToken.expiresAt,
    });

    await storeToken({
        jti: refreshToken.jti,
        tokenType: 'refresh',
        userId: authCode.user_id,
        clientId: authCode.client_id,
        scope: authCode.scope,
        expiresAt: refreshToken.expiresAt,
    });

    return {
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: oauthConfig.accessTokenTTL,
        refresh_token: refreshToken.token,
        scope: authCode.scope,
    };
}

async function handleRefreshTokenGrant(body: any, client: any): Promise<TokenResponse> {
    if (!body.refresh_token) {
        throw createOAuthError('invalid_request', 'refresh_token is required');
    }

    // Decode and validate refresh token
    const decoded = decodeRefreshToken(body.refresh_token);
    if (!decoded) {
        throw createOAuthError('invalid_grant', 'Invalid or expired refresh token');
    }

    // Check if token exists and is valid
    const storedToken = await getToken(decoded.jti);
    if (!storedToken || storedToken.revoked || storedToken.token_type !== 'refresh') {
        throw createOAuthError('invalid_grant', 'Refresh token has been revoked');
    }

    if (storedToken.client_id !== body.client_id) {
        throw createOAuthError('invalid_grant', 'Refresh token was not issued to this client');
    }

    // Revoke old refresh token (rotation)
    await revokeToken(decoded.jti);

    // Generate new tokens
    const accessToken = generateAccessToken({
        userId: storedToken.user_id,
        clientId: storedToken.client_id,
        scope: storedToken.scope,
    });

    const newRefreshToken = generateRefreshToken();

    // Store new tokens
    await storeToken({
        jti: accessToken.jti,
        tokenType: 'access',
        userId: storedToken.user_id,
        clientId: storedToken.client_id,
        scope: storedToken.scope,
        expiresAt: accessToken.expiresAt,
    });

    await storeToken({
        jti: newRefreshToken.jti,
        tokenType: 'refresh',
        userId: storedToken.user_id,
        clientId: storedToken.client_id,
        scope: storedToken.scope,
        expiresAt: newRefreshToken.expiresAt,
    });

    return {
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: oauthConfig.accessTokenTTL,
        refresh_token: newRefreshToken.token,
        scope: storedToken.scope,
    };
}

// ============================================
// Revocation Endpoint
// ============================================

/**
 * POST /revoke
 */
export async function handleRevoke(body: {
    token: string;
    token_type_hint?: string;
    client_id: string;
    client_secret?: string;
}): Promise<void> {
    await initializeStore();

    // Validate client
    if (body.client_secret && !(await verifyClientSecret(body.client_id, body.client_secret))) {
        throw createOAuthError('invalid_client', 'Invalid client credentials');
    }

    // Try to decode as access token or refresh token
    const decoded = decodeRefreshToken(body.token);
    if (decoded) {
        await revokeToken(decoded.jti);
    }
    // Even if token is invalid, return success (RFC 7009)
}

// ============================================
// Helper Functions
// ============================================

function createOAuthError(error: string, description: string): OAuthError & Error {
    const err = new Error(description) as any;
    err.error = error;
    err.error_description = description;
    return err;
}

function errorPage(error: string, description: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Error - Overleaf MCP</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #1a1a2e; color: #eee; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .error { background: #16213e; padding: 2rem; border-radius: 12px; text-align: center; max-width: 400px; }
    h1 { color: #e94560; margin-bottom: 0.5rem; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="error">
    <h1>Error: ${error}</h1>
    <p>${description}</p>
  </div>
</body>
</html>`;
}

function getConsentPage(params: {
    clientId: string;
    redirectUri: string;
    scope: string;
    state: string;
    codeChallenge: string;
    error?: string;
}): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Sign In - Overleaf MCP</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #eee; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 1rem; }
    .container { background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); padding: 2rem; border-radius: 16px; width: 100%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    h1 { text-align: center; margin: 0 0 0.5rem; font-size: 1.5rem; }
    .subtitle { text-align: center; color: #888; margin-bottom: 1.5rem; font-size: 0.9rem; }
    .scopes { background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
    .scopes h3 { margin: 0 0 0.5rem; font-size: 0.85rem; color: #888; }
    .scope-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .scope { background: #4361ee; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; }
    .tabs { display: flex; margin-bottom: 1.5rem; }
    .tab { flex: 1; padding: 0.75rem; text-align: center; cursor: pointer; border: none; background: none; color: #888; font-size: 1rem; border-bottom: 2px solid transparent; }
    .tab.active { color: #4361ee; border-bottom-color: #4361ee; }
    input { width: 100%; padding: 0.875rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: rgba(255,255,255,0.05); color: #fff; font-size: 1rem; }
    input:focus { outline: none; border-color: #4361ee; }
    input::placeholder { color: #666; }
    button[type="submit"] { width: 100%; padding: 1rem; background: linear-gradient(135deg, #4361ee 0%, #3f37c9 100%); border: none; border-radius: 8px; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
    button[type="submit"]:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(67,97,238,0.4); }
    .error-msg { background: rgba(229,62,62,0.2); color: #fc8181; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
    .register-fields { display: none; }
    .register-fields.show { display: block; }
    .footer { text-align: center; margin-top: 1.5rem; font-size: 0.8rem; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Overleaf MCP</h1>
    <p class="subtitle">LaTeX Project Management Server</p>
    
    <div class="scopes">
      <h3>Requested Permissions:</h3>
      <div class="scope-list">
        ${params.scope.split(' ').map(s => `<span class="scope">${s}</span>`).join('')}
      </div>
    </div>

    ${params.error ? `<div class="error-msg">${params.error}</div>` : ''}

    <div class="tabs">
      <button class="tab active" onclick="showTab('login')">Sign In</button>
      <button class="tab" onclick="showTab('register')">Register</button>
    </div>

    <form method="POST" action="/authorize">
      <input type="hidden" name="client_id" value="${params.clientId}">
      <input type="hidden" name="redirect_uri" value="${params.redirectUri}">
      <input type="hidden" name="scope" value="${params.scope}">
      <input type="hidden" name="state" value="${params.state}">
      <input type="hidden" name="code_challenge" value="${params.codeChallenge}">
      <input type="hidden" name="action" id="action" value="login">

      <div class="register-fields" id="registerFields">
        <input type="text" name="display_name" placeholder="Display Name">
      </div>

      <input type="email" name="email" placeholder="Email" required>
      <input type="password" name="password" placeholder="Password" required>
      
      <button type="submit" id="submitBtn">Sign In</button>
    </form>

    <div class="footer">
      Powered by Overleaf MCP Server
    </div>
  </div>

  <script>
    function showTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('action').value = tab;
      document.getElementById('registerFields').classList.toggle('show', tab === 'register');
      document.getElementById('submitBtn').textContent = tab === 'login' ? 'Sign In' : 'Create Account';
    }
  </script>
</body>
</html>`;
}

export { createOAuthError };
