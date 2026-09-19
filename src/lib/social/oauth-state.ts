import crypto from 'crypto';

interface OAuthStatePayload {
  workspaceId: string;
  userId: string;
  provider: 'meta' | 'linkedin';
  timestamp: number;
  nonce: string;
}

function getSecretKey(): string {
  return process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'dailybuz-social-oauth-signing-secret';
}

/**
 * Creates a cryptographically signed state token for OAuth flows.
 */
export function generateOAuthState(workspaceId: string, userId: string, provider: 'meta' | 'linkedin'): string {
  const payload: OAuthStatePayload = {
    workspaceId,
    userId,
    provider,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const json = JSON.stringify(payload);
  const base64Payload = Buffer.from(json).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecretKey())
    .update(base64Payload)
    .digest('base64url');

  return `${base64Payload}.${signature}`;
}

/**
 * Validates and unpacks an OAuth state token.
 * Rejects expired (> 15 minutes) or tampered states.
 */
export function verifyOAuthState(stateStr: string): OAuthStatePayload | null {
  if (!stateStr || typeof stateStr !== 'string') return null;

  const parts = stateStr.split('.');
  if (parts.length !== 2) return null;

  const [base64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSecretKey())
    .update(base64Payload)
    .digest('base64url');

  if (signature !== expectedSig) {
    console.error('[OAuthState] Invalid state signature');
    return null;
  }

  try {
    const raw = Buffer.from(base64Payload, 'base64url').toString('utf8');
    const payload = JSON.parse(raw) as OAuthStatePayload;

    // Reject states older than 15 minutes
    const maxAgeMs = 15 * 60 * 1000;
    if (Date.now() - payload.timestamp > maxAgeMs) {
      console.error('[OAuthState] Expired state parameter');
      return null;
    }

    return payload;
  } catch (err) {
    console.error('[OAuthState] Failed to decode state payload:', err);
    return null;
  }
}
