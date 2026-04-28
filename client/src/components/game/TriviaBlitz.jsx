import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../../context/SocketContext'
import { useRoom } from '../../context/RoomContext'
import { useToast } from '../ui/Toast'
import { usePageTitle } from '../../hooks/useGameUtils'
import ScoreFloat from '../ui/ScoreFloat'
import styles from './TriviaBlitz.module.css'
import SoundToggle from '../ui/SoundToggle'

export default function TriviaBlitz({ roomCode }) {
  const { socket }         = useSocket()
  const { room, dispatch } = useRoom()
  const toast              = useToast()
  const gs                 = room.gameState || {}

  const [chosen, setChosen]       = useState(null)
  const [timeLeft, setTimeLeft]   = useState(15)
  const [firstBadge, setFirstBadge] = useState(null) // FIX: "1st!" badge
  const timerRef  = useRef(null)
  const prevQ     = useRef(null)
  const myName    = room.playerName
  const players   = gs.players || []
  const phase     = gs.phase || 'question'
  usePageTitle(phase === 'question', 'Trivia Blitz')

  // FIX: server-authoritative timer — compute from startedAt
  useEffect(() => {
    if (phase !== 'question') { clearInterval(timerRef.current); return }
    if (!gs.startedAt) return

    function tick() {
      const elapsed = (Date.now() - gs.startedAt) / 1000
      const left = Math.max(0, Math.ceil((gs.timePerQ || 15) - elapsed))
      setTimeLeft(left)
      if (left <= 0) clearInterval(timerRef.current)
    }
    clearInterval(timerRef.current)
    tick()
    timerRef.current = setInterval(tick, 250) // 250ms for smooth ring
    return () => clearInterval(timerRef.current)
  }, [gs.startedAt, phase])

  // Reset chosen when new question
  useEffect(() => {
    if (gs.question && gs.question !== prevQ.current) {
      prevQ.current = gs.question
      setChosen(null)
      setFirstBadge(null)
    }
  }, [gs.question])

  // FIX: detect if I was first to answer
  useEffect(() => {
    if (gs.answeredOrder?.length > 0 && gs.answeredOrder[0] === myName) {
      setFirstBadge('⚡ 1st!')
    }
  }, [gs.answeredOrder])

  useEffect(() => {
    if (!socket) return
    function onState(s) { dispatch({ type: 'SET_GAME_STATE', gameState: s }) }
    socket.on('game:state', onState)
    return () => socket.off('game:state', onState)
  }, [socket])

  function answer(choice) {
    if (chosen || phase !== 'question') return
    setChosen(choice)
    socket.emit('game:action', { roomCode, action: 'answer', payload: { choice } })
  }

  // Keyboard shortcuts 1-4
  useEffect(() => {
    function onKey(e) {
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 4 && !chosen && phase === 'question') {
        const choice = (gs.choices || [])[n - 1]
        if (choice) answer(choice)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chosen, phase, gs.choices])

  function leaveGame() {
    socket.emit('room:leave', { roomCode })
    window.location.href = '/'
  }

  const timerPct   = ((timeLeft / (gs.timePerQ || 15)) * 100)
  const answeredSet = new Set(gs.answered || [])
  const answeredOrder = gs.answeredOrder || []
  const myAnswerPos   = answeredOrder.indexOf(myName) // -1 if not answered yet

  // ── OVER ─────────────────────────────────────────────────────
  if (phase === 'over') {
    const scores = gs.scores || {}
    const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1])
    const iWon   = sorted[0]?.[0] === myName
    return (
      <div className={styles.page}>
        <Topbar roomCode={roomCode} />
        <div className={styles.overWrap}>
          <div className={styles.overCard}>
            <div className={styles.overEmoji}>{iWon ? '🏆' : '🧠'}</div>
            <h2 className={styles.overTitle}>{iWon ? 'You won!' : `${sorted[0]?.[0]} wins!`}</h2>
            <div className={styles.scoreList}>
              {sorted.map(([name, score], i) => (
                <div key={name} className={styles.scoreRow}>
                  <span className={styles.scoreRank}>{['🥇','🥈','🥉'][i] || `#${i+1}`}</span>
                  <span className={styles.scoreName}>
                    {name}{name===myName && <span className={styles.youBadge}> YOU</span>}
                  </span>
                  <span className={styles.scoreNum}>{score} pts</span>
                  {gs.streaks?.[name] >= 3 && <span className={styles.streakBadge}>🔥{gs.streaks[name]}</span>}
                </div>
              ))}
            </div>
            <p className={styles.overSub}>Returning to lobby...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <ScoreFloat />
      <Topbar roomCode={roomCode} />

      {/* Progress */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width:`${((gs.questionNum||1)/(gs.total||10))*100}%` }} />
      </div>

      <div className={styles.center}>
        {/* Header row */}
        <div className={styles.metaRow}>
          <span className={styles.category}>{gs.category || '❓'} Q{gs.questionNum}/{gs.total}</span>
          <div className={`${styles.timer} ${timeLeft <= 5 ? styles.timerUrgent : ''}`}>
            <svg key={gs.startedAt} viewBox="0 0 36 36" className={styles.timerRing}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none"
                stroke={timeLeft <= 5 ? '#EF4444' : '#6C63FF'}
                strokeWidth="3" strokeDasharray="100"
                strokeDashoffset={100 - timerPct}
                strokeLinecap="round" transform="rotate(-90 18 18)"
                style={{ transition: 'stroke-dashoffset 0.25s linear' }}
              />
            </svg>
            <span className={styles.timerNum}>{timeLeft}</span>
          </div>
        </div>

        {/* Question */}
        <div className={styles.questionCard}>
          <p className={styles.question}>{gs.question}</p>
        </div>

        {/* Choices */}
        <div className={styles.choicesGrid}>
          {(gs.choices || []).map((c, i) => {
            let st = 'idle'
            if (phase === 'reveal') {
              if (c === gs.answer) st = 'correct'
              else if (c === chosen && c !== gs.answer) st = 'wrong'
              else st = 'dim'
            } else if (chosen === c) st = 'picked'

            // FIX: show who answered wrong in reveal
            const wrongVoters = phase === 'reveal' && gs.answered
              ? Object.entries(gs.answered)
                  .filter(([n, a]) => a.choice === c && c !== gs.answer)
                  .map(([n]) => n)
              : []

            return (
              <button key={i}
                className={`${styles.choice} ${styles[st]}`}
                onClick={() => answer(c)}
                disabled={!!chosen || phase === 'reveal'}
              >
                <span className={styles.choiceLetter}>
                  {String.fromCharCode(65+i)}
                  <span className={styles.keyHint}>{i+1}</span>
                </span>
                <span className={styles.choiceText}>{c}</span>
                {phase === 'reveal' && c === gs.answer && (
                  <span className={styles.correctMark}>✓</span>
                )}
                {wrongVoters.length > 0 && (
                  <span className={styles.wrongVoters}>{wrongVoters.join(', ')} ✗</span>
                )}
              </button>
            )
          })}
        </div>

        {/* FIX: status with answer position badge */}
        {phase === 'question' && (
          <div className={styles.statusRow}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              {chosen ? (
                <span className={styles.answered}>
                  ✓ Answered!
                  {/* FIX: show position */}
                  {myAnswerPos === 0 && <span className={styles.firstBadge}>⚡ 1st!</span>}
                  {myAnswerPos === 1 && <span className={styles.secondBadge}>🥈 2nd</span>}
                  {myAnswerPos >= 2 && <span className={styles.lateBadge}>#{myAnswerPos+1}</span>}
                </span>
              ) : (
                <span className={styles.waiting}>Pick your answer!</span>
              )}
            </div>
            <span className={styles.answeredCount}>{answeredSet.size}/{players.length} answered</span>
          </div>
        )}

        {/* FIX: streak indicator */}
        {phase === 'question' && gs.streaks?.[myName] >= 2 && (
          <div className={styles.streakRow}>
            🔥 {gs.streaks[myName]} in a row!
            {gs.streaks[myName] >= 3 && <span className={styles.streakBonus}> +{Math.min(gs.streaks[myName]*10,50)} bonus pts</span>}
          </div>
        )}

        {phase === 'reveal' && (
          <div className={styles.revealBanner}>
            {chosen === gs.answer
              ? <span className={styles.revealCorrect}>🎉 Correct! +{gs.scores?.[myName]} pts total</span>
              : chosen
                ? <span className={styles.revealWrong}>❌ -10 pts. Answer: <strong>{gs.answer}</strong></span>
                : <span className={styles.revealWrong}>⏱ Time up! Answer: <strong>{gs.answer}</strong></span>
            }
          </div>
        )}

        {/* Scores */}
        <div className={styles.scoreStrip}>
          {players.map(name => (
            <div key={name} className={`${styles.scoreChip} ${name===myName ? styles.myChip : ''}`}>
              <span className={styles.chipName}>{name}</span>
              <span className={styles.chipScore}>{gs.scores?.[name] || 0}</span>
              {gs.streaks?.[name] >= 2 && <span className={styles.chipStreak}>🔥{gs.streaks[name]}</span>}
              {phase === 'question' && answeredSet.has(name) && <span className={styles.chipDot}/>}
            </div>
          ))}
        </div>
      </div>

      <button className={styles.leaveBtn} onClick={leaveGame}>🚪 Leave</button>
    </div>
  )
}

function Topbar({ roomCode }) {
  return (
    <div className='gameTopbar'>
      <button className='gameBackBtn' onClick={() => window.history.back()}>← Back</button>
      <div className='gameTitle'>🧠 Trivia Blitz</div>
      <div className='gameTopbarRight'>
        <div className='gameRoom'>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
      </div>
    </div>
  )
}
