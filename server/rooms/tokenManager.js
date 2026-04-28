// tokenManager.js — Server-side token store
// Each player slot in a room gets a UUID token on join/create.
// On reconnect, client sends token → server resolves room + player.
// Tokens are destroyed when the room ends or player explicitly leaves.

const { randomUUID } = require('crypto')

const tokens = new Map() // token → { roomCode, playerName, createdAt, lastSeen }

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function createToken(roomCode, playerName) {
  // If player already has a token for this room, reuse it
  for (const [t, s] of tokens) {
    if (s.roomCode === roomCode && s.playerName === playerName) {
      s.lastSeen = Date.now()
      return t
    }
  }
  const token = randomUUID()
  tokens.set(token, { roomCode, playerName, createdAt: Date.now(), lastSeen: Date.now() })
  return token
}

function resolveToken(token) {
  if (!token) return null
  const s = tokens.get(token)
  if (!s) return null
  if (Date.now() - s.lastSeen > TOKEN_TTL_MS) {
    tokens.delete(token)
    return null
  }
  s.lastSeen = Date.now()
  return { roomCode: s.roomCode, playerName: s.playerName }
}

function refreshToken(token) {
  const s = tokens.get(token)
  if (s) s.lastSeen = Date.now()
}

function destroyToken(token) {
  tokens.delete(token)
}

function destroyRoomTokens(roomCode) {
  for (const [t, s] of tokens) {
    if (s.roomCode === roomCode) tokens.delete(t)
  }
}

function destroyPlayerToken(roomCode, playerName) {
  for (const [t, s] of tokens) {
    if (s.roomCode === roomCode && s.playerName === playerName) {
      tokens.delete(t)
      return
    }
  }
}

// Periodic cleanup of expired tokens (run every 30 min)
setInterval(() => {
  const now = Date.now()
  for (const [t, s] of tokens) {
    if (now - s.lastSeen > TOKEN_TTL_MS) tokens.delete(t)
  }
}, 30 * 60 * 1000)

module.exports = {
  createToken,
  resolveToken,
  refreshToken,
  destroyToken,
  destroyRoomTokens,
  destroyPlayerToken,
}
