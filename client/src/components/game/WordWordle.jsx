import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSocket } from '../../context/SocketContext'
import { useRoom } from '../../context/RoomContext'
import styles from './WordWordle.module.css'
import SoundToggle from '../ui/SoundToggle'
import { useToast } from '../ui/Toast'
import { useSound, Haptics } from '../../hooks/useSound'
import { useLeaveGuard, usePageTitle } from '../../hooks/useGameUtils'
import { fireConfetti } from '../../hooks/useConfetti'
import ScoreFloat from '../ui/ScoreFloat'

const MAX_GUESSES = 6
const WORD_LEN    = 5

// ── Expandable Taunt Picker — shared across all games ─────────────
const TAUNT_CATEGORIES = [
  { label: '🔥 Hype',    emojis: ['🔥','⚡','💥','🚀','🎯','💪','🏆','👑'] },
  { label: '😈 Trash',   emojis: ['😈','😤','💀','🤡','🫵','👻','🙈','🤣'] },
  { label: '😬 Nervous', emojis: ['😱','😰','😬','🫣','🤯','😵','🙃','😭'] },
  { label: '🎉 Hype',    emojis: ['🎉','🥳','✨','🎊','🫶','😍','🤩','💯'] },
  { label: '🤫 Smug',    emojis: ['😏','🧐','🫠','🤭','😴','👀','💅','🫡'] },
]

function TauntPicker({ onSend, cooldownMs = 2500 }) {
  const [open, setOpen]       = useState(false)
  const [cat, setCat]         = useState(0)
  const [cooldown, setCooldown] = useState(false)
  const [lastSent, setLastSent] = useState(null)
  const [flash, setFlash]     = useState(null)
  const ref                   = useRef(null)

  // Close on outside click
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
    <div style={{ position:'relative', display:'flex', alignItems:'center', gap:'0.5rem' }} ref={ref}>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: open ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)',
          border: `1.5px solid ${open ? 'rgba(196,181,253,0.5)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '12px', padding: '0.5rem 0.875rem',
          color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          transition: 'all 0.15s',
        }}
      >
        {lastSent || '😈'} Taunt {open ? '▲' : '▼'}
        {cooldown && (
          <span style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.4)', marginLeft:'2px' }}>cd</span>
        )}
      </button>

      {/* Picker panel */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
          background: 'rgba(15,10,40,0.97)', border: '1.5px solid rgba(196,181,253,0.2)',
          borderRadius: '18px', padding: '0.875rem', zIndex: 100, minWidth: '280px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
          animation: 'tauntPickerIn 0.18s ease',
        }}>
          {/* Category tabs */}
          <div style={{ display:'flex', gap:'4px', marginBottom:'0.625rem', flexWrap:'wrap' }}>
            {TAUNT_CATEGORIES.map((c,i) => (
              <button key={i} type="button"
                onClick={() => setCat(i)}
                style={{
                  padding: '3px 8px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700,
                  border: `1.5px solid ${cat===i ? 'rgba(196,181,253,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  background: cat===i ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)',
                  color: cat===i ? '#c4b5fd' : 'rgba(255,255,255,0.5)', cursor: 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >{c.label}</button>
            ))}
          </div>
          {/* Emoji grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:'4px' }}>
            {TAUNT_CATEGORIES[cat].emojis.map(e => (
              <button key={e} type="button"
                onClick={() => send(e)}
                disabled={cooldown}
                style={{
                  width: '34px', height: '34px', fontSize: '1.15rem',
                  background: flash===e ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)',
                  border: `1.5px solid ${flash===e ? '#c4b5fd' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '8px', cursor: cooldown ? 'not-allowed' : 'pointer',
                  transition: 'all 0.12s', display:'flex', alignItems:'center', justifyContent:'center',
                  opacity: cooldown && flash!==e ? 0.4 : 1,
                }}
                onMouseEnter={e2 => !cooldown && (e2.currentTarget.style.transform='scale(1.2)')}
                onMouseLeave={e2 => (e2.currentTarget.style.transform='scale(1)')}
              >{e}</button>
            ))}
          </div>
          {cooldown && (
            <p style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.35)', textAlign:'center', margin:'0.5rem 0 0', fontStyle:'italic' }}>
              Cooldown... wait a moment
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
]

// FIX: GuessRow outside component — no re-creation on render
function GuessRow({ letters, feedback }) {
  return (
    <div className={styles.row}>
      {letters.map((l, ci) => (
        <div key={ci} className={`${styles.cube} ${styles[feedback[ci]]}`}
          style={{ animationDelay: `${ci * 120}ms` }}>
          {l}
        </div>
      ))}
    </div>
  )
}

function OpponentGuessRow({ feedback }) {
  return (
    <div className={styles.row}>
      {feedback.map((fb, ci) => (
        <div key={ci} className={`${styles.cube} ${styles[`h_${fb}`]}`}
          style={{ animationDelay: `${ci * 120}ms` }} />
      ))}
    </div>
  )
}

function EmptyRow() {
  return (
    <div className={styles.row}>
      {Array.from({length: WORD_LEN}).map((_,ci) => (
        <div key={ci} className={`${styles.cube} ${styles.emptyCube}`} />
      ))}
    </div>
  )
}

export default function WordWordle({ roomCode }) {
  const { socket } = useSocket()
  const { room, dispatch } = useRoom()
  const gs         = room.gameState || {}
  const sound      = useSound()
  const toast      = useToast()

  const myName   = room.playerName
  const players  = gs.players || []
  const phase    = gs.phase  // null = loading, 'ready'/'playing'/'over' from server
  const myGuesses = (gs.guesses || {})[myName] || []
  const myCount  = gs.guessCounts?.[myName] || 0
  const mySolved = gs.solved?.[myName] || false
  const others   = players.filter(n => n !== myName)

  const leaveGame  = useLeaveGuard(socket, roomCode, phase)
  usePageTitle(!mySolved && phase==='playing', 'Word Wordle')

  const [currentWord, setCurrentWord] = useState('')
  const [shakeRow, setShakeRow]       = useState(false)
  const [taunts, setTaunts]           = useState([])
  const [oppTypingCount, setOppTypingCount] = useState(0)
  const [readySet, setReadySet]       = useState(false)
  // FIX: derive from server state so it stays in sync across reconnects
  const iAmReady = readySet || (gs.ready?.[myName] === true)

  const inputRef    = useRef(null)
  const typingTimer = useRef(null)
  const prevCount   = useRef(0)

  // FIX: currentWord in ref so keydown handler always has fresh value
  const currentWordRef = useRef('')
  useEffect(() => { currentWordRef.current = currentWord }, [currentWord])

  // Build keyboard colour map
  const keyState = useMemo(() => {
    const map = {}
    const pri = { green: 3, yellow: 2, gray: 1 }
    myGuesses.forEach(({ letters, feedback }) => {
      letters.forEach((l, i) => {
        const cur = feedback[i], prev = map[l]
        if (!prev || (pri[cur]||0) > (pri[prev]||0)) map[l] = cur
      })
    })
    return map
  }, [myGuesses])

  // If we arrive with no game state (e.g. after rejoin), request it from server
  // NOTE: room:rejoin is intentionally NOT here — only request-state to avoid toast spam
  useEffect(() => {
    if (!socket || phase) return
    socket.emit('room:request-state', { roomCode })
    // Retry up to 5 times (7.5s total) in case of timing race on first connect
    let attempts = 0
    const retryInterval = setInterval(() => {
      if (attempts >= 4) { clearInterval(retryInterval); return }
      socket.emit('room:request-state', { roomCode })
      attempts++
    }, 1500)
    return () => clearInterval(retryInterval)
  }, [socket, roomCode])

  // FIX: named handler refs for proper socket cleanup
  useEffect(() => {
    if (!socket) return
    const onValErr = ({ message }) => {
      toast.warning(message)
      setShakeRow(true)
      sound.wrong()
      setTimeout(() => setShakeRow(false), 700)
    }
    const onReaction = ({ from, emoji }) => {
      const id = Date.now() + Math.random()
      sound.taunt()
      setTaunts(t => [...t, { id, from, emoji }])
      setTimeout(() => setTaunts(t => t.filter(x => x.id !== id)), 2500)
    }
    const onTyping     = ({ from, count }) => { if (from !== myName) setOppTypingCount(count || 1) }
    const onStopTyping = ({ from }) => { if (from !== myName) setOppTypingCount(0) }

    socket.on('game:validation-error', onValErr)
    socket.on('game:reaction',         onReaction)
    socket.on('game:typing',           onTyping)
    socket.on('game:stop-typing',      onStopTyping)
    return () => {
      socket.off('game:validation-error', onValErr)
      socket.off('game:reaction',         onReaction)
      socket.off('game:typing',           onTyping)
      socket.off('game:stop-typing',      onStopTyping)
    }
  }, [socket, myName])

  // Sound on new guess
  useEffect(() => {
    if (myCount > prevCount.current) {
      const last = myGuesses[myGuesses.length - 1]
      if (last) {
        if (last.feedback.every(f => f === 'green')) sound.correct()
        else sound.submit()
      }
      prevCount.current = myCount
    }
  }, [myCount])

  // Auto-focus
  useEffect(() => {
    if (phase === 'playing' && !mySolved) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [phase, mySolved])

  // Window keydown — skip if input is focused (input handles its own keys)
  useEffect(() => {
    function onKey(e) {
      if (phase !== 'playing' || mySolved) return
      if (document.activeElement === inputRef.current) return // input handles it
      const k = e.key.toUpperCase()
      if (k === 'BACKSPACE') {
        e.preventDefault()
        setCurrentWord(w => w.slice(0,-1))
      } else if (k === 'ENTER') {
        e.preventDefault()
        handleSubmit()
      } else if (/^[A-Z]$/.test(k) && currentWordRef.current.length < WORD_LEN) {
        setCurrentWord(w => w + k)
        emitTyping(currentWordRef.current.length + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, mySolved])

  function emitTyping(count) {
    socket.emit('game:action', { roomCode, action: 'typing', payload: { count } })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socket.emit('game:action', { roomCode, action: 'stop-typing', payload: {} })
    }, 1500)
  }

  function handleSubmit() {
    const word = currentWordRef.current
    if (word.length !== WORD_LEN) {
      setShakeRow(true)
      setTimeout(() => setShakeRow(false), 500)
      return
    }
    socket.emit('game:action', { roomCode, action: 'guess', payload: { guess: word } })
    setCurrentWord('')
    socket.emit('game:action', { roomCode, action: 'stop-typing', payload: {} })
  }

  function setReady() {
    if (iAmReady) return  // prevent double-fire
    socket.emit('game:action', { roomCode, action: 'ready', payload: {} })
    setReadySet(true)
  }

  function sendTaunt(emoji) {
    socket.emit('game:action', { roomCode, action: 'react', payload: { emoji } })
  }



  const activeLetters = currentWord.padEnd(WORD_LEN, '').split('')

  // ── LOADING (no state yet) ────────────────────────────────────
  if (!phase) {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => window.history.back()}>← Back</button>
          <div className={styles.topTitle}>🔤 Word Wordle</div>
          <div className={styles.topRoom}>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
        </div>
        <div className={styles.readyWrap}>
          <div className={styles.readyCard}>
            <div className={styles.readyEmoji}>⏳</div>
            <h2 className={styles.readyTitle}>Connecting...</h2>
            <p className={styles.readySub}>Waiting for game state...</p>
            <button
              onClick={() => {
                if (socket && roomCode) {
                  socket.emit('room:request-state', { roomCode })
                }
              }}
              style={{
                marginTop:'0.5rem', padding:'0.6rem 1.25rem',
                background:'rgba(139,92,246,0.2)', border:'1px solid rgba(196,181,253,0.3)',
                borderRadius:'var(--radius)', color:'#c4b5fd', cursor:'pointer',
                fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.82rem'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── GAME OVER ──────────────────────────────────────────────────
  if (phase === 'over') {
    const winner = gs.winner
    const iWon   = winner === myName
    const bothFailed = gs.bothFailed
    const counts = gs.guessCounts || {}
    const word   = gs.word || ''

    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => window.history.back()}>← Back</button>
          <div className={styles.topTitle}>🔤 Word Wordle</div>
          <div className={styles.topRoom}>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
        </div>
        <div className={styles.readyWrap}>
          <div className={styles.readyCard}>
            <div className={styles.readyEmoji}>{bothFailed ? '🤝' : iWon ? '🏆' : '😢'}</div>
            <h2 className={styles.readyTitle}>
              {bothFailed ? "Nobody got it!" : iWon ? "You Won!" : `${winner} Won!`}
            </h2>
            <p className={styles.readySub}>
              {bothFailed ? "The word remains a mystery..." : iWon
                ? `Solved in ${counts[myName]} guess${counts[myName]!==1?'es':''}!`
                : `${winner} solved it in ${counts[winner]} guess${counts[winner]!==1?'es':''}!`}
            </p>
            {word && (
              <div style={{ display:'flex', gap:'6px', margin:'0.5rem 0' }}>
                {word.split('').map((l,i) => (
                  <div key={i} className={`${styles.cube} ${styles.green}`} style={{ animationDelay:`${i*100}ms`, width:52, height:52 }}>{l}</div>
                ))}
              </div>
            )}
            <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {players.map(n => (
                <div key={n} className={styles.ruleItem}>
                  <span className={styles.ruleNum}>{n===winner?'🏆':'😢'}</span>
                  <span style={{ flex:1 }}>{n}{n===myName&&<span style={{ fontSize:'0.65rem', background:'#6C63FF', color:'#fff', padding:'1px 5px', borderRadius:'999px', marginLeft:'4px', fontWeight:700 }}>YOU</span>}</span>
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

  // ── READY PHASE ────────────────────────────────────────────────
  if (phase === 'ready') {
    const readyCount = Object.values(gs.ready || {}).filter(Boolean).length
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button className={styles.backBtn} onClick={() => window.history.back()}>← Back to Games</button>
          <div className={styles.topTitle}>🔤 Word Wordle</div>
          <div className={styles.topRoom}>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
        </div>
        <div className={styles.readyWrap}>
          <div className={styles.readyCard}>
            <div className={styles.readyEmoji}>🔤</div>
            <h2 className={styles.readyTitle}>Word Wordle</h2>
            <p className={styles.readySub}>Server picks <strong>one secret word</strong> for both. Guess simultaneously — first to crack it wins!</p>
            <div className={styles.legendRow}>
              <div className={`${styles.legendCube} ${styles.lgGreen}`}>A</div><span className={styles.legendTxt}>Right spot</span>
              <div className={`${styles.legendCube} ${styles.lgYellow}`}>B</div><span className={styles.legendTxt}>Wrong spot</span>
              <div className={`${styles.legendCube} ${styles.lgGray}`}>C</div><span className={styles.legendTxt}>Not in word</span>
            </div>
            <div className={styles.rulesList}>
              {['Server picks one word for both of you','Both guess at the same time — no turns','You see opponent\'s colour pattern only','First to get all green wins!'].map((r,i) => (
                <div key={i} className={styles.ruleItem}><span className={styles.ruleNum}>{i+1}</span>{r}</div>
              ))}
            </div>
            {!iAmReady
              ? <button className={styles.readyBtn} onClick={setReady}>✅ I'm Ready!</button>
              : <div className={styles.waitingBadge}><span className={styles.spinIcon}>⏳</span> Waiting for others...</div>
            }
            <div className={styles.readyBar}>
              <div className={styles.readyFill} style={{ width:`${players.length>0?(readyCount/players.length)*100:0}%` }} />
            </div>
            <p className={styles.readyCount}>{readyCount}/{players.length} ready</p>
          </div>
        </div>
      </div>
    )
  }

  // ── PLAYING ────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <ScoreFloat />
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => window.history.back()}>← Back to Games</button>
        <div className={styles.topTitle}>🔤 Word Wordle</div>
        <div className={styles.topRoom}>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
      </div>

      {/* Taunts — centered overlay */}
      {taunts.length > 0 && (
        <div className={styles.tauntBackdrop}>
          <div className={styles.tauntFloat}>
            {taunts.map(t => (
              <div key={t.id} className={styles.tauntToast}>
                <span className={styles.tauntEmoji}>{t.emoji}</span>
                <span className={styles.tauntFrom}>from {t.from}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Race bar */}
      <div className={styles.raceBar}>
        <div className={styles.racePlayer}>
          <span className={styles.raceName}>You</span>
          <div className={styles.raceTrack}><div className={`${styles.raceFill} ${styles.meRace}`} style={{ width:`${(myCount/MAX_GUESSES)*100}%` }} /></div>
          <span className={styles.raceCount}>{myCount}/{MAX_GUESSES}</span>
        </div>
        <div className={styles.raceVs}>⚡</div>
        {others.map(name => {
          const cnt = gs.guessCounts?.[name] || 0
          return (
            <div key={name} className={styles.racePlayer}>
              <span className={styles.raceName}>{name}</span>
              <div className={styles.raceTrack}><div className={`${styles.raceFill} ${styles.themRace}`} style={{ width:`${(cnt/MAX_GUESSES)*100}%` }} /></div>
              <span className={styles.raceCount}>{cnt}/{MAX_GUESSES}</span>
            </div>
          )
        })}
      </div>

      {/* Status banners */}
      {mySolved && <div className={`${styles.banner} ${styles.solvedBanner}`}>🎉 You solved it! Waiting for opponent...</div>}
      {!mySolved && others.some(n => gs.solved?.[n]) && (
        <div className={`${styles.banner} ${styles.opponentSolvedBanner}`}>🔥 Opponent solved it — you still can!</div>
      )}

      {/* Boards */}
      <div className={styles.boardsRow}>
        {/* MY BOARD */}
        <div className={`${styles.board} ${styles.myBoard}`} style={{ position:'relative' }}>
          {mySolved && (
            <div style={{ position:'absolute', inset:0, borderRadius:'inherit', background:'rgba(83,141,78,0.12)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:5, pointerEvents:'none' }}>
              <div style={{ background:'#538d4e', color:'#fff', fontFamily:"'Space Grotesk',sans-serif", fontWeight:900, fontSize:'1.1rem', padding:'0.5rem 1.5rem', borderRadius:'12px', boxShadow:'0 4px 20px rgba(83,141,78,0.4)', transform:'rotate(-3deg)' }}>✓ SOLVED!</div>
            </div>
          )}
          <div className={styles.boardHeader}>
            <span className={styles.boardName}>🎮 {myName}</span>
            <span className={styles.boardLabel}>Your guesses</span>
          </div>

          <div className={styles.grid}>
            {myGuesses.map((g, ri) => <GuessRow key={ri} letters={g.letters} feedback={g.feedback} />)}

            {myCount < MAX_GUESSES && !mySolved && (
              <div className={`${styles.row} ${shakeRow ? styles.shakeRow : ''}`}>
                {Array.from({length: WORD_LEN}).map((_, ci) => {
                  const letter = currentWord[ci] || ''
                  const isJustTyped = ci === currentWord.length - 1
                  const isCursor = ci === currentWord.length && currentWord.length < WORD_LEN
                  if (!letter && !isCursor) {
                    return <div key={ci} className={`${styles.cube} ${styles.emptyCube}`} />
                  }
                  return (
                    <div key={`${ci}-${letter}`} className={`${styles.cube} ${styles.activeCube} ${letter ? (isJustTyped ? styles.popCube : styles.typedCube) : styles.cursorCube}`}>
                      {letter}
                    </div>
                  )
                })}
              </div>
            )}

            {Array.from({ length: Math.max(0, MAX_GUESSES - myCount - (mySolved?0:1)) }).map((_,i) => <EmptyRow key={`me${i}`} />)}
          </div>

          {/* Keyboard */}
          <div className={styles.keyboard}>
            {KB_ROWS.map((row, ri) => (
              <div key={ri} className={styles.keyRow}>
                {row.map(k => (
                  <button key={k} type="button"
                    className={`${styles.key} ${k.length>1?styles.wideKey:''} ${k.length===1&&keyState[k]?styles[`k_${keyState[k]}`]:''}`}
                    onClick={() => {
                      if (k === '⌫') setCurrentWord(w => w.slice(0,-1))
                      else if (k === 'ENTER') handleSubmit()
                      else if (currentWord.length < WORD_LEN) { setCurrentWord(w=>w+k); emitTyping(currentWord.length+1) }
                    }}
                    disabled={mySolved}
                  >{k}</button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* OPPONENT BOARDS */}
        {others.map(name => {
          const theirGuesses = (gs.guesses || {})[name] || []
          const theirCount   = gs.guessCounts?.[name] || 0
          const theirSolved  = gs.solved?.[name] || false

          return (
            <div key={name} className={`${styles.board} ${theirSolved ? styles.opponentSolvedBoard : ''}`}>
              <div className={styles.boardHeader}>
                <span className={styles.boardName}>👤 {name}</span>
                <span className={styles.boardLabel}>Their pattern</span>
              </div>

              <div className={styles.grid}>
                {theirGuesses.map((g, ri) => <OpponentGuessRow key={ri} feedback={g.feedback} />)}

                {theirCount < MAX_GUESSES && !theirSolved && (
                  <div className={styles.row}>
                    {Array.from({length:WORD_LEN}).map((_,ci) => (
                      <div key={ci} className={`${styles.cube} ${oppTypingCount > 0 && ci < oppTypingCount ? styles.typingCube : styles.emptyCube}`} />
                    ))}
                  </div>
                )}

                {Array.from({ length: Math.max(0, MAX_GUESSES - theirCount - (theirSolved?0:1)) }).map((_,i) => <EmptyRow key={`th${i}`} />)}
              </div>

              <div className={styles.opponentFooter}>
                <span className={styles.hiddenNote}>Letters hidden 👁️</span>
                {oppTypingCount > 0 && (
                  <div className={styles.typingIndicator}>
                    <span>{name}</span>
                    <div className={styles.typingDots}>
                      {Array.from({length: WORD_LEN}).map((_,i) => (
                        <span key={i} className={`${styles.typingDot} ${i < oppTypingCount ? styles.typingDotFilled : ''}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Guess input row */}
      {!mySolved && (
        <div className={styles.inputSection}>
          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={styles.wordInput}
              type="text" placeholder="Type a 5-letter word..."
              maxLength={5} value={currentWord}
              onChange={() => {}}
              onKeyDown={e => {
                e.preventDefault()
                const k = e.key.toUpperCase()
                if (k === 'BACKSPACE') setCurrentWord(w => w.slice(0,-1))
                else if (k === 'ENTER') handleSubmit()
                else if (/^[A-Z]$/.test(k) && currentWord.length < WORD_LEN) {
                  setCurrentWord(w => w + k)
                  emitTyping(currentWord.length + 1)
                }
              }}
              autoComplete="off" autoCorrect="off" spellCheck={false}
              readOnly
            />
            <button className={styles.submitBtn} type="button" onClick={handleSubmit}>→</button>
          </div>
          <div style={{ display:'flex', justifyContent:'center' }}>
            <TauntPicker onSend={sendTaunt} />
          </div>
        </div>
      )}

      <button className={styles.leaveBtn} type="button" onClick={leaveGame}>🚪 Leave Game</button>
    </div>
  )
}
