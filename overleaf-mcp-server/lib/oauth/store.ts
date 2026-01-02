/**
 * @fileoverview Persistent storage for OAuth entities (clients, users, tokens, codes).
 * Uses file-based JSON storage, upgradeable to database.
 * @module lib/oauth/store
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { createHash, randomUUID } from 'crypto';
import { oauthConfig } from './config.js';
import type {
    OAuthClient,
    OAuthUser,
    StoredToken,
    AuthorizationCode,
} from './types.js';

// ============================================
// Storage Paths
// ============================================

const DATA_DIR = oauthConfig.dataDir;
const CLIENTS_FILE = join(DATA_DIR, 'clients.json');
const USERS_FILE = join(DATA_DIR, 'users.json');
const TOKENS_FILE = join(DATA_DIR, 'tokens.json');
const CODES_FILE = join(DATA_DIR, 'codes.json');

// ============================================
// In-memory cache (loaded from disk)
// ============================================

let clients: Map<string, OAuthClient> = new Map();
let users: Map<string, OAuthUser> = new Map();
let tokens: Map<string, StoredToken> = new Map();
let codes: Map<string, AuthorizationCode> = new Map();
let initialized = false;

// ============================================
// Initialization
// ============================================

/**
 * Initialize storage, loading from disk.
 */
export async function initializeStore(): Promise<void> {
    if (initialized) return;

    try {
        // Ensure data directory exists
        if (!existsSync(DATA_DIR)) {
            await mkdir(DATA_DIR, { recursive: true });
        }

        // Load existing data
        clients = await loadJson<OAuthClient>(CLIENTS_FILE);
        users = await loadJson<OAuthUser>(USERS_FILE);
        tokens = await loadJson<StoredToken>(TOKENS_FILE);
        codes = await loadJson<AuthorizationCode>(CODES_FILE);

        // Create admin user if configured
        if (oauthConfig.adminEmail && oauthConfig.adminPassword) {
            const existing = Array.from(users.values()).find(
                u => u.email === oauthConfig.adminEmail
            );
            if (!existing) {
                await createUser({
                    email: oauthConfig.adminEmail,
                    password: oauthConfig.adminPassword,
                    displayName: 'Admin',
                });
            }
        }

        initialized = true;
    } catch (error) {
        console.error('[OAuth Store] Initialization error:', error);
        throw error;
    }
}

async function loadJson<T>(path: string): Promise<Map<string, T>> {
    try {
        if (existsSync(path)) {
            const data = await readFile(path, 'utf8');
            const parsed = JSON.parse(data);
            return new Map(Object.entries(parsed));
        }
    } catch {
        // File doesn't exist or is invalid
    }
    return new Map();
}

async function saveJson<T>(path: string, data: Map<string, T>): Promise<void> {
    const obj = Object.fromEntries(data);
    await writeFile(path, JSON.stringify(obj, null, 2), 'utf8');
}

// ============================================
// Password Hashing
// ============================================

function hashPassword(password: string): string {
    return createHash('sha256').update(password + oauthConfig.jwtSecret).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
    return hashPassword(password) === hash;
}

// ============================================
// Client Operations
// ============================================

export async function createClient(data: {
    clientName: string;
    redirectUris: string[];
    grantTypes?: string[];
}): Promise<{ client: OAuthClient; clientSecret: string }> {
    await initializeStore();

    const clientId = randomUUID();
    const clientSecret = randomUUID() + randomUUID();
    const now = new Date().toISOString();

    const client: OAuthClient = {
        client_id: clientId,
        client_secret_hash: hashPassword(clientSecret),
        client_name: data.clientName,
        redirect_uris: data.redirectUris,
        grant_types: (data.grantTypes || ['authorization_code', 'refresh_token']) as any,
        response_types: ['code'],
        scope: oauthConfig.defaultScopes,
        created_at: now,
        updated_at: now,
    };

    clients.set(clientId, client);
    await saveJson(CLIENTS_FILE, clients);

    return { client, clientSecret };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
    await initializeStore();
    return clients.get(clientId) || null;
}

export async function verifyClientSecret(clientId: string, secret: string): Promise<boolean> {
    const client = await getClient(clientId);
    if (!client) return false;
    return verifyPassword(secret, client.client_secret_hash);
}

// ============================================
// User Operations
// ============================================

export async function createUser(data: {
    email: string;
    password: string;
    displayName: string;
}): Promise<OAuthUser> {
    await initializeStore();

    // Check if email exists
    const existing = Array.from(users.values()).find(u => u.email === data.email);
    if (existing) {
        throw new Error('Email already registered');
    }

    const userId = randomUUID();
    const now = new Date().toISOString();

    const user: OAuthUser = {
        user_id: userId,
        email: data.email,
        password_hash: hashPassword(data.password),
        display_name: data.displayName,
        created_at: now,
        updated_at: now,
    };

    users.set(userId, user);
    await saveJson(USERS_FILE, users);

    return user;
}

export async function getUser(userId: string): Promise<OAuthUser | null> {
    await initializeStore();
    return users.get(userId) || null;
}

export async function getUserByEmail(email: string): Promise<OAuthUser | null> {
    await initializeStore();
    return Array.from(users.values()).find(u => u.email === email) || null;
}

export async function verifyUserPassword(email: string, password: string): Promise<OAuthUser | null> {
    const user = await getUserByEmail(email);
    if (!user) return null;
    if (!verifyPassword(password, user.password_hash)) return null;

    // Update last login
    user.last_login = new Date().toISOString();
    users.set(user.user_id, user);
    await saveJson(USERS_FILE, users);

    return user;
}

// ============================================
// Authorization Code Operations
// ============================================

export async function createAuthorizationCode(data: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scope: string;
    codeChallenge: string;
}): Promise<string> {
    await initializeStore();

    const code = randomUUID() + randomUUID();
    const expiresAt = new Date(Date.now() + oauthConfig.codeTTL * 1000).toISOString();

    const authCode: AuthorizationCode = {
        code,
        client_id: data.clientId,
        user_id: data.userId,
        redirect_uri: data.redirectUri,
        scope: data.scope,
        code_challenge: data.codeChallenge,
        code_challenge_method: 'S256',
        expires_at: expiresAt,
        used: false,
    };

    codes.set(code, authCode);
    await saveJson(CODES_FILE, codes);

    return code;
}

export async function getAuthorizationCode(code: string): Promise<AuthorizationCode | null> {
    await initializeStore();
    return codes.get(code) || null;
}

export async function markCodeUsed(code: string): Promise<void> {
    await initializeStore();
    const authCode = codes.get(code);
    if (authCode) {
        authCode.used = true;
        codes.set(code, authCode);
        await saveJson(CODES_FILE, codes);
    }
}

// ============================================
// Token Operations
// ============================================

export async function storeToken(data: {
    jti: string;
    tokenType: 'access' | 'refresh';
    userId: string;
    clientId: string;
    scope: string;
    expiresAt: Date;
}): Promise<void> {
    await initializeStore();

    const token: StoredToken = {
        jti: data.jti,
        token_type: data.tokenType,
        user_id: data.userId,
        client_id: data.clientId,
        scope: data.scope,
        issued_at: new Date().toISOString(),
        expires_at: data.expiresAt.toISOString(),
        revoked: false,
    };

    tokens.set(data.jti, token);
    await saveJson(TOKENS_FILE, tokens);
}

export async function getToken(jti: string): Promise<StoredToken | null> {
    await initializeStore();
    return tokens.get(jti) || null;
}

export async function revokeToken(jti: string): Promise<void> {
    await initializeStore();
    const token = tokens.get(jti);
    if (token) {
        token.revoked = true;
        tokens.set(jti, token);
        await saveJson(TOKENS_FILE, tokens);
    }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
    await initializeStore();
    for (const [jti, token] of tokens) {
        if (token.user_id === userId) {
            token.revoked = true;
            tokens.set(jti, token);
        }
    }
    await saveJson(TOKENS_FILE, tokens);
}

// ============================================
// Cleanup
// ============================================

export async function cleanupExpiredEntries(): Promise<void> {
    await initializeStore();
    const now = new Date().toISOString();

    // Clean expired codes
    for (const [code, authCode] of codes) {
        if (authCode.expires_at < now || authCode.used) {
            codes.delete(code);
        }
    }
    await saveJson(CODES_FILE, codes);

    // Clean expired tokens
    for (const [jti, token] of tokens) {
        if (token.expires_at < now || token.revoked) {
            tokens.delete(jti);
        }
    }
    await saveJson(TOKENS_FILE, tokens);
}

// Run cleanup every hour
setInterval(cleanupExpiredEntries, 60 * 60 * 1000);
