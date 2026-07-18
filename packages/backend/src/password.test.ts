import { describe, expect, it } from 'vitest';
import { createStrongCredential, verifyLegacyPassword, verifyStrongCredential } from './password';

describe('teacher password migration', () => {
  it('creates and verifies a PBKDF2 credential', async () => {
    const credential = await createStrongCredential('correct-password');
    expect(credential.iterations).toBe(100_000);
    await expect(verifyStrongCredential('correct-password', credential.salt, credential.iterations, credential.passwordHash)).resolves.toBe(true);
    await expect(verifyStrongCredential('wrong-password', credential.salt, credential.iterations, credential.passwordHash)).resolves.toBe(false);
  });

  it('verifies the legacy app hash during migration', async () => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('passwordteacher01'));
    const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    await expect(verifyLegacyPassword('password', 'teacher01', hash)).resolves.toBe(true);
  });
});
