import { useState, useEffect } from 'react'
import { useToast } from '../ui/Toast'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../../context/SocketContext'
import { useRoom } from '../../context/RoomContext'
import styles from './GameShell.module.css'

export default function GameShell({ title, icon, children, roomCode }) {
  const navigate = useNavigate()
  const { socket, connected, wasDisconnected, setWasDisconnected } = useSocket()
  const { room, dispatch } = useRoom()
  const toast = useToast()

  // FIX: show reconnected toast when connection is restored after a drop
  useEffect(() => {
    if (connected && wasDisconnected) {
      setWasDisconnected(false)
      toast.success('Reconnected! ✓')
    }
  }, [connected, wasDisconnected])

  const [showScores, setShowScores] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const sorted = Object.entries(room.scores || {})
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)

  function leaveGame() {
    if (!confirmLeave) {
      setConfirmLeave(true)
      setTimeout(() => setConfirmLeave(false), 3000)
      return
    }
    socket.emit('room:leave', { roomCode })
    dispatch({ type: 'LEAVE_ROOM' })
    navigate('/')
  }

  return (
    <div className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />

      {/* Header bar */}
      <header className={styles.header}>
        <div className={styles.gameTitle}>
          <span>{icon}</span>
          <span>{title}</span>
        </div>

        <div className={styles.headerRight}>
          <button className={styles.scoresToggle} onClick={() => setShowScores(s => !s)}>
            Scores
          </button>
          <button
            className={styles.leaveBtn}
            onClick={leaveGame}
            style={confirmLeave ? { background:'rgba(239,68,68,0.25)', borderColor:'rgba(239,68,68,0.5)', color:'#fca5a5' } : {}}
          >
            {confirmLeave ? 'Tap again to leave' : 'Leave'}
          </button>
        </div>
      </header>

      {/* Scores panel */}
      {showScores && (
        <div className={styles.scoresPanel}>
          {sorted.length === 0
            ? <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>No scores yet</p>
            : sorted.map((p, i) => (
                <div key={p.name} className={styles.scoreRow}>
                  <span className={styles.scoreRank}>#{i + 1}</span>
                  <span className={styles.scoreName}>{p.name}</span>
                  <span className={styles.scoreNum}>{p.score}</span>
                </div>
              ))
          }
        </div>
      )}

      {/* Game content */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
