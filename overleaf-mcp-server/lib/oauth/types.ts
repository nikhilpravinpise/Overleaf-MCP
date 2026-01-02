/**
 * @fileoverview OAuth 2.1 TypeScript type definitions.
 * @module lib/oauth/types
 */

// ============================================
// Client Types
// ============================================

/**
 * OAuth 2.0 registered client (Dynamic Client Registration).
 */
export interface OAuthClient {
    client_id: string;
    client_secret_hash: string;
    client_name: string;
    redirect_uris: string[];
    grant_types: GrantType[];
    response_types: ResponseType[];
    scope: string;
    created_at: string;
    updated_at: string;
}

export type GrantType = 'authorization_code' | 'refresh_token' | 'client_credentials';
export type ResponseType = 'code' | 'token';

/**
 * Client registration request (RFC 7591).
 */
export interface ClientRegistrationRequest {
    client_name: string;
    redirect_uris: string[];
    grant_types?: GrantType[];
    response_types?: ResponseType[];
    scope?: string;
    token_endpoint_auth_method?: 'client_secret_basic' | 'client_secret_post' | 'none';
}

/**
 * Client registration response.
 */
export interface ClientRegistrationResponse {
    client_id: string;
    client_secret?: string;
    client_id_issued_at: number;
    client_secret_expires_at: number;
    redirect_uris: string[];
    grant_types: GrantType[];
    response_types: ResponseType[];
    client_name: string;
}

// ============================================
// User Types
// ============================================

/**
 * User account for multi-user support.
 */
export interface OAuthUser {
    user_id: string;
    email: string;
    password_hash: string;
    display_name: string;
    created_at: string;
    updated_at: string;
    last_login?: string;
}

// ============================================
// Token Types
// ============================================

/**
 * Access token stored in database.
 */
export interface StoredToken {
    jti: string;
    token_type: 'access' | 'refresh';
    user_id: string;
    client_id: string;
    scope: string;
    issued_at: string;
    expires_at: string;
    revoked: boolean;
}

/**
 * Token response (RFC 6749).
 */
export interface TokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token?: string;
    scope?: string;
}

/**
 * JWT payload structure.
 */
export interface JWTPayload {
    iss: string;
    sub: string;
    aud: string;
    exp: number;
    iat: number;
    jti: string;
    scope: string;
    client_id: string;
}

// ============================================
// Authorization Code Types
// ============================================

/**
 * Authorization code for OAuth flow.
 */
export interface AuthorizationCode {
    code: string;
    client_id: string;
    user_id: string;
    redirect_uri: string;
    scope: string;
    code_challenge: string;
    code_challenge_method: 'S256';
    expires_at: string;
    used: boolean;
}

// ============================================
// Request Types
// ============================================

/**
 * Authorization request parameters.
 */
export interface AuthorizationRequest {
    response_type: 'code';
    client_id: string;
    redirect_uri: string;
    scope?: string;
    state: string;
    code_challenge: string;
    code_challenge_method: 'S256';
}

/**
 * Token request parameters.
 */
export interface TokenRequest {
    grant_type: GrantType;
    code?: string;
    redirect_uri?: string;
    client_id: string;
    client_secret?: string;
    code_verifier?: string;
    refresh_token?: string;
    scope?: string;
}

// ============================================
// Server Metadata Types (RFC 8414)
// ============================================

/**
 * OAuth 2.0 Authorization Server Metadata.
 */
export interface AuthorizationServerMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint?: string;
    revocation_endpoint?: string;
    scopes_supported: string[];
    response_types_supported: ResponseType[];
    grant_types_supported: GrantType[];
    code_challenge_methods_supported: string[];
    token_endpoint_auth_methods_supported: string[];
}

// ============================================
// Error Types
// ============================================

/**
 * OAuth error response.
 */
export interface OAuthError {
    error: OAuthErrorCode;
    error_description?: string;
    error_uri?: string;
}

export type OAuthErrorCode =
    | 'invalid_request'
    | 'unauthorized_client'
    | 'access_denied'
    | 'unsupported_response_type'
    | 'invalid_scope'
    | 'server_error'
    | 'temporarily_unavailable'
    | 'invalid_client'
    | 'invalid_grant'
    | 'unsupported_grant_type';
