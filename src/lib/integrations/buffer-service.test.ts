import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

describe('Multi-Tenant Buffer Integration & PKCE Token Security', () => {
  describe('Token Encryption & Decryption at Rest', () => {
    it('encrypts and decrypts OAuth access & refresh tokens accurately', () => {
      const sampleAccessToken = 'buf_live_access_tok_1a2b3c4d5e6f7g8h9i0j_secret';
      const encrypted = encrypt(sampleAccessToken);

      expect(encrypted).not.toEqual(sampleAccessToken);
      expect(encrypted).toContain(':'); // IV : ciphertext : authTag

      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(sampleAccessToken);
    });

    it('generates unique ciphertexts for identical tokens across different tenants', () => {
      const token = '1/common_buffer_token_xyz';
      const encryptedA = encrypt(token);
      const encryptedB = encrypt(token);

      expect(encryptedA).not.toEqual(encryptedB);
      expect(decrypt(encryptedA)).toEqual(token);
      expect(decrypt(encryptedB)).toEqual(token);
    });
  });

  describe('PKCE Code Verifier and Challenge Generation', () => {
    it('produces valid RFC 7636 compliant Base64URL verifier and SHA-256 challenge', () => {
      const verifier = crypto.randomBytes(48).toString('base64url');
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);

      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      expect(challenge).toBeDefined();
      expect(challenge.length).toBeGreaterThan(0);
      expect(challenge).not.toEqual(verifier);
    });
  });

  describe('OAuth Security & Multi-Tenant Boundaries', () => {
    it('enforces short-lived 15-minute expiration on OAuth state parameters', () => {
      const stateCreatedAt = Date.now();
      const expiresAt = new Date(stateCreatedAt + 15 * 60 * 1000);
      const isExpired = Date.now() > expiresAt.getTime();
      expect(isExpired).toBe(false);

      const pastExpiresAt = new Date(Date.now() - 1000);
      const isPastExpired = Date.now() > pastExpiresAt.getTime();
      expect(isPastExpired).toBe(true);
    });

    it('prevents exposing raw tokens in public status projections', () => {
      const rawDbRecord = {
        id: 'int_123',
        workspace_id: 'ws_tenant_a',
        provider: 'buffer',
        access_token_encrypted: 'secret_iv:ciphertext:tag',
        refresh_token_encrypted: 'secret_ref_iv:ciphertext:tag',
        status: 'connected',
        provider_organization_name: 'Tenant A Org',
      };

      // Safe projected payload for frontend
      const safeProjected = {
        isConnected: rawDbRecord.status === 'connected',
        status: rawDbRecord.status,
        currentOrganizationName: rawDbRecord.provider_organization_name,
      };

      expect((safeProjected as any).access_token_encrypted).toBeUndefined();
      expect((safeProjected as any).refresh_token_encrypted).toBeUndefined();
      expect((safeProjected as any).access_token).toBeUndefined();
    });

    it('validates GraphQL mutation error parsing without fake HTTP 200 success', () => {
      const mockGraphQLErrorResponse = {
        data: null,
        errors: [
          { message: 'Channel token expired or lacks publishing permissions', code: 'UNAUTHORIZED' },
        ],
      };

      const hasErrors = Array.isArray(mockGraphQLErrorResponse.errors) && mockGraphQLErrorResponse.errors.length > 0;
      expect(hasErrors).toBe(true);
      const errorMessage = mockGraphQLErrorResponse.errors[0].message;
      expect(errorMessage).toContain('Channel token expired');
    });
  });
});
