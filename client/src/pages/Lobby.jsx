import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useToast } from '../components/ui/Toast'
import { useRoom } from '../context/RoomContext'
import { saveToken, clearToken } from '../hooks/useSession'
import { useSound, Haptics } from '../hooks/useSound'
import GameCountdown from '../components/ui/GameCountdown'
import styles from './Lobby.module.css'

const GAMES = [
  { id: 'number-guessing', name: 'Number Guess',  desc: 'Guess the secret number',   icon: '🎯', color: '#10B981', players: '2–6' },
  { id: 'number-wordle',   name: 'Number Wordle', desc: 'Crack the digit code',       icon: '🔢', color: '#F59E0B', players: '2' },
  { id: 'word-wordle',     name: 'Word Wordle',   desc: 'Guess the secret word',      icon: '📝', color: '#6C63FF', players: '2' },
  { id: 'word-duel',       name: 'Word Duel',     desc: 'Guess the hidden word',      icon: '🔤', color: '#B87BFF', players: '2–8' },
  { id: 'trivia-blitz',    name: 'Trivia Blitz',  desc: 'First to buzz in wins',      icon: '🧠', color: '#5CA8FF', players: '2–10' },
  { id: 'bluff-club',      name: 'Bluff Club',    desc: 'Two truths, one lie',        icon: '🤥', color: '#FF9A3C', players: '3–8' },
]


const GAME_RULES = {
  'number-guessing': { title: 'Number Guessing', rules: ["Each player picks a secret number (1–1000).", "Take turns guessing each other's number.", "After each guess you get ⬆ Too Low or ⬇ Too High hints.", "Fewest guesses to crack the secret wins!"] },
  'number-wordle':   { title: 'Number Wordle',   rules: ["Each player sets a secret number code.", "Take turns guessing digits.", "🟩 = correct digit & position, 🟨 = right digit wrong spot, ⬜ = not in code.", "Crack it in 6 tries or less!"] },
  'word-wordle':     { title: 'Word Wordle',      rules: ["A secret 5-letter word is chosen.", "Guess the word in 6 tries.", "🟩 = right letter right spot, 🟨 = right letter wrong spot, ⬜ = not in word.", "Fastest solver wins!"] },
  'word-duel':       { title: 'Word Duel',        rules: ["One player sets a secret word + hint.", "The other player guesses using only the hint.", "Each guess uses one attempt (8 max).", "Correct guess = guesser wins, all guesses used = setter wins!"] },
  'trivia-blitz':    { title: 'Trivia Blitz',     rules: ["Answer multiple choice questions against all players.", "First to answer correctly gets more points.", "Press keys 1–4 or tap to pick your answer.", "Most points after all questions wins!"] },
  'bluff-club':      { title: 'Bluff Club',       rules: ["Each player writes 2 truths and 1 lie.", "Everyone votes on which statement is the lie.", "Fool others = points for you. Spot the lie = points for voters.", "Most points after all rounds wins!"] },
}

const AVATAR_COLORS = ['#6C63FF','#EC4899','#10B981','#F59E0B','#3B82F6','#EF4444']
function avatarColor(name = '') { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] }

export default function Lobby() {
  const { code }   = useParams()
  const navigate   = useNavigate()
  const { socket } = useSocket()
  const { room, dispatch } = useRoom()
  const toast = useToast()

  // Guard: if arrived directly via URL with no session, redirect home
  useEffect(() => {
    if (!room.roomCode && !room.playerName) {
      navigate('/', { replace: true })
    }
  }, [])


  // FIX: When Lobby mounts after a game (e.g. Back to Games button),
  // reset the game state so the lobby shows correctly
  useEffect(() => {
    if (room.currentGame || room.gameState) {
      dispatch({ type: 'SET_GAME_STATE', gameState: null })
      dispatch({ type: 'SET_GAME', game: null })
      dispatch({ type: 'SET_PHASE', phase: 'lobby' })
    }
  }, [])

  const sound = useSound()
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdownGame, setCountdownGame]   = useState('')
  const [selectedGame, setSelectedGame]     = useState(null)
  const [copied, setCopied]             = useState(false)
  const [rulesGame, setRulesGame]       = useState(null)
  const [newTag, setNewTag]             = useState('')
  const [editingTag, setEditingTag]     = useState(false)

  useEffect(() => {
    if (!socket) return

    function onPlayers(players) {
      if (players.length > (room.players?.length || 0)) { sound.join(); Haptics.light() }
      dispatch({ type: 'SET_PLAYERS', players })
    }
    function onStarting({ game }) {
      dispatch({ type: 'SET_GAME', game })
      const GAME_NAMES = {'word-duel':'Word Duel','trivia-blitz':'Trivia Blitz','bluff-club':'Bluff Club','number-guessing':'Number Guessing','number-wordle':'Number Wordle','word-wordle':'Word Wordle'}
      setCountdownGame(GAME_NAMES[game] || game)
      setShowCountdown(true)
    }
    function onError({ message }) {
      toast.error(message)
      setTimeout(() => navigate('/'), 2000)
    }
    function onPlayerLeft({ players, message, newHostName }) {
      toast.warning(message || 'A player left.')
      dispatch({ type: 'SET_PLAYERS', players })
      // FIX: if we just became host, show a toast
      if (newHostName === room.playerName) {
        toast.info('You are now the host!')
      }
    }

    function onReset({ players }) {
      dispatch({ type: 'SET_GAME_STATE', gameState: null })
      dispatch({ type: 'SET_GAME', game: null })
      dispatch({ type: 'SET_SCORES', scores: {} })
      dispatch({ type: 'SET_PHASE', phase: 'lobby' })
      if (players) dispatch({ type: 'SET_PLAYERS', players })
      clearToken()  // FIX: clear so AutoRejoin doesn't re-drag into old game
    }
    socket.on('room:reset',      onReset)
    socket.on('room:players',    onPlayers)
    socket.on('game:starting',   onStarting)
    socket.on('room:error',      onError)
    socket.on('room:player-left', onPlayerLeft)

    return () => {
      socket.off('room:reset',      onReset)
    socket.off('room:players',    onPlayers)
      socket.off('game:starting',   onStarting)
      socket.off('room:error',      onError)
      socket.off('room:player-left', onPlayerLeft)
    }
  }, [socket])

  function copyCode() {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyInviteLink() {
    const url = `${window.location.origin}/?join=${code}`
    navigator.clipboard.writeText(url).catch(() => {})
    toast.success('Invite link copied! Send it to your friend.')
  }

  function startGame() {
    if (!selectedGame) return
    sound.click(); Haptics.medium()
    socket.emit('game:start', { roomCode: code, game: selectedGame })
  }

  function leaveRoom() {
    socket.emit('room:leave', { roomCode: code })
    dispatch({ type: 'LEAVE_ROOM' })
    navigate('/')
  }

  function changeGamertag() {
    const trimmed = newTag.trim()
    if (!trimmed || trimmed.length < 2) { toast.warning('Name must be at least 2 characters'); return }
    if (trimmed.length > 20)            { toast.warning('Name too long (max 20)'); return }
    if (trimmed === room.playerName)    { setEditingTag(false); return }

    socket.emit('room:rename', { roomCode: code, newName: trimmed }, (res) => {
      if (res?.error) { toast.error(res.error); return }
      dispatch({ type: 'JOIN_ROOM', roomCode: code, playerName: trimmed, isHost: room.isHost })
      saveSessionPersistent(code, trimmed)
      toast.success(`Gamertag changed to ${trimmed}!`)
      setEditingTag(false)
      setNewTag('')
    })
  }

  return (
    <div className={styles.page}>
      {showCountdown && <GameCountdown gameName={countdownGame} onDone={() => { setShowCountdown(false); navigate(`/room/${code}/game`) }} />}
      <div className={styles.layout}>

        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>

          {/* Room code card */}
          <div className={styles.roomCode} onClick={copyCode} title="Click to copy">
            <span className={styles.codeLabel}>Room Code</span>
            <span className={styles.code}>{code}</span>
            <span className={styles.copyHint}>{copied ? '✅ Copied!' : '📋 Click to copy'}</span>
          </div>
          <button className={styles.inviteBtn} onClick={copyInviteLink}>
            🔗 Copy Invite Link
          </button>

          {/* Player list */}
          <div className={styles.playerList}>
            <span className={styles.sideTitle}>Players ({room.players.length})</span>
            {room.players.map((p, i) => (
              <div key={p.id || p.name} className={styles.player}>
                <div className={styles.avatar}
                  style={{ background: avatarColor(p.name), color: '#fff' }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className={styles.playerName}>{p.name}</span>
                {p.isHost && <span className={styles.hostBadge}>host</span>}
                {!p.connected && <span style={{ fontSize:'0.65rem', color:'#9CA3AF' }}>⚠️</span>}
              </div>
            ))}
          </div>

          {/* Gamertag change */}
          <div className={styles.gamertagSection}>
            <span className={styles.gamertagLabel}>Your Gamertag</span>
            {!editingTag ? (
              <div className={styles.gamertagRow}>
                <div className={styles.gamertagInput} style={{ display:'flex', alignItems:'center', background:'var(--bg-3)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'0.55rem 0.75rem', fontSize:'0.875rem', fontWeight:600, color:'var(--text)', flex:1 }}>
                  {room.playerName || '—'}
                </div>
                <button className={styles.gamertagBtn} onClick={() => { setEditingTag(true); setNewTag(room.playerName) }}>
                  ✏️ Edit
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                <div className={styles.gamertagRow}>
                  <input
                    className={styles.gamertagInput}
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter') changeGamertag(); if (e.key==='Escape') setEditingTag(false) }}
                    maxLength={20}
                    autoFocus
                    placeholder="New gamertag..."
                  />
                  <button className={styles.gamertagBtn} onClick={changeGamertag}>Save</button>
                </div>
                <button onClick={() => setEditingTag(false)}
                  style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:'0.75rem', cursor:'pointer', textAlign:'left', padding:0, fontFamily:'inherit' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>

    
        {/* ── Rules Modal ── */}
        {rulesGame && (() => {
          const r = GAME_RULES[rulesGame]
          return (
            <div className={styles.modalOverlay} onClick={() => setRulesGame(null)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <span className={styles.modalTitle}>📖 {r.title}</span>
                  <button className={styles.modalClose} onClick={() => setRulesGame(null)}>✕</button>
                </div>
                <ol className={styles.rulesList}>
                  {r.rules.map((rule, i) => (
                    <li key={i} className={styles.rulesItem}>{rule}</li>
                  ))}
                </ol>
              </div>
            </div>
          )
        })()}

      <button className={styles.leaveBtn} onClick={leaveRoom}>🚪 Leave Room</button>
        </aside>

        {/* ── Main ── */}
        <main className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>Pick a Game</h1>
            <p className={styles.sub}>Choose what everyone will play</p>
          </div>

          <div className={styles.gameGrid}>
            {GAMES.map(game => (
              <button
                key={game.id}
                className={`${styles.gameCard} ${selectedGame === game.id ? styles.selected : ''} ${!room.isHost ? styles.nonHostCard : ''}`}
                style={{ '--accent': game.color }}
                onClick={() => room.isHost && setSelectedGame(game.id)}
                title={!room.isHost ? 'Only the host can pick a game' : ''}
              >
                <span className={styles.gameIcon}>{game.icon}</span>
                <div
                  className={styles.rulesBtn}
                  onClick={e => { e.stopPropagation(); setRulesGame(game.id) }}
                  title="How to play"
                  aria-label="How to play"
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key==='Enter' && (e.stopPropagation(), setRulesGame(game.id))}
                >ℹ️</div>
                <div className={styles.gameInfo}>
                  <span className={styles.gameName}>{game.name}</span>
                  <span className={styles.gameDesc}>{game.desc}</span>
                </div>
                <span className={styles.gamePlayers}>{game.players}</span>
              </button>
            ))}
          </div>

          {room.isHost ? (
            <button
              className={styles.startBtn}
              disabled={!selectedGame || room.players.length < 2}
              onClick={startGame}
            >
              {room.players.length < 2
                ? '⏳ Waiting for players...'
                : selectedGame
                  ? `Start ${GAMES.find(g => g.id === selectedGame)?.name} →`
                  : 'Select a game to start'}
            </button>
          ) : (
            <div className={styles.waitingHost}>
              ⏳ Waiting for host to start the game...
            </div>
          )}
        </main>
      </div>
    </div>
  )
}