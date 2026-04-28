import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useRoom } from '../context/RoomContext'
import { useToast } from '../components/ui/Toast'
import { saveToken, clearToken, getToken } from '../hooks/useSession'
import { useSound, Haptics } from '../hooks/useSound'
import { fireConfetti } from '../hooks/useConfetti'
import { fireScoreFloat } from '../components/ui/ScoreFloat'
import GameCountdown from '../components/ui/GameCountdown'
import {
  ReconnectOverlay,
  PartnerDisconnectBanner,
  PartnerReconnectedBanner,
} from '../components/ui/DisconnectBanner'

import { lazy, Suspense } from 'react'

const WordDuel       = lazy(() => import('../components/game/WordDuel'))
const TriviaBlitz    = lazy(() => import('../components/game/TriviaBlitz'))
const BluffClub      = lazy(() => import('../components/game/BluffClub'))
const NumberGuessing = lazy(() => import('../components/game/NumberGuessing'))
const NumberWordle   = lazy(() => import('../components/game/NumberWordle'))
const WordWordle     = lazy(() => import('../components/game/WordWordle'))

const GAME_MAP = {
  'word-duel':       WordDuel,
  'trivia-blitz':    TriviaBlitz,
  'bluff-club':      BluffClub,
  'number-guessing': NumberGuessing,
  'number-wordle':   NumberWordle,
  'word-wordle':     WordWordle,
}

export default function Game() {
  const { code }   = useParams()
  const navigate   = useNavigate()
  const { socket, connected } = useSocket()
  const { room, dispatch }    = useRoom()
  const toast = useToast()

  const [reconnecting, setReconnecting]         = useState(false)
  const [showCountdown, setShowCountdown]       = useState(false)
  const [sessionRestored, setSessionRestored]   = useState(false)
  const sound = useSound()
  const [partnerDisconnected, setPartnerDiscon] = useState(false)
  const [partnerDisconName, setPartnerDisconName] = useState('')
  const [partnerReconnected, setPartnerRecon]   = useState(false)

  const roomRef        = useRef(room)
  const prevConnected  = useRef(connected)   // track PREVIOUS connected state
  const mountedRef     = useRef(false)       // true after first render

  useEffect(() => { roomRef.current = room }, [room])

  // Save session
  // Token is already stored in localStorage from join/create — no need to re-save

  // Detect ACTUAL reconnection (was disconnected, now connected again)
  // NOT the initial connection on page load
  useEffect(() => {
    if (!mountedRef.current) {
      // First render — just record state, don't do anything
      mountedRef.current   = true
      prevConnected.current = connected
      return
    }

    const wasDisconnected = !prevConnected.current
    prevConnected.current  = connected

    if (connected && wasDisconnected) {
      // We genuinely just reconnected after a drop
      setReconnecting(false)
      const token = getToken()
      if (token) {
        socket.emit('room:reconnect', { token }, (res) => {
          if (!res?.error) {
            setSessionRestored(true)
            setTimeout(() => setSessionRestored(false), 4000)
            if (res.token) saveToken(res.token) // refresh token
            if (res.currentGame) dispatch({ type: 'SET_GAME', game: res.currentGame })
            if (res.gameState)   dispatch({ type: 'SET_GAME_STATE', gameState: res.gameState })
          }
        })
      }
    } else if (!connected) {
      setReconnecting(true)
    }
  }, [connected])

  // Socket event listeners
  useEffect(() => {
    if (!socket) return

    function onGameState(gameState) {
      dispatch({ type: 'SET_GAME_STATE', gameState })
    }

    // FIX: listen for game:starting in case user is already on /game route
    // (e.g. Play Again flow — Lobby's onStarting won't fire for players on /game)
    function onGameStarting({ game }) {
      dispatch({ type: 'SET_GAME', game })
      dispatch({ type: 'SET_GAME_STATE', gameState: null })
    }

    function onGameOver(payload) {
      const myScore = payload.scores?.[roomRef.current.playerName] || 0
      const winner  = payload.winner
      if (winner === roomRef.current.playerName) {
        fireConfetti('win')
        sound.win()
        Haptics.win()
        if (myScore > 0) fireScoreFloat(myScore, window.innerWidth/2, window.innerHeight*0.4)
      } else {
        sound.lose()
        Haptics.error()
      }
      dispatch({
        type: 'SET_GAME_STATE',
        gameState: { ...(roomRef.current.gameState || {}), ...payload, phase: 'over' }
      })
      dispatch({ type: 'SET_SCORES', scores: payload.scores || {} })
      clearToken()  // FIX: clear immediately so AutoRejoin won't try to resume
      setTimeout(() => {
        dispatch({ type: 'SET_PHASE', phase: 'results' })
        navigate(`/room/${code}/results`)
      }, 3500)
    }

    function onRoomError({ message }) {
      toast.error(message)
      clearToken()
      setTimeout(() => navigate('/'), 2000)
    }

    function onPartnerDisconnected({ playerName }) {
      setPartnerDisconName(playerName)
      setPartnerDiscon(true)
      setPartnerRecon(false)
      toast.warning(`${playerName} lost connection`)
    }

    function onPartnerReconnected({ playerName }) {
      setPartnerDiscon(false)
      setPartnerRecon(true)
      // Only show toast — no rejoin toast here, that's handled above
      toast.success(`${playerName} is back!`)
      setTimeout(() => setPartnerRecon(false), 4000)
    }

    function onRoomCancelled({ reason }) {
      toast.error(reason || 'Game was cancelled.')
      clearToken()
      setTimeout(() => navigate('/'), 2500)
    }

    function onPlayerLeft({ message, players, newHostName }) {
      toast.error(message || 'A player left the game.')
      // FIX: update players and isHost rather than immediately ejecting
      if (players) dispatch({ type: 'SET_PLAYERS', players })
      if (newHostName === roomRef.current.playerName) {
        toast.info('You are now the host!')
      }
      // Only navigate away if room is now empty or game can't continue
    }

    socket.on('game:state',                onGameState)
    socket.on('game:starting',             onGameStarting)
    socket.on('game:over',                 onGameOver)
    socket.on('room:error',                onRoomError)
    socket.on('room:partner-disconnected', onPartnerDisconnected)
    socket.on('room:partner-reconnected',  onPartnerReconnected)
    socket.on('room:cancelled',            onRoomCancelled)
    socket.on('room:player-left',          onPlayerLeft)

    return () => {
      socket.off('game:state',                onGameState)
      socket.off('game:starting',             onGameStarting)
      socket.off('game:over',                 onGameOver)
      socket.off('room:error',                onRoomError)
      socket.off('room:partner-disconnected', onPartnerDisconnected)
      socket.off('room:partner-reconnected',  onPartnerReconnected)
      socket.off('room:cancelled',            onRoomCancelled)
      socket.off('room:player-left',          onPlayerLeft)
    }
  }, [socket])


  // Token heartbeat — refresh token every 2 min while in-game
  useEffect(() => {
    const token = getToken()
    if (!token || !socket) return
    const interval = setInterval(() => {
      socket.emit('game:action', { roomCode: code, action: 'heartbeat', payload: {}, token })
    }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [socket, code])

  function handleCancelGame() {
    socket.emit('room:cancel', { roomCode: code })
    clearToken()
    navigate('/')
  }

  function handleGiveUp() {
    socket.emit('room:leave', { roomCode: code })
    clearToken()
    navigate('/')
  }

  const GameComponent = GAME_MAP[room.currentGame]

  if (!GameComponent) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-3)', fontFamily:'var(--font-body)', flexDirection:'column', gap:'1rem' }}>
        <div style={{ fontSize:'2rem' }}>🎮</div>
        <div>Loading game...</div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:'1rem',fontFamily:'var(--font-body)',color:'var(--text-3)' }}>
        <div style={{ width:40,height:40,border:'3px solid var(--bg-4)',borderTopColor:'var(--brand)',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
        <span>Loading game...</span>
      </div>
    }>
      <>
        <ReconnectOverlay visible={reconnecting} onGiveUp={handleGiveUp} />
        {sessionRestored && (
          <div style={{
            position:'fixed', top:0, left:0, right:0, zIndex:9996,
            background:'linear-gradient(90deg,#6C63FF,#a855f7)',
            color:'#fff', textAlign:'center', padding:'0.6rem',
            fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.875rem',
            animation:'slideDown 0.3s ease',
          }}>
            ✅ Session restored — picking up exactly where you left off!
          </div>
        )}
        <PartnerDisconnectBanner
          visible={partnerDisconnected}
          playerName={partnerDisconName}
          onCancel={handleCancelGame}
          onKeepWaiting={() => setPartnerDiscon(false)}
        />
        <PartnerReconnectedBanner
          visible={partnerReconnected}
          playerName={partnerDisconName}
        />
        <GameComponent roomCode={code} />
      </>
    </Suspense>
  )
}