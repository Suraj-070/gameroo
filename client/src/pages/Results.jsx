import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useRoom } from '../context/RoomContext'
import { useAuth } from '../context/AuthContext'
import { clearToken } from '../hooks/useSession'
import styles from './Results.module.css'
import ShareCard from '../components/ui/ShareCard'
import { useSound, Haptics } from '../hooks/useSound'
import { fireConfetti } from '../hooks/useConfetti'

export default function Results() {
  const { code }   = useParams()
  const navigate   = useNavigate()
  const { socket } = useSocket()
  const { room, dispatch } = useRoom()
  const { auth, authAxios } = useAuth()

  const sorted = Object.entries(room.scores || {})
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)

  const winner  = sorted[0]?.name
  const myName  = room.playerName
  const iWon    = winner === myName
  const medals  = ['🥇','🥈','🥉']

  const sound = useSound()

  // Listen for server room:reset — navigate everyone back to lobby
  useEffect(() => {
    if (!socket) return
    function onReset({ players }) {
      dispatch({ type: 'SET_GAME_STATE', gameState: null })
      dispatch({ type: 'SET_GAME', game: null })
      dispatch({ type: 'SET_SCORES', scores: {} })
      dispatch({ type: 'SET_PHASE', phase: 'lobby' })
      if (players) dispatch({ type: 'SET_PLAYERS', players })
      clearToken()
      navigate(`/room/${code}`)
    }
    function onPlayerLeft({ players, newHostName }) {
      if (players) dispatch({ type: 'SET_PLAYERS', players })
      // FIX: if the host left and we're now the host, update the UI
      if (newHostName === room.playerName) {
        toast.info('The host left. You are now the host!')
      }
    }
    function onHostLeft() {
      toast.warning('The host left the room.')
    }
    socket.on('room:reset',      onReset)
    socket.on('room:player-left', onPlayerLeft)
    return () => {
      socket.off('room:reset',      onReset)
      socket.off('room:player-left', onPlayerLeft)
    }
  }, [socket])

  // Fire confetti on results mount if won
  useEffect(() => {
    if (iWon) { fireConfetti('win'); sound.win(); Haptics.win() }
    else       { sound.lose(); Haptics.error() }
  }, [])

  // Wire stats — post to API for logged-in users
  useEffect(() => {
    if (!auth.user || !room.currentGame) return
    const myScore = room.scores?.[myName] || 0
    const won     = iWon
    authAxios().post('/api/auth/update-stats', {
      game:  room.currentGame,
      won,
      score: myScore,
    }).catch(() => {}) // silent — don't break UX if this fails
  }, [])

  function playAgain() {
    // Just emit — server will broadcast room:reset to everyone including us
    socket.emit('room:reset', { roomCode: code })
  }

  function goHome() {
    socket.emit('room:leave', { roomCode: code })
    dispatch({ type: 'LEAVE_ROOM' })
    clearToken()
    navigate('/')
  }

  return (
    <div className={styles.page}>
      <div className={styles.meshBg} />
      <div className={styles.center}>
        {/* Trophy header */}
        <div className={styles.header}>
          <div className={styles.trophyWrap}>
            <span className={styles.trophy}>{iWon ? '🏆' : '🎮'}</span>
            <div className={styles.trophyGlow} />
          </div>
          <h1 className={styles.title}>{iWon ? 'You Won!' : `${winner} Wins!`}</h1>
          <p className={styles.sub}>Final scores</p>
        </div>

        {/* Podium */}
        <div className={styles.podium}>
          {sorted.map((p, i) => (
            <div key={p.name} className={`${styles.podiumItem} ${p.name===myName?styles.mine:''}`}
              style={{ animationDelay:`${i*0.1}s` }}>
              <div className={styles.podiumRank}>{medals[i] || `#${i+1}`}</div>
              <div className={styles.podiumAvatar}
                style={{ background: ['var(--grad-brand)','linear-gradient(135deg,#9CA3AF,#D1D5DB)','linear-gradient(135deg,#CD853F,#D4A574)'][i] || 'var(--bg-4)' }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.podiumName}>{p.name}{p.name===myName&&<span className={styles.youTag}> you</span>}</div>
              <div className={styles.podiumScore}>{p.score} pts</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className={styles.shareRow}>
          <ShareCard
            game={room.currentGame}
            winner={winner}
            myName={myName}
            scores={room.scores}
            extras={room.gameState || {}}
          />
        </div>
        <div className={styles.actions}>
          {room.isHost ? (
            <button className={styles.btnPrimary} onClick={playAgain}>🔄 Play Again</button>
          ) : (
            <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.4)', textAlign:'center', padding:'0.75rem', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:'var(--radius)', width:'100%' }}>
              {room.players.some(p => p.isHost && p.connected)
                ? '⏳ Waiting for host to start next round...'
                : '⚠️ Host disconnected — waiting for them to return...'}
            </div>
          )}
          <button className={styles.btnSecondary} onClick={goHome}>🏠 Home</button>
        </div>
      </div>
    </div>
  )
}
