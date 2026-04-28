import { useEffect, useCallback } from 'react'

// Leave guard — confirms before leaving mid-game
export function useLeaveGuard(socket, roomCode, phase) {
  return useCallback(() => {
    if (phase === 'playing' || phase === 'guessing' || phase === 'question' || phase === 'vote') {
      const ok = window.confirm('Leave the game? Your progress will be lost.')
      if (!ok) return
    }
    if (socket) socket.emit('room:leave', { roomCode })
    window.location.href = '/'
  }, [socket, roomCode, phase])
}

// Emoji reaction cooldown — prevents spam
const lastReaction = {}
export function useReactionCooldown(socket, roomCode, cooldownMs = 3000) {
  return useCallback((emoji) => {
    if (!socket) return
    const now = Date.now()
    const key  = `${roomCode}_${emoji}`
    if (lastReaction[key] && now - lastReaction[key] < cooldownMs) return
    lastReaction[key] = now
    socket.emit('game:action', { roomCode, action: 'react', payload: { emoji } })
  }, [socket, roomCode, cooldownMs])
}

// Page title — updates browser tab when it's your turn
export function usePageTitle(isMyTurn, gameName) {
  useEffect(() => {
    const base = `${gameName} · Gamero`
    document.title = isMyTurn ? `⚡ Your turn! · ${gameName}` : base
    return () => { document.title = 'Gamero' }
  }, [isMyTurn, gameName])
}