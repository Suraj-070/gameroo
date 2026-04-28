// useSession.js — Token-based session management
// Replaces useReconnect.js. Client stores ONE token, server knows everything else.

const TOKEN_KEY = 'gamero_token'

export function saveToken(token) {
  if (!token) return
  try { localStorage.setItem(TOKEN_KEY, token) } catch {}
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null } catch { return null }
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch {}
}

// ── Legacy shims — keep old imports working during transition ──────
export function saveSession()           {}
export function saveSessionPersistent() {}
export function clearSession()          { clearToken() }
export function getSession()            { return null }
export function getPersistentSession()  { return null }
export function useAutoRejoin()         {}
