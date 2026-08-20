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
});
