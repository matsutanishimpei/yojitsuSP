// Cloudflare Workers Web Crypto currently rejects PBKDF2 counts above 100,000.
const PBKDF2_ITERATIONS = 100_000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const stableSalt = Uint8Array.from(salt).buffer;
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: stableSalt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function verifyLegacyPassword(password: string, teacherId: string, expectedHash: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + teacherId));
  const actual = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return actual === expectedHash;
}

export async function createStrongCredential(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return { salt: bytesToBase64(salt), iterations: PBKDF2_ITERATIONS, passwordHash: bytesToBase64(passwordHash) };
}

export async function verifyStrongCredential(password: string, salt: string, iterations: number, expectedHash: string) {
  const actual = await pbkdf2(password, base64ToBytes(salt), iterations);
  const expected = base64ToBytes(expectedHash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}
