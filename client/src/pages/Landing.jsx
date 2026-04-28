import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useRoom } from '../context/RoomContext'
import { useAuth } from '../context/AuthContext'
import { saveToken, clearToken } from '../hooks/useSession'
import styles from './Landing.module.css'

const AVATAR_COLORS = ['#E8FF47', '#B87BFF', '#5CA8FF', '#FF9A3C', '#4DFFA0', '#FF5C5C']
function getAvatarColor(name = '') {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

export default function Landing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { socket } = useSocket()
  const { dispatch } = useRoom()
  const { auth, logout } = useAuth()

  const isGuest = !auth.user
  const playerName = auth.user?.username || ''

  const inviteCode = searchParams.get('join') || ''
  const [mode, setMode]         = useState(inviteCode ? 'join' : null)
  const [guestName, setGuestName] = useState('')
  const [code, setCode]         = useState(inviteCode)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Name to use: logged-in username OR typed guest name
  const activeName = auth.user ? auth.user.username : guestName

  function handleCreate(e) {
    e.preventDefault()
    if (!activeName.trim()) return setError('Enter your name')
    setLoading(true); setError('')
    socket.emit('room:create', { playerName: activeName.trim() }, (res) => {
      setLoading(false)
      if (res.error) return setError(res.error)
      if (res.token) saveToken(res.token)
      dispatch({ type: 'JOIN_ROOM', roomCode: res.roomCode, playerName: activeName.trim(), isHost: true })
      navigate(`/room/${res.roomCode}`)
    })
  }

  function handleJoin(e) {
    e.preventDefault()
    if (!activeName.trim()) return setError('Enter your name')
    if (!code.trim()) return setError('Enter a room code')
    setLoading(true); setError('')
    socket.emit('room:join', { playerName: activeName.trim(), roomCode: code.toUpperCase().trim() }, (res) => {
      setLoading(false)
      if (res.error) return setError(res.error)
      if (res.token) saveToken(res.token)
      dispatch({ type: 'JOIN_ROOM', roomCode: res.roomCode, playerName: activeName.trim(), isHost: false })
      navigate(`/room/${res.roomCode}`)
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.meshBg} aria-hidden="true" />
      <div className={styles.dotGrid} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      {/* Top bar */}
      <header className={styles.topbar}>
        <span className={styles.topLogo}>GAMERO</span>
        <div className={styles.topRight}>
          {auth.user ? (
            <>
              <Link to="/profile" className={styles.profileBtn}>
                <span
                  className={styles.topAvatar}
                  style={{ background: getAvatarColor(auth.user.username), color: '#000' }}
                >
                  {auth.user.username.charAt(0).toUpperCase()}
                </span>
                <span className={styles.topUsername}>{auth.user.username}</span>
              </Link>
              <button className={styles.logoutBtn} onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/auth" className={styles.loginBtn}>Log In</Link>
              <Link to="/auth" className={styles.registerBtn}>Register</Link>
            </>
          )}
        </div>
      </header>

      <div className={styles.center}>
        {/* Logo */}
        <div className={styles.logo}>
            <div className={styles.logoGlow} aria-hidden="true" />
          <span className={styles.logoText}>GAMERO</span>
          <span className={styles.logoTag}>play with friends</span>
        </div>

        {/* Game pills */}
        <div className={styles.pills}>
          {['Word Duel', 'Trivia Blitz', 'Bluff Club', 'More soon...'].map((g, i) => (
            <span key={g} className={styles.pill} style={{ animationDelay: `${i * 0.08}s` }}>{g}</span>
          ))}
        </div>

        {/* Logged-in greeting */}
        {auth.user && !mode && (
          <div className={styles.greeting}>
            Welcome back, <strong>{auth.user.username}</strong> —
            <span className={styles.greetingSub}> {auth.user.stats?.gamesPlayed || 0} games played</span>
          </div>
        )}

        {/* Actions */}
        {!mode && (
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={() => setMode('create')}>Create Room</button>
            <button className={styles.btnSecondary} onClick={() => setMode('join')}>Join Room</button>
          </div>
        )}

        {/* Create form */}
        {mode === 'create' && (
          <form className={`${styles.form} animate-scale`} onSubmit={handleCreate}>
            <div className={styles.formHeader}>
              <span>New Room</span>
              <button type="button" className={styles.back} onClick={() => { setMode(null); setError('') }}>✕</button>
            </div>
            {isGuest ? (
              <input
                className={styles.input}
                placeholder="Enter your name"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                maxLength={20}
                autoFocus
              />
            ) : (
              <div className={styles.loggedInName}>
                Playing as <strong>{auth.user.username}</strong>
              </div>
            )}
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create & Enter →'}
            </button>
            {isGuest && (
              <p className={styles.guestNote}>
                <Link to="/auth" className={styles.authLink}>Log in</Link> to save your stats
              </p>
            )}
          </form>
        )}

        {/* Join form */}
        {mode === 'join' && (
          <form className={`${styles.form} animate-scale`} onSubmit={handleJoin}>
            <div className={styles.formHeader}>
              <span>Join Room</span>
              <button type="button" className={styles.back} onClick={() => { setMode(null); setError('') }}>✕</button>
            </div>
            {isGuest ? (
              <input
                className={styles.input}
                placeholder="Enter your name"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                maxLength={20}
                autoFocus
              />
            ) : (
              <div className={styles.loggedInName}>
                Playing as <strong>{auth.user.username}</strong>
              </div>
            )}
            <input
              className={`${styles.input} ${styles.codeInput}`}
              placeholder="Room code e.g. XK7F"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))}
              onPaste={e => {
                e.preventDefault()
                const pasted = (e.clipboardData.getData('text')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)
                setCode(pasted)
              }}
              maxLength={6}
              autoFocus={!isGuest}
              autoComplete="off" autoCorrect="off" spellCheck={false}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Joining...' : 'Join Room →'}
            </button>
            {isGuest && (
              <p className={styles.guestNote}>
                <Link to="/auth" className={styles.authLink}>Log in</Link> to save your stats
              </p>
            )}
          </form>
        )}
      </div>

      <footer className={styles.footer}>Gamero v2.0</footer>
    </div>
  )
}
