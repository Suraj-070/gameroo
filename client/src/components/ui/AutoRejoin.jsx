// AutoRejoin.jsx — Token-based reconnect
// On mount at '/', check for a stored token.
// If found, ask server to resolve it. Server sends back full room state.
// No localStorage soup — just one token.

import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSocket } from '../../context/SocketContext'
import { useRoom } from '../../context/RoomContext'
import { useToast } from './Toast'
import { getToken, clearToken, saveToken } from '../../hooks/useSession'

export default function AutoRejoin() {
  const { socket }       = useSocket()
  const { dispatch }     = useRoom()
  const toast            = useToast()
  const navigate         = useNavigate()
  const { pathname }     = useLocation()
  const attempted        = useRef(false)

  useEffect(() => {
    if (!socket || attempted.current || pathname !== '/') return

    const token = getToken()
    if (!token) return

    attempted.current = true

    socket.emit('room:reconnect', { token }, (res) => {
      if (res?.error) {
        // Token dead or room gone — clean slate, no noisy toast
        clearToken()
        return
      }

      // Refresh token (server sends same token back, lastSeen bumped)
      if (res.token) saveToken(res.token)

      dispatch({ type: 'JOIN_ROOM', roomCode: res.roomCode, playerName: res.playerName, isHost: false })
      dispatch({ type: 'SET_PLAYERS', players: res.players || [] })
      if (res.scores) dispatch({ type: 'SET_SCORES', scores: res.scores })
      if (res.gameState) dispatch({ type: 'SET_GAME_STATE', gameState: res.gameState })

      if (res.currentGame && res.phase === 'playing') {
        dispatch({ type: 'SET_GAME', game: res.currentGame })
        toast.success('✅ Session restored — picking up where you left off!')
        navigate(`/room/${res.roomCode}/game`)
      } else {
        toast.success(`Welcome back! Rejoined room ${res.roomCode}`)
        navigate(`/room/${res.roomCode}`)
      }
    })
  }, [socket, pathname])

  return null
}
