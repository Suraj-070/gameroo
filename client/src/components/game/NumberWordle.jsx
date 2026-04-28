import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../../context/SocketContext'
import { useRoom } from '../../context/RoomContext'
import { useToast } from '../ui/Toast'
import { useLeaveGuard, useReactionCooldown, usePageTitle } from '../../hooks/useGameUtils'
import ScoreFloat from '../ui/ScoreFloat'
import { useSound, Haptics } from '../../hooks/useSound'
import styles from './NumberWordle.module.css'
import SoundToggle from '../ui/SoundToggle'

const MAX_GUESSES = 6

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

const EMOJIS = ['🔥','😤','💀','🎉','😱']

const DIFF_META = {
  easy:   { icon: '🟢', label: 'Easy',   desc: '4 digits · no repeats', color: '#10B981' },
  medium: { icon: '🟡', label: 'Medium', desc: '5 digits · no repeats', color: '#F59E0B' },
  hard:   { icon: '🔴', label: 'Hard',   desc: '5 digits · repeats ok', color: '#EF4444' },
}

// ── GuessRow outside component ─────────────────────────────────────
function GuessRow({ entry }) {
  if (!entry?.digits || !entry?.feedback) return null
  return (
    <div className={styles.guessRow}>
      {entry.digits.map((d, i) => (
        <div key={i} className={`${styles.cube} ${styles[entry.feedback[i]] || ''}`}
          style={{ animationDelay: `${i * 120}ms` }}>
          <div className={styles.cubeFront}>{d}</div>
        </div>
      ))}
    </div>
  )
}

function EmptyRow({ size }) {
  return (
    <div className={styles.guessRow}>
      {Array.from({ length: size }).map((_, j) => (
        <div key={j} className={`${styles.cube} ${styles.emptyCube}`}>
          <div className={styles.cubeFront} />
        </div>
      ))}
    </div>
  )
}

export default function NumberWordle({ roomCode }) {
  const { socket } = useSocket()
  const { room, dispatch } = useRoom()
  const toast        = useToast()
  const gs    = room.gameState || {}

  // Individual refs — no hooks in arrays
  const s0=useRef(),s1=useRef(),s2=useRef(),s3=useRef(),s4=useRef()
  const i0=useRef(),i1=useRef(),i2=useRef(),i3=useRef(),i4=useRef()
  const secretRefs = [s0,s1,s2,s3,s4]
  const inputRefs  = [i0,i1,i2,i3,i4]

  const [secret, setSecret]           = useState(['','','','',''])
  const [secretSet, setSecretSet]     = useState(false)
  const [digits, setDigits]           = useState(['','','','',''])
  const [shakeRow, setShakeRow]       = useState(false)
  const [reactions, setReactions]     = useState([])
  const [selectedDiff, setSelectedDiff] = useState('easy')

  const myName    = room.playerName
  const players   = gs.players || []
  const phase     = gs.phase || 'difficulty'
  const isHost    = gs.hostId ? gs.hostId === myName : room.isHost
  const myTurn    = gs.currentTurn === myName

  const leaveGame    = useLeaveGuard(socket, roomCode, phase)
  const sendReaction = useReactionCooldown(socket, roomCode)
  usePageTitle(myTurn && phase==='playing', 'Number Wordle')


  const myGuesses = (gs.guesses || {})[myName] || []
  const others    = players.filter(n => n !== myName)
  const cfg       = gs.diffConfig || { digits: 4, repeats: false }
  const difficulty = gs.difficulty || 'easy'
  const diffMeta  = DIFF_META[difficulty] || DIFF_META.easy

  // Sync digit arrays to current difficulty
  const digitCount = cfg.digits || 4
  useEffect(() => {
    setSecret(Array(5).fill(''))
    setDigits(Array(5).fill(''))
  }, [digitCount])

  useEffect(() => {
    if (!socket) return
    const onReaction = ({ from, emoji }) => {
      const id = Date.now() + Math.random()
      setReactions(r => [...r, { id, from, emoji }])
      setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 2200)
    }
    const onValErr = ({ message }) => { toast.warning(message); triggerShake() }
    const onState  = (gameState) => dispatch({ type: 'SET_GAME_STATE', gameState })

    socket.on('game:reaction',        onReaction)
    socket.on('game:validation-error', onValErr)
    socket.on('game:state',            onState)
    return () => {
      socket.off('game:reaction',        onReaction)
      socket.off('game:validation-error', onValErr)
      socket.off('game:state',            onState)
    }
  }, [socket])

  useEffect(() => {
    if (myTurn && phase === 'playing') setTimeout(() => inputRefs[0].current?.focus(), 100)
  }, [myTurn, phase])

  function handleSecretKey(i, e) {
    const val = e.target.value.replace(/\D/g,'').slice(-1)
    setSecret(prev => { const n=[...prev]; n[i]=val; return n })
    if (val && i < digitCount-1) secretRefs[i+1].current?.focus()
    if (!val && e.nativeEvent.inputType==='deleteContentBackward' && i>0) secretRefs[i-1].current?.focus()
  }

  function submitSecret(e) {
    e.preventDefault()
    const s = secret.slice(0, digitCount).join('')
    if (s.length !== digitCount) { toast.warning(`Enter all ${digitCount} digits`); return }
    if (!cfg.repeats && new Set(s).size !== digitCount) { toast.warning('All digits must be unique'); return }
    socket.emit('game:action', { roomCode, action: 'set-secret', payload: { number: s } })
    setSecretSet(true)
  }

  function handleDigitKey(i, e) {
    const val = e.target.value.replace(/\D/g,'').slice(-1)
    setDigits(prev => { const n=[...prev]; n[i]=val; return n })
    if (val && i < digitCount-1) inputRefs[i+1].current?.focus()
    if (!val && e.nativeEvent.inputType==='deleteContentBackward' && i>0) inputRefs[i-1].current?.focus()
  }

  function handleDigitKeyDown(i, e) {
    if (e.key==='Backspace' && !digits[i] && i>0) inputRefs[i-1].current?.focus()
    if (e.key==='Enter') submitGuess()
  }

  function submitGuess() {
    if (!myTurn) return
    const g = digits.slice(0, digitCount).join('')
    if (g.length !== digitCount) { toast.warning(`Enter all ${digitCount} digits`); triggerShake(); return }
    if (!cfg.repeats && new Set(g).size !== digitCount) { toast.warning('All digits must be unique'); triggerShake(); return }
    socket.emit('game:action', { roomCode, action: 'guess', payload: { guess: g } })
    setDigits(Array(5).fill(''))
    setTimeout(() => inputRefs[0].current?.focus(), 50)
  }

  function triggerShake() {
    setShakeRow(true)
    setTimeout(() => setShakeRow(false), 500)
  }



  const emptyCount = Math.max(0, MAX_GUESSES - myGuesses.length - (phase==='playing' ? 1 : 0))

  // ── GAME OVER ──────────────────────────────────────────────────
  if (phase === 'over') {
    const winner  = gs.winner
    const iWon    = winner === myName
    const secrets = gs.secrets || {}
    const counts  = gs.guessCounts || {}
    return (
      <div className={styles.page}>
        <Topbar roomCode={roomCode} diffMeta={diffMeta} />
        <div className={styles.setupWrap}>
          <div className={styles.setupCard}>
            <div className={styles.setupEmoji}>{iWon ? '🏆' : '😢'}</div>
            <h2 className={styles.setupTitle}>{iWon ? 'You Won!' : `${winner} Won!`}</h2>
            <p className={styles.setupSub}>{iWon ? `Cracked in ${counts[myName]} guess${counts[myName]!==1?'es':''}!` : `Solved in ${counts[winner]} guess${counts[winner]!==1?'es':''}!`}</p>
            <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {players.map(n => (
                <div key={n} className={styles.playerReadyRow}>
                  <span style={{ fontWeight:700 }}>{n}{n===myName&&<span className={styles.youBadge}> YOU</span>}</span>
                  <div style={{ display:'flex', gap:'4px' }}>
                    {(secrets[n]||'????').split('').map((d,i)=>(
                      <span key={i} className={styles.secretDigit}>{d}</span>
                    ))}
                  </div>
                  <span style={{ fontSize:'0.78rem', color:'#6C63FF', fontWeight:700 }}>{counts[n]||0} guesses</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize:'0.72rem', color:'#9CA3AF' }}>Returning to lobby...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── DIFFICULTY PICKER ──────────────────────────────────────────
  if (phase === 'difficulty') {
    const currentDiff = gs.difficulty || selectedDiff
    return (
      <div className={styles.page}>
        <Topbar roomCode={roomCode} diffMeta={null} />
        <div className={styles.setupWrap}>
          <div className={styles.setupCard}>
            <div className={styles.setupEmoji}>⚙️</div>
            <h2 className={styles.setupTitle}>
              {isHost ? 'Choose Difficulty' : 'Waiting for host...'}
            </h2>
            <p className={styles.setupSub}>
              {isHost ? 'Pick the rules for both players' : `${gs.hostId || 'Host'} is choosing difficulty...`}
            </p>

            <div className={styles.diffGrid}>
              {Object.entries(DIFF_META).map(([key, meta]) => (
                <button
                  key={key}
                  className={`${styles.diffCard} ${(isHost ? selectedDiff : currentDiff) === key ? styles.diffSelected : ''}`}
                  style={{ '--diff-color': meta.color }}
                  onClick={() => {
                    if (!isHost) return
                    setSelectedDiff(key)
                    socket.emit('game:action', { roomCode, action: 'set-difficulty', payload: { difficulty: key } })
                  }}
                  disabled={!isHost}
                >
                  <span className={styles.diffIcon}>{meta.icon}</span>
                  <span className={styles.diffLabel}>{meta.label}</span>
                  <span className={styles.diffDesc}>{meta.desc}</span>
                </button>
              ))}
            </div>

            {!isHost && gs.difficulty && (
              <div className={styles.diffPreview}>
                {DIFF_META[gs.difficulty]?.icon} Host selected: <strong>{DIFF_META[gs.difficulty]?.label}</strong> — {DIFF_META[gs.difficulty]?.desc}
              </div>
            )}

            {isHost && (
              <button className={styles.setupBtn} onClick={() => {
                socket.emit('game:action', { roomCode, action: 'confirm-difficulty', payload: { difficulty: selectedDiff } })
              }}>
                Confirm &amp; Set Numbers →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── SETUP ──────────────────────────────────────────────────────
  if (phase === 'setup') {
    const ready      = gs.ready || {}
    const readyCount = Object.values(ready).filter(Boolean).length
    return (
      <div className={styles.page}>
        <Topbar roomCode={roomCode} diffMeta={diffMeta} />
        <div className={styles.setupWrap}>
          <div className={styles.setupCard}>
            <div className={styles.setupEmoji}>🔒</div>
            <h2 className={styles.setupTitle}>Set your {digitCount}-digit secret</h2>
            <p className={styles.setupSub}>
              {cfg.repeats ? `Any ${digitCount} digits (0–9, repeats allowed)` : `${digitCount} different digits (0–9, no repeats)`}
            </p>

            <div className={styles.legendRow}>
              <span className={`${styles.legendCube} ${styles.green}`}>5</span>
              <span className={styles.legendText}>Right spot</span>
              <span className={`${styles.legendCube} ${styles.yellow}`}>3</span>
              <span className={styles.legendText}>Wrong spot</span>
              <span className={`${styles.legendCube} ${styles.gray}`}>7</span>
              <span className={styles.legendText}>Not in number</span>
            </div>

            {!secretSet ? (
              <form onSubmit={submitSecret} className={styles.setupForm}>
                <div className={styles.digitRow}>
                  {Array.from({ length: digitCount }).map((_, i) => (
                    <input key={i} ref={secretRefs[i]}
                      className={styles.digitBox}
                      type="text" inputMode="numeric" maxLength={1}
                      value={secret[i] || ''}
                      onChange={e => handleSecretKey(i, e)}
                      autoFocus={i===0}
                    />
                  ))}
                </div>
                <button className={styles.setupBtn} type="submit">Lock it in 🔒</button>
              </form>
            ) : (
              <div className={styles.lockedBadge}>🔒 Locked! Waiting for others...</div>
            )}

            <div className={styles.playerReadyList}>
              {players.map(n => (
                <div key={n} className={styles.playerReadyRow}>
                  <span>{n}{n===myName&&<span className={styles.youBadge}> YOU</span>}</span>
                  <span style={{ color: ready[n]?'#10B981':'#9CA3AF', fontWeight:700, fontSize:'0.78rem' }}>
                    {ready[n] ? '✓ Ready' : '⏳ Choosing...'}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.readyBar}>
              <div className={styles.readyFill} style={{ width:`${players.length>0?(readyCount/players.length)*100:0}%` }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PLAYING ────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <ScoreFloat />
      <Topbar roomCode={roomCode} diffMeta={diffMeta} />

      <div className={`${styles.turnBanner} ${myTurn ? styles.myTurnBanner : styles.theirTurnBanner}`}>
        <span style={{ fontSize:'0.7rem', background: diffMeta.color+'22', color: diffMeta.color, padding:'1px 7px', borderRadius:'999px', fontWeight:700, fontFamily:'var(--font-display)', flexShrink:0 }}>
          {diffMeta.icon} {diffMeta.label}
        </span>
        {myTurn
          ? <><span className={styles.pulseIcon}>⚡</span> Your turn — enter your guess!</>
          : <><span className={styles.spinIcon}>⏳</span> {gs.currentTurn}'s turn...</>
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

      <div className={styles.mainGrid}>
        {/* MY PANEL */}
        <div className={`${styles.panel} ${myTurn ? styles.activePanel : ''}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelNameRow}>
              <span className={styles.panelName}>{myName}</span>
              <span className={styles.youBadge}>YOU</span>
            </div>
            <span className={styles.panelCount}>{myGuesses.length}/{MAX_GUESSES}</span>
          </div>
          <div className={styles.secretDisplay}>
            Secret: <span className={styles.secretValue}>
              {secret.slice(0, digitCount).map((d, i) => (
                <span key={i} className={d ? styles.secretDigit : styles.secretHidden}>
                  {d || '?'}
                </span>
              ))}
            </span>
          </div>
          <div className={`${styles.statusPill} ${myTurn ? styles.myTurnPill : styles.waitPill}`}>
            {myTurn ? <><span className={styles.pulseIcon}>✨</span> Your turn</> : <><span className={styles.spinIcon}>⏳</span> Waiting...</>}
          </div>
          {gs.winner === myName && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(16,185,129,0.12)', borderRadius:'inherit', zIndex:5, pointerEvents:'none' }}>
              <div style={{ background:'rgba(16,185,129,0.9)', color:'#fff', fontFamily:"'Space Grotesk',sans-serif", fontWeight:800, fontSize:'1.1rem', padding:'0.5rem 1.25rem', borderRadius:'12px', boxShadow:'0 4px 20px rgba(16,185,129,0.4)' }}>🎉 SOLVED!</div>
            </div>
          )}
          <div className={styles.guessGrid}>
            {myGuesses.map((entry, ri) => <GuessRow key={ri} entry={entry} />)}
            {phase==='playing' && myGuesses.length < MAX_GUESSES && (() => {
              const guessesLeft = MAX_GUESSES - myGuesses.length
              return (
              <div className={`${styles.guessRow} ${shakeRow && myTurn ? styles.shakeRow : ''}`}>
                {Array.from({length:digitCount}).map((_, i) => (
                  <div key={i} className={`${styles.cube} ${styles.inputCube} ${digits[i] ? styles.filledCube : ''} ${guessesLeft<=2?styles.dangerCube:guessesLeft<=3?styles.warnCube:''}`}>
                    <input ref={inputRefs[i]} className={styles.cubeInput}
                      type="text" inputMode="numeric" maxLength={1}
                      value={digits[i] || ''}
                      onChange={e => handleDigitKey(i, e)}
                      onKeyDown={e => handleDigitKeyDown(i, e)}
                      disabled={!myTurn}
                    />
                  </div>
                ))}
              </div>
              )
            })()}
            {Array.from({length:emptyCount}).map((_,i) => <EmptyRow key={`e${i}`} size={digitCount} />)}
          </div>
        </div>

        {/* OPPONENT PANELS */}
        {others.map(name => {
          const theirGuesses = (gs.guesses||{})[name] || []
          const theirTurn    = gs.currentTurn === name
          const theirEmpty   = Math.max(0, MAX_GUESSES - theirGuesses.length - (phase==='playing'?1:0))
          return (
            <div key={name} className={`${styles.panel} ${theirTurn ? styles.activePanel : ''}`}>
              <div className={styles.panelHeader}>
                <span className={styles.panelName}>{name}</span>
                <span className={styles.panelCount}>{theirGuesses.length}/{MAX_GUESSES}</span>
              </div>
              <div className={styles.secretDisplay}>
                Secret: {Array.from({length:digitCount}).map((_,i)=><span key={i} className={styles.secretHidden}>?</span>)}
              </div>
              <div className={`${styles.statusPill} ${theirTurn ? styles.myTurnPill : styles.waitPill}`}>
                {theirTurn ? <><span className={styles.pulseIcon}>✨</span> Their turn</> : <><span className={styles.spinIcon}>⏳</span> Waiting...</>}
              </div>
              <div className={styles.guessGrid}>
                {theirGuesses.map((entry, ri) => <GuessRow key={ri} entry={entry} />)}
                {phase==='playing' && theirGuesses.length < MAX_GUESSES && (
                  <div className={styles.guessRow}>
                    {Array.from({length:digitCount}).map((_,i)=>(
                      <div key={i} className={`${styles.cube} ${theirTurn ? styles.waitingCube : styles.emptyCube}`}>
                        <div className={styles.cubeFront}>{theirTurn ? '?' : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
                {Array.from({length:theirEmpty}).map((_,i)=><EmptyRow key={`te${i}`} size={digitCount} />)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom */}
      <div className={styles.bottomBar}>
        <div className={styles.guessSection}>
          <span className={styles.guessLabel}>Your Guess:</span>
          <div className={styles.guessSubmitRow}>
            <div className={styles.guessDigits}>
              {Array.from({length:digitCount}).map((_,i) => (
                <div key={i} className={`${styles.bottomDigitBox} ${digits[i] ? styles.filledBox : ''}`}>
                  {digits[i] || <span className={styles.digitPlaceholder}>_</span>}
                </div>
              ))}
            </div>
            <button className={`${styles.submitBtn} ${!myTurn ? styles.disabledBtn : ''}`}
              onClick={submitGuess} disabled={!myTurn} type="button">Submit</button>
          </div>
          {!myTurn && <p className={styles.waitingMsg}>Waiting for {gs.currentTurn}...</p>}
        </div>
        <div style={{ display:'flex', justifyContent:'center' }}>
          <TauntPicker onSend={sendReaction} />
        </div>
      </div>
      <button className={styles.leaveBtn} type="button" onClick={leaveGame}>🚪 Leave Game</button>
    </div>
  )
}

function Topbar({ roomCode, diffMeta }) {
  return (
    <div className='gameTopbar'>
      <button className='gameBackBtn' onClick={() => window.history.back()}>← Back to Games</button>
      <div className='gameTitle' style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
        🟩 Number Wordle
        {diffMeta && <span style={{ fontSize:'0.72rem', background: diffMeta.color+'22', color: diffMeta.color, border:`1px solid ${diffMeta.color}44`, padding:'2px 8px', borderRadius:'999px', fontWeight:700 }}>{diffMeta.icon} {diffMeta.label}</span>}
      </div>
      <div className='gameTopbarRight'>
        <div className='gameRoom'>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
      </div>
    </div>
  )
}
