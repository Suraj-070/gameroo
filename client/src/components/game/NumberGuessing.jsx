import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../../context/SocketContext'
import { useRoom } from '../../context/RoomContext'
import styles from './NumberGuessing.module.css'
import SoundToggle from '../ui/SoundToggle'
import { useToast } from '../ui/Toast'
import { useSound, Haptics } from '../../hooks/useSound'
import { useLeaveGuard, useReactionCooldown, usePageTitle } from '../../hooks/useGameUtils'
import ScoreFloat from '../ui/ScoreFloat'


const TAUNT_CATEGORIES = [
  { label: '🔥 Hype',    emojis: ['🔥','⚡','💥','🚀','🎯','💪','🏆','👑'] },
  { label: '😈 Trash',   emojis: ['😈','😤','💀','🤡','🫵','👻','🙈','🤣'] },
  { label: '😬 Nervous', emojis: ['😱','😰','😬','🫣','🤯','😵','🙃','😭'] },
  { label: '🎉 Party',   emojis: ['🎉','🥳','✨','🎊','🫶','😍','🤩','💯'] },
  { label: '🤫 Smug',    emojis: ['😏','🧐','🫠','🤭','😴','👀','💅','🫡'] },
]

function TauntPicker({ onSend, cooldownMs = 2500 }) {
  const [open, setOpen]         = useState(false)
  const [cat, setCat]           = useState(0)
  const [cooldown, setCooldown] = useState(false)
  const [lastSent, setLastSent] = useState(null)
  const [flash, setFlash]       = useState(null)
  const ref                     = useRef(null)

  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function send(emoji) {
    if (cooldown) return
    onSend(emoji)
    setLastSent(emoji)
    setFlash(emoji)
    setCooldown(true)
    setTimeout(() => { setCooldown(false); setFlash(null) }, cooldownMs)
    setOpen(false)
  }

  return (
    <div style={{ position:'relative', display:'flex', alignItems:'center' }} ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          background: open ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)',
          border: `1.5px solid ${open ? 'rgba(196,181,253,0.5)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '12px', padding: '0.5rem 0.875rem', color: '#fff',
          cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.15s',
        }}
      >
        {lastSent || '😈'} Taunt {open ? '▲' : '▼'}
        {cooldown && <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.4)' }}>cd</span>}
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
          background: 'rgba(15,10,40,0.97)', border: '1.5px solid rgba(196,181,253,0.2)',
          borderRadius: '18px', padding: '0.875rem', zIndex: 100, minWidth: '280px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display:'flex', gap:'4px', marginBottom:'0.625rem', flexWrap:'wrap' }}>
            {TAUNT_CATEGORIES.map((c,i) => (
              <button key={i} type="button" onClick={() => setCat(i)}
                style={{
                  padding: '3px 8px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700,
                  border: `1.5px solid ${cat===i?'rgba(196,181,253,0.5)':'rgba(255,255,255,0.1)'}`,
                  background: cat===i?'rgba(124,58,237,0.3)':'rgba(255,255,255,0.06)',
                  color: cat===i?'#c4b5fd':'rgba(255,255,255,0.5)', cursor: 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>{c.label}</button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:'4px' }}>
            {TAUNT_CATEGORIES[cat].emojis.map(e => (
              <button key={e} type="button" onClick={() => send(e)} disabled={cooldown}
                style={{
                  width:'34px', height:'34px', fontSize:'1.15rem',
                  background: flash===e?'rgba(124,58,237,0.4)':'rgba(255,255,255,0.07)',
                  border: `1.5px solid ${flash===e?'#c4b5fd':'rgba(255,255,255,0.1)'}`,
                  borderRadius:'8px', cursor: cooldown?'not-allowed':'pointer',
                  transition:'all 0.12s', display:'flex', alignItems:'center', justifyContent:'center',
                  opacity: cooldown && flash!==e ? 0.4 : 1,
                }}
                onMouseEnter={e2=>!cooldown&&(e2.currentTarget.style.transform='scale(1.2)')}
                onMouseLeave={e2=>(e2.currentTarget.style.transform='scale(1)')}
              >{e}</button>
            ))}
          </div>
          {cooldown && <p style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.35)', textAlign:'center', margin:'0.5rem 0 0', fontStyle:'italic' }}>Cooldown...</p>}
        </div>
      )}
    </div>
  )
}


function getProximityMsg(low, high) {
  const range = high - low
  if (range <= 5)   return { msg: '🔥 Burning hot!',   color: '#ef4444' }
  if (range <= 20)  return { msg: '🌶️ Very close!',    color: '#f97316' }
  if (range <= 50)  return { msg: '☀️ Getting warm',   color: '#fbbf24' }
  if (range <= 150) return { msg: '🌤️ Lukewarm',       color: '#a3e635' }
  if (range <= 400) return { msg: '❄️ Pretty cold',    color: '#38bdf8' }
  return { msg: '🧊 Ice cold',  color: '#818cf8' }
}

const DIFFICULTY_CONFIG = {
  easy:   { label: 'Easy',   icon: '🟢', min: 1,   max: 100,   desc: '1 – 100',    hint: 'Great for beginners' },
  medium: { label: 'Medium', icon: '🟡', min: 1,   max: 1000,  desc: '1 – 1,000',  hint: 'Classic mode' },
  hard:   { label: 'Hard',   icon: '🔴', min: 1,   max: 10000, desc: '1 – 10,000', hint: 'For the brave' },
}

// legacy kept for reference
const EMOJIS = ['😈', '😤', '💀', '🤩', '🔥']

function hintColor(hint) {
  if (hint === 'correct') return '#10B981'
  if (hint === 'low')     return '#6C63FF'
  return '#EF4444'
}
function hintBg(hint) { // FIX: dark-glass colours — was light pastels on dark bg
  if (hint === 'correct') return 'rgba(16,185,129,0.18)'
  if (hint === 'low')     return 'rgba(108,99,255,0.18)'
  return 'rgba(239,68,68,0.18)'
}
function hintShort(hint) {
  if (hint === 'correct') return '✓ Correct!'
  if (hint === 'low')     return '⬆ Too Low'
  return '⬇ Too High'
}

export default function NumberGuessing({ roomCode }) {
  const { socket } = useSocket()
  const { room }   = useRoom()
  const gs         = room.gameState || {}

  const [secret, setSecret]         = useState('')
  const [secretSet, setSecretSet]   = useState(false)
  const [guess, setGuess]           = useState('')
  const [shakeInput, setShakeInput]     = useState(false)
  const [reactions, setReactions]       = useState([])
  const [difficulty, setDifficulty]         = useState(null)  // null = not chosen yet
  const [newGuessFlash, setNewGuessFlash] = useState(false)
  const [oppTypingLen, setOppTypingLen]   = useState(0)
  const typingTimer                       = useRef(null)
  const prevMyGuessCount                  = useRef(0)
  const guessRef = useRef(null)
  const toast    = useToast()
  const sound       = useSound()
  const myName     = room.playerName
  const players    = gs.players || []
  const phase      = gs.phase || 'setup'
  const myTurn     = gs.currentTurn === myName

  const leaveGame    = useLeaveGuard(socket, roomCode, phase)
  const sendReaction = useReactionCooldown(socket, roomCode)
  usePageTitle(myTurn && phase==='playing', 'Number Guessing')

  // Sync local difficulty state from server (so non-hosts see selection too)
  useEffect(() => {
    if (gs.difficulty && gs.difficultyChosen) {
      setDifficulty(gs.difficulty)
    }
  }, [gs.difficulty, gs.difficultyChosen])

  // Sync difficulty from server when it arrives
  const serverDiff = gs.difficulty || 'medium'
  const diffConfig = DIFFICULTY_CONFIG[difficulty || serverDiff] || DIFFICULTY_CONFIG.medium
  const rangeMin   = diffConfig.min
  const rangeMax   = diffConfig.max

  const myGuesses  = (gs.guesses || {})[myName] || []
  const myRange    = (gs.ranges  || {})[myName] || { low: 1, high: 1000 }
  const myLastGuess = myGuesses[myGuesses.length - 1]
  const others     = players.filter(n => n !== myName)

  // FIX: proper useEffect with cleanup to avoid duplicate listeners
  useEffect(() => {
    if (!socket) return
    const onReaction = ({ from, emoji }) => {
      const id = Date.now() + Math.random()
      setReactions(r => [...r, { id, from, emoji }])
      setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 2200)
    }
    const onTyping     = ({ from, count }) => { if (from !== myName) setOppTypingLen(count || 1) }
    const onStopTyping = ({ from }) => { if (from !== myName) setOppTypingLen(0) }
    socket.on('game:typing',      onTyping)
    socket.on('game:stop-typing', onStopTyping)
    socket.on('game:reaction', onReaction)
    return () => socket.off('game:reaction', onReaction)
  }, [socket])

  // Auto-focus guess input when it becomes my turn
  useEffect(() => {
    if (myTurn && phase === 'playing') {
      setTimeout(() => guessRef.current?.focus(), 80)
    }
  }, [myTurn, phase])

  function submitSecret(e) {
    e.preventDefault()
    const n = parseInt(secret, 10)
    if (!secret.toString().trim()) return  // empty — no toast
    if (isNaN(n) || n < 1 || n > 1000) { toast.warning('Pick a number between 1 and 1000'); triggerShake(); return }
    socket.emit('game:action', { roomCode, action: 'set-secret', payload: { number: n } })
    setSecretSet(true)
  }

  function submitGuess(e) {
    e?.preventDefault()
    if (!myTurn) return
    const n = parseInt(guess, 10)
    if (!guess.toString().trim()) return  // empty — no toast
    if (isNaN(n) || n < 1 || n > 1000) { toast.warning('Pick a number between 1 and 1000'); triggerShake(); return }
    sound.submit(); Haptics.light()
    socket.emit('game:action', { roomCode, action: 'guess', payload: { number: n } })
    setGuess('')
    setNewGuessFlash(true)
    setTimeout(() => setNewGuessFlash(false), 600)
    setTimeout(() => guessRef.current?.focus(), 50)
  }

  function triggerShake() {
    setShakeInput(true)
    setTimeout(() => setShakeInput(false), 500)
  }

  // ── GAME OVER SCREEN ───────────────────────────────────────────
  if (phase === 'over') {
    const winner   = gs.winner
    const iWon     = winner === myName
    const secrets  = gs.secrets || {}
    const counts   = gs.guessCounts || {}

    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => window.history.back()}>← Back</button>
          <div className={styles.topTitle}>🎯 Number Guessing</div>
          <div className={styles.topRoom}>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
        </div>
        <div className={styles.setupWrap}>
          <div className={styles.setupCard}>
            <div className={styles.setupEmoji}>{iWon ? '🏆' : gs.forcedEnd ? '🤝' : '😢'}</div>
            <h2 className={styles.setupTitle}>{iWon ? 'You Won!' : gs.forcedEnd ? 'Game Ended' : `${winner} Won!`}</h2>
            <p className={styles.setupSub}>{iWon ? `Solved in ${counts[myName]} guess${counts[myName]!==1?'es':''}!` : winner ? `They solved it in ${counts[winner]} guess${counts[winner]!==1?'es':''}` : ''}</p>
            <div className={styles.readyList} style={{ width: '100%' }}>
              {players.map(n => (
                <div key={n} className={styles.readyRow}>
                  <span style={{ fontWeight: 700 }}>{n}{n === myName ? <span className={styles.youBadge}>YOU</span> : ''}</span>
                  <span style={{ fontSize: '0.82rem', color: '#6C63FF', fontWeight: 700 }}>
                    Secret: <strong>{secrets[n] ?? '?'}</strong> · {counts[n]} guesses
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Returning to lobby...</p>
          </div>
        </div>
      </div>
    )
  }


  // ── DIFFICULTY PHASE (host picks, others wait) ───────────────
  if (phase === 'setup' && !gs.difficultyChosen) {
    const isHost = room.isHost
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => window.history.back()}>← Back to Games</button>
          <div className={styles.topTitle}>🎯 Number Guessing</div>
          <div className={styles.topRoom}>Room: <strong>{roomCode}</strong></div>
          <SoundToggle />
        </div>
        <div className={styles.setupWrap}>
          <div className={styles.setupCard}>
            <div className={styles.setupEmoji}>{isHost ? '⚙️' : '⏳'}</div>
            <h2 className={styles.setupTitle}>{isHost ? 'Choose Difficulty' : 'Waiting for host...'}</h2>
            <p className={styles.setupSub}>
              {isHost
                ? 'Pick the number range for this game. Both players use the same range.'
                : `${players.find(p => p !== myName) || 'Host'} is choosing difficulty...`}
            </p>

            {isHost ? (
              <div className={styles.diffGrid}>
                {Object.entries(DIFFICULTY_CONFIG).map(([key, d]) => (
                  <button key={key} type="button"
                    className={`${styles.diffCard} ${difficulty === key ? styles.diffSelected : ''}`}
                    style={{ '--diff-color': key==='easy'?'#10B981':key==='medium'?'#F59E0B':'#EF4444' }}
                    onClick={() => setDifficulty(key)}
                  >
                    <span className={styles.diffIcon}>{d.icon}</span>
                    <div>
                      <div className={styles.diffLabel}>{d.label}</div>
                      <div className={styles.diffDesc}>{d.desc} · {d.hint}</div>
                    </div>
                  </button>
                ))}
                <button
                  className={styles.setupBtn}
                  disabled={!difficulty} style={{ opacity: difficulty ? 1 : 0.45 }}
                  onClick={() => {
                    if (!difficulty) return
                    socket.emit('game:action', { roomCode, action: 'set-difficulty', payload: { difficulty } })
                  }}
                >
                  Confirm {difficulty ? DIFFICULTY_CONFIG[difficulty].label : ''} →
                </button>
              </div>
            ) : (
              <div className={styles.diffGrid}>
                {Object.entries(DIFFICULTY_CONFIG).map(([key, d]) => (
                  <div key={key} className={styles.diffCardDisabled}
                    style={{ '--diff-color': key==='easy'?'#10B981':key==='medium'?'#F59E0B':'#EF4444' }}>
                    <span className={styles.diffIcon}>{d.icon}</span>
                    <div>
                      <div className={styles.diffLabel}>{d.label}</div>
                      <div className={styles.diffDesc}>{d.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── SETUP PHASE ────────────────────────────────────────────────
  if (phase === 'setup') {
    const ready      = gs.ready || {}
    const readyCount = Object.values(ready).filter(Boolean).length
    const total      = players.length

    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => window.history.back()}>← Back to Games</button>
          <div className={styles.topTitle}>🎯 Number Guessing</div>
          <div className={styles.topRoom}>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
        </div>
        <div className={styles.setupWrap}>
          <div className={styles.setupCard}>
            <div className={styles.setupEmoji}>🔢</div>
            <h2 className={styles.setupTitle}>Pick your secret number</h2>
            <p className={styles.setupSub}>
              Choose a number between <strong>{diffConfig.min}–{diffConfig.max.toLocaleString()}</strong>.
              {' '}<span style={{ background: 'rgba(255,255,255,0.07)', padding:'1px 8px', borderRadius:'999px', fontSize:'0.78rem' }}>
                {diffConfig.icon} {diffConfig.label}
              </span>
            </p>

            {!secretSet ? (
              <form onSubmit={submitSecret} className={styles.setupForm}>
                <input
                  className={`${styles.setupInput} ${shakeInput ? styles.shake : ''}`}
                  type="number" min={diffConfig.min} max={diffConfig.max}
                  placeholder="e.g. 742"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  autoFocus
                />
                <button className={styles.setupBtn} type="submit">Lock it in 🔒</button>
              </form>
            ) : (
              <div className={styles.lockedBadge}>🔒 Locked! Waiting for others...</div>
            )}

            <div className={styles.readyList}>
              {players.map(n => (
                <div key={n} className={styles.readyRow}>
                  <span>{n}{n === myName ? <span className={styles.youBadge}> YOU</span> : ''}</span>
                  <span className={styles.readyStatus} style={{ color: ready[n] ? '#10B981' : '#9CA3AF' }}>
                    {ready[n] ? '✓ Ready' : '⏳ Choosing...'}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.readyBar}>
              <div className={styles.readyFill} style={{ width: `${total > 0 ? (readyCount/total)*100 : 0}%` }} />
            </div>
            <p className={styles.readyText}>{readyCount}/{total} ready</p>
          </div>
        </div>
      </div>
    )
  }

  // ── PLAYING PHASE ──────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <ScoreFloat />
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => window.history.back()}>← Back to Games</button>
        <div className={styles.topTitle}>🎯 Number Guessing</div>
        <div className={styles.topRoom}>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
      </div>

      <div className={`${styles.turnBanner} ${myTurn ? styles.myTurnBanner : styles.theirTurnBanner}`}>
        {myTurn
          ? <><span className={styles.turnIcon}>⚡</span> It's your turn — make a guess!</>
          : <><span className={`${styles.turnIcon} ${styles.spinIcon}`}>⏳</span> {gs.currentTurn}'s turn...</>
        }
      </div>

      {/* Floating reactions */}
      <div className={styles.reactionsFloat}>
        {reactions.map(r => (
          <div key={r.id} className={styles.reactionPop}>
            <span>{r.emoji}</span>
            <span className={styles.reactionFrom}>{r.from}</span>
          </div>
        ))}
      </div>

      <div className={styles.cardsRow}>
        {/* MY card */}
        <div className={`${styles.playerCard} ${myTurn ? styles.activeCard : ''}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardNameRow}>
              <span className={styles.cardName}>{myName}</span>
              <span className={styles.youBadge}>YOU</span>
            </div>
            <span className={styles.guessCountBadge}>{myGuesses.length} guesses</span>
          </div>

          {/* FIX: broken ternary replaced with explicit check */}
          <div className={styles.secretRow}>
            Secret: <strong style={{ color: '#6C63FF' }}>
              {secretSet ? '🔒' : '?'}
            </strong>
          </div>
          {others.length > 0 && (
            <div className={styles.guessingTarget}>
              Guessing <span className={styles.guessingTargetName}>{others[0]}</span>'s number
            </div>
          )}

          <div className={`${styles.statusBar} ${myTurn ? styles.myTurnBar : styles.waitBar}`}>
            {myTurn
              ? <><span className={styles.pulseIcon}>✨</span> Your turn — guess now!</>
              : <><span className={styles.spinIcon}>⏳</span> Waiting for your turn...</>
            }
          </div>

          <div className={styles.rangeSection}>
            <span className={styles.rangeLabel}>🔍 SEARCH RANGE</span>
            <div className={styles.rangeTrack}>
              <div className={styles.rangeFill} style={{
                left:  `${((myRange.low  - 1) / 999) * 100}%`,
                right: `${((1000 - myRange.high) / 999) * 100}%`,
              }} />
            </div>
            <div className={styles.rangeNumbers}>
              <span>{myRange.low}</span>
              <span className={styles.rangeCenter}>
                {myLastGuess
                  ? `${myLastGuess.hint === 'correct' ? '🎯' : myLastGuess.hint === 'low' ? '⬆️' : '⬇️'} ${myLastGuess.number}`
                  : 'Start guessing!'}
              </span>
              <span>{myRange.high}</span>
            </div>
            {myLastGuess && (() => { const p = getProximityMsg(myRange.low, myRange.high); return (
              <div style={{ textAlign:'center', fontSize:'0.78rem', fontWeight:700, color:p.color, fontFamily:"'Space Grotesk',sans-serif", marginTop:'3px' }}>{p.msg}</div>
            )})()}
          </div>

          <div className={styles.guessList}>
            {myGuesses.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🎯</span>
                <span>No guesses yet</span>
              </div>
            ) : (
              [...myGuesses].reverse().map((g, i) => (
                <div key={i} className={`${styles.guessChip} ${i===0&&newGuessFlash?styles.guessChipNew:''}`}
                  style={{ background: hintBg(g.hint), borderColor: hintColor(g.hint) }}>
                  <span className={styles.guessChipNum} style={{ color: hintColor(g.hint) }}>{g.number}</span>
                  <span className={styles.guessChipHint} style={{ color: hintColor(g.hint) }}>{hintShort(g.hint)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* OPPONENT cards */}
        {others.map(name => {
          const theirGuesses = (gs.guesses || {})[name] || []
          const theirRange   = (gs.ranges  || {})[name] || { low: 1, high: 1000 }
          const theirLast    = theirGuesses[theirGuesses.length - 1]
          const theirTurn    = gs.currentTurn === name

          return (
            <div key={name} className={`${styles.playerCard} ${theirTurn ? styles.activeCard : ''}`}>
              <div className={styles.cardHeader}>
                <span className={styles.cardName}>{name}</span>
                <span className={styles.guessCountBadge}>{theirGuesses.length} guesses</span>
              </div>

              <div className={styles.statusBar}
                style={{ background: theirTurn ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.05)', borderColor: theirTurn ? '#6C63FF' : 'rgba(255,255,255,0.12)' }}>
                {theirTurn
                  ? <><span className={styles.pulseIcon}>✨</span> Their turn</>
                  : <><span className={styles.spinIcon}>⏳</span> Waiting...</>
                }
              </div>

              <div className={styles.rangeSection}>
                <span className={styles.rangeLabel}>🔍 SEARCH RANGE</span>
                <div className={styles.rangeTrack}>
                  <div className={styles.rangeFill} style={{
                    left:  `${((theirRange.low  - 1) / 999) * 100}%`,
                    right: `${((1000 - theirRange.high) / 999) * 100}%`,
                  }} />
                </div>
                <div className={styles.rangeNumbers}>
                  <span>{theirRange.low}</span>
                  <span className={styles.rangeCenter}>
                    {theirLast
                      ? `${theirLast.hint === 'correct' ? '🎯' : theirLast.hint === 'low' ? '⬆️' : '⬇️'} ${theirLast.number}`
                      : 'Waiting...'}
                  </span>
                  <span>{theirRange.high}</span>
                </div>
                {theirLast && (() => { const p = getProximityMsg(theirRange.low, theirRange.high); return (
                  <div style={{ textAlign:'center', fontSize:'0.78rem', fontWeight:700, color:p.color, fontFamily:"'Space Grotesk',sans-serif", marginTop:'3px' }}>{p.msg}</div>
                )})()}
              </div>

              <div className={styles.guessList}>
                {theirGuesses.length === 0 ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>⏳</span>
                    <span>Waiting...</span>
                  </div>
                ) : (
                  [...theirGuesses].reverse().map((g, i) => (
                    <div key={i} className={styles.guessChip}
                      style={{ background: hintBg(g.hint), borderColor: hintColor(g.hint) }}>
                      <span className={styles.guessChipNum} style={{ color: hintColor(g.hint) }}>{g.number}</span>
                      <span className={styles.guessChipHint} style={{ color: hintColor(g.hint) }}>{hintShort(g.hint)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom controls */}
      <div className={styles.bottomBar}>
        <form onSubmit={submitGuess} className={styles.guessForm}>
          <span className={styles.guessFormLabel}>Your Guess:</span>
          <div className={styles.guessRow}>
            <input
              ref={guessRef}
              className={`${styles.guessInput} ${shakeInput ? styles.shake : ''} ${!myTurn ? styles.disabledInput : ''}`}
              type="number" min={1} max={1000}
              placeholder={myTurn ? 'Enter a number (1–1000)' : `Waiting for ${gs.currentTurn}...`}
              value={guess}
              onChange={e => setGuess(e.target.value)}
              disabled={!myTurn}
            />
            <button
              className={`${styles.submitBtn} ${!myTurn ? styles.disabledBtn : ''}`}
              type="submit" disabled={!myTurn}
            >
              Submit
            </button>
          </div>
        </form>
        <div style={{ display:'flex', justifyContent:'center' }}>
          <TauntPicker onSend={sendReaction} />
        </div>
      </div>

      <button className={styles.leaveBtn} type="button" onClick={leaveGame}>🚪 Leave Game</button>
    </div>
  )
}