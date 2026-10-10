export const SESSION_COOKIE = 'gate_ra_session';

/** Deterministic session value derived from APP_PASSWORD (changing the password logs everyone out). */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`gate-ra-planner:v1:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
