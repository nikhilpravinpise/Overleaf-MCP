/**
 * @fileoverview OAuth 2.1 module exports.
 * @module lib/oauth
 */

// Configuration
export { oauthConfig, getOAuthEndpoints } from './config.js';

// Types
export type {
    OAuthClient,
    OAuthUser,
    StoredToken,
    AuthorizationCode,
    AuthorizationRequest,
    TokenRequest,
    TokenResponse,
    AuthorizationServerMetadata,
    ClientRegistrationRequest,
    ClientRegistrationResponse,
    OAuthError,
    OAuthErrorCode,
    JWTPayload,
    GrantType,
    ResponseType,
} from './types.js';

// JWT
export { generateAccessToken, generateRefreshToken, verifyAccessToken, decodeRefreshToken } from './jwt.js';

// PKCE
export { generateCodeVerifier, generateCodeChallenge, verifyCodeChallenge, generateState, generateAuthorizationCode } from './pkce.js';

// Store
export {
    initializeStore,
    createClient,
    getClient,
    verifyClientSecret,
    createUser,
    getUser,
    getUserByEmail,
    verifyUserPassword,
    createAuthorizationCode,
    getAuthorizationCode,
    markCodeUsed,
    storeToken,
    getToken,
    revokeToken,
    revokeAllUserTokens,
    cleanupExpiredEntries,
} from './store.js';

// Handlers
export {
    handleMetadata,
    handleClientRegistration,
    handleAuthorizeGet,
    handleAuthorizePost,
    handleToken,
    handleRevoke,
    createOAuthError,
} from './handlers.js';

// Middleware
export {
    validateBearerToken,
    hasScope,
    isOAuthEnabled,
    getUserId,
} from './middleware.js';
export type { OAuthContext } from './middleware.js';
