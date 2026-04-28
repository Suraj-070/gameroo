import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Profile.module.css'

const AVATAR_COLORS = ['#E8FF47', '#B87BFF', '#5CA8FF', '#FF9A3C', '#4DFFA0', '#FF5C5C']

function getAvatarColor(name = '') {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[i]
}

export default function Profile() {
  const navigate = useNavigate()
  const { auth, logout } = useAuth()
  const { user } = auth

  if (!user) {
    navigate('/auth')
    return null
  }

  const { stats } = user
  const winRate = stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0

  const games = [
    { key: 'numberGuessing', label: 'Number Guess',  icon: '🎯' },
    { key: 'numberWordle',   label: 'Number Wordle', icon: '🔢' },
    { key: 'wordWordle',     label: 'Word Wordle',   icon: '📝' },
    { key: 'wordDuel',       label: 'Word Duel',     icon: '🔤' },
    { key: 'triviaBlitz',    label: 'Trivia Blitz',  icon: '🧠' },
    { key: 'bluffClub',      label: 'Bluff Club',    icon: '🤥' },
  ]

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.layout}>
        {/* Back */}
        <button className={styles.back} onClick={() => navigate('/')}>
          ← Back to Home
        </button>

        {/* Profile header */}
        <div className={styles.profileCard}>
          <div
            className={styles.avatar}
            style={{ background: getAvatarColor(user.username), color: '#000' }}
          >
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.username}>{user.username}</h1>
            <p className={styles.email}>{user.email}</p>
            <p className={styles.joined}>
              Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Log Out
          </button>
        </div>

        {/* Summary stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{stats.gamesPlayed}</span>
            <span className={styles.statLabel}>Games Played</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{stats.gamesWon}</span>
            <span className={styles.statLabel}>Games Won</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{winRate}%</span>
            <span className={styles.statLabel}>Win Rate</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{stats.totalScore.toLocaleString()}</span>
            <span className={styles.statLabel}>Total Score</span>
          </div>
        </div>

        {/* Empty state for new users */}
        {stats.gamesPlayed === 0 && (
          <div style={{ textAlign:'center', padding:'2rem', background:'var(--bg-2)', border:'1px dashed var(--border)', borderRadius:'var(--radius-xl)' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🎮</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--text)', marginBottom:'0.35rem' }}>No games yet!</div>
            <div style={{ fontSize:'0.82rem', color:'var(--text-3)', marginBottom:'1rem' }}>Play your first game to start tracking stats.</div>
            <button onClick={()=>navigate('/')} style={{ padding:'0.7rem 1.5rem', background:'var(--grad-brand)', color:'#fff', border:'none', borderRadius:'var(--radius)', fontFamily:'var(--font-display)', fontWeight:700, cursor:'pointer', fontSize:'0.875rem' }}>
              Play Now →
            </button>
          </div>
        )}

        {/* Per-game breakdown */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>By Game</h2>
          <div className={styles.gameStats}>
            {games.map(g => {
              const gs = stats[g.key] || { played: 0, wins: 0 }
              const wr = gs.played > 0 ? Math.round((gs.wins / gs.played) * 100) : 0
              return (
                <div key={g.key} className={styles.gameStatCard}>
                  <span className={styles.gameIcon}>{g.icon}</span>
                  <div className={styles.gameStatInfo}>
                    <span className={styles.gameStatName}>{g.label}</span>
                    <span className={styles.gameStatSub}>{gs.played} played · {gs.wins} wins · {wr}% win rate</span>
                  </div>
                  <div className={styles.winBar}>
                    <div className={styles.winBarFill} style={{ width: `${wr}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
