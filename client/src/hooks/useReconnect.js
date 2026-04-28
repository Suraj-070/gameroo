// useReconnect.js — tightened session rules
// - sessionStorage only (same tab, cleared on tab close)
// - localStorage only as a SHORT fallback (15 min max, not 24h)
// - Never auto-rejoin if user explicitly left or game is over

const SESSION_KEY      = 'gamero_session'
const PERSIST_KEY      = 'gamero_session_persist'
const PERSIST_TTL_MS   = 15 * 60 * 1000   // 15 min (was 24h — way too long)
const SESSION_TTL_MS   = 2  * 60 * 60 * 1000  // 2h for same-tab

export function saveSession(roomCode, playerName, currentGame = null, phase = null) {
  const data = JSON.stringify({ roomCode, playerName, currentGame, phase, savedAt: Date.now() })
  sessionStorage.setItem(SESSION_KEY, data)
}

export function saveSessionPersistent(roomCode, playerName, currentGame = null, phase = null) {
  // FIX: don't persist 'over' or 'results' phase — game is done
  if (phase === 'over' || phase === 'results') {
    clearSession()
    return
  }
  const data = JSON.stringify({ roomCode, playerName, currentGame, phase, savedAt: Date.now() })
  sessionStorage.setItem(SESSION_KEY, data)
  // FIX: only write localStorage for active in-game sessions
  if (phase === 'playing' || phase === 'lobby') {
    try { localStorage.setItem(PERSIST_KEY, data) } catch {}
  }
}

export function getPersistentSession() {
  try {
    // Same-tab sessionStorage first
    const ss = sessionStorage.getItem(SESSION_KEY)
    if (ss) {
      const s = JSON.parse(ss)
      // FIX: don't return finished/over sessions
      if (s.phase === 'over' || s.phase === 'results') { clearSession(); return null }
      if (Date.now() - s.savedAt > SESSION_TTL_MS) { clearSession(); return null }
      return s
    }
    // Cross-tab localStorage fallback — much shorter TTL
    const ls = localStorage.getItem(PERSIST_KEY)
    if (!ls) return null
    const s = JSON.parse(ls)
    if (s.phase === 'over' || s.phase === 'results') { clearSession(); return null }
    // FIX: 15 min TTL for localStorage (was 24h)
    if (Date.now() - s.savedAt > PERSIST_TTL_MS) { clearSession(); return null }
    return s
  } catch { return null }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  try { localStorage.removeItem(PERSIST_KEY) } catch {}
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (s.phase === 'over' || s.phase === 'results') { clearSession(); return null }
    if (Date.now() - s.savedAt > SESSION_TTL_MS) { clearSession(); return null }
    return s
  } catch { return null }
}

export function useAutoRejoin(socket, dispatch, toast) {
  // kept for backward compat — AutoRejoin component handles this
}
