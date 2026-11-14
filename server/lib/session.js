// 会话：使用 AES-GCM 加密的 Cookie，GitHub Token 只存在于服务端加密 Cookie 中
const SESSION_COOKIE = 'ay_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

function base64url(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text) {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBytes(text) {
  return new TextEncoder().encode(text);
}

function fromBytes(bytes) {
  return new TextDecoder().decode(bytes);
}

async function importKey(secret) {
  const hash = await crypto.subtle.digest('SHA-256', toBytes(secret));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export const sessionCookieName = SESSION_COOKIE;
export const sessionMaxAge = SESSION_MAX_AGE;

export function sessionSecret(env) {
  return env.SESSION_SECRET || 'local-dev-secret-change-me';
}

export function randomToken(length = 24) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function createSession(payload, env) {
  const key = await importKey(sessionSecret(env));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = { ...payload, exp: Date.now() + SESSION_MAX_AGE * 1000 };
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, toBytes(JSON.stringify(body)));
  return `${base64url(iv)}.${base64url(new Uint8Array(cipher))}`;
}

export async function readSession(request, env) {
  const raw = (request.headers.get('cookie') || '')
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) return null;
  const value = decodeURIComponent(raw.slice(SESSION_COOKIE.length + 1));
  return decodeSessionValue(value, env);
}

export async function decodeSessionValue(value, env) {
  if (!value || !value.includes('.')) return null;
  try {
    const [ivPart, dataPart] = value.split('.');
    const key = await importKey(sessionSecret(env));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64url(ivPart) },
      key,
      fromBase64url(dataPart)
    );
    const session = JSON.parse(fromBytes(new Uint8Array(plain)));
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
