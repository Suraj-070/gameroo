import { useState, useEffect, useRef } from 'react'
import { useSocket } from '../../context/SocketContext'
import { useRoom } from '../../context/RoomContext'
import { useToast } from '../ui/Toast'
import { usePageTitle } from '../../hooks/useGameUtils'
import ScoreFloat from '../ui/ScoreFloat'
import styles from './WordDuel.module.css'
import SoundToggle from '../ui/SoundToggle'

export default function WordDuel({ roomCode }) {
  const { socket }         = useSocket()
  const { room, dispatch } = useRoom()
  const toast              = useToast()
  const gs                 = room.gameState || {}   // FIX: was `onst` (syntax crash)

  const [guess, setGuess]               = useState('')
  const [wordRevealed, setWordRevealed] = useState(false)
  const [timeLeft, setTimeLeft]         = useState(null)
  const timerRef                        = useRef(null)
  const inputRef                        = useRef(null)
  const myName    = room.playerName
  const phase     = gs.phase || 'guessing'
  usePageTitle(phase==='guessing', 'Word Duel')
  const isGuesser = gs.guesser === myName
  const isSetter  = gs.setter  === myName

  useEffect(() => {
    if (!socket) return
    function onState(s) { dispatch({ type: 'SET_GAME_STATE', gameState: s }) }
    socket.on('game:state', onState)
    return () => socket.off('game:state', onState)
  }, [socket])

  useEffect(() => {
    if (phase === 'guessing' && isGuesser) setTimeout(() => inputRef.current?.focus(), 100)
  }, [phase, isGuesser])

  // Client-side countdown — only shown when server provides timeLimitSeconds
  useEffect(() => {
    if (phase !== 'guessing' || !gs.timeLimitSeconds) {
      clearInterval(timerRef.current)
      setTimeLeft(null)
      return
    }
    setTimeLeft(gs.timeLimitSeconds)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase, gs.timeLimitSeconds, gs.roundStartedAt])

  function submitGuess(e) {
    e?.preventDefault()
    const g = guess.trim().toUpperCase()
    if (!g) return
    if (g.length < 2) { toast.warning('Too short'); return }
    socket.emit('game:action', { roomCode, action: 'guess', payload: { guess: g } })
    setGuess('')
  }

  // FIX: emit room:leave before navigating so other players are notified
  function leaveGame() {
    socket.emit('room:leave', { roomCode })
    window.location.href = '/'
  }

  // ── OVER ──────────────────────────────────────────────────────
  if (phase === 'over') {
    const winner = gs.winner
    const iWon   = winner === myName
    return (
      <div className={styles.page}>
        <Topbar roomCode={roomCode} />
        <div className={styles.overWrap}>
          <div className={styles.overCard}>
            <div className={styles.overEmoji}>{iWon?'🏆':gs.forcedEnd?'⏱️':'😢'}</div>
            <h2 className={styles.overTitle}>{gs.forcedEnd ? 'Time Up!' : iWon ? 'You Won!' : `${winner} Wins!`}</h2>
            <div className={styles.wordReveal}>
              The word was:
              <div className={styles.wordLetters}>
                {(gs.word||'?????').split('').map((l,i)=>(
                  <span key={i} className={styles.wordLetter}>{l}</span>
                ))}
              </div>
            </div>
            {gs.roundResults?.map((r,i) => (
              <div key={i} className={styles.roundResult}>
                <span>Round {r.round}: <strong>{r.guesser}</strong> guessed <strong>{r.word}</strong></span>
                <span className={r.solved ? styles.roundSolved : styles.roundFailed}>
                  {r.solved ? `✓ ${r.guessCount} guesses` : '✗ Failed'}
                </span>
              </div>
            ))}
            <p className={styles.overSub2}>Returning to lobby...</p>
          </div>
        </div>
      </div>
    )
  }

  const letterBoxes = Array.from({ length: gs.letters || 5 })

  return (
    <div className={styles.page}>
      <ScoreFloat />
      <Topbar roomCode={roomCode} />

      <div className={styles.center}>
        {/* Round progress */}
        {gs.totalRounds > 1 && (
          <div className={styles.roundBanner}>
            Round {gs.round || 1} of {gs.totalRounds}
            {gs.round === 2 && <span className={styles.roundSwap}> · Roles swapped!</span>}
          </div>
        )}
        {/* Role banner */}
        <div className={`${styles.roleBanner} ${isGuesser ? styles.guesserBanner : styles.setterBanner}`}>
          {isGuesser
            ? <><span>🔍</span> You are <strong>guessing</strong> — figure out the secret word!</>
            : <><span>🤫</span> You are the <strong>setter</strong> — keep it secret!</>
          }
        </div>

        {/* Word hint */}
        <div className={styles.hintCard}>
          <div className={styles.hintLabel}>Hint</div>
          <div className={styles.hintText}>{gs.hint || '...'}</div>
          <div className={styles.letterRow}>
            {letterBoxes.map((_,i) => (
              <div key={i} className={styles.letterBox}>_</div>
            ))}
          </div>
          <div className={styles.hintMeta}>
            {gs.letters || '?'} letters · {gs.guessCount || 0}/{gs.maxGuesses || 8} guesses used
            {timeLeft !== null && (
              <span className={`${styles.timerBadge} ${timeLeft <= 10 ? styles.timerUrgent : ''}`}>
                ⏱ {timeLeft}s
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.guessBar}>
          <div className={styles.guessBarFill} style={{ width:`${((gs.guessCount||0)/(gs.maxGuesses||8))*100}%` }} />
        </div>

        {/* Guess history — with label so newest-on-top is clear */}
        {(gs.guesses||[]).length > 0 && (
          <div className={styles.guessListWrap}>
            <div className={styles.guessListLabel}>Latest guesses ↓</div>
            <div className={styles.guessList}>
              {(gs.guesses||[]).slice().reverse().map((g, i) => (
                <div key={i} className={`${styles.guessItem} ${g.correct ? styles.correctGuess : styles.wrongGuess}`}>
                  <span className={styles.guessPlayer}>{g.player}</span>
                  <span className={styles.guessWord}>{g.guess}</span>
                  {g.correct && <span className={styles.correctBadge}>✓ Correct!</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Setter — tap to reveal: FIX broken transparent-color trick with CSS classes */}
        {isSetter && phase === 'guessing' && (
          <div
            className={styles.setterHint}
            onClick={() => setWordRevealed(r => !r)}
            title={wordRevealed ? 'Tap to hide' : 'Tap to reveal'}
          >
            🤫 The word is:{' '}
            <span className={wordRevealed ? styles.wordVisible : styles.wordHidden}>
              {gs.word || '???'}
            </span>
            <span className={styles.revealHint}>
              {wordRevealed ? '(tap to hide)' : '(tap to reveal)'}
            </span>
          </div>
        )}

        {/* Guesser input */}
        {isGuesser && phase === 'guessing' && (
          <form className={styles.guessForm} onSubmit={submitGuess}>
            <input
              ref={inputRef}
              className={styles.guessInput}
              value={guess}
              onChange={e => setGuess(e.target.value.toUpperCase())}
              placeholder="Type your guess..."
              maxLength={30}
              autoComplete="off"
              spellCheck={false}
            />
            <button className={styles.guessBtn} type="submit">Guess →</button>
          </form>
        )}

        {/* Setter waiting + extra hint */}
        {isSetter && phase === 'guessing' && (
          <div className={styles.setterWaiting}>
            <span className={styles.spinIcon}>⏳</span> Waiting for {gs.guesser} to guess...
          </div>
        )}
        {isSetter && phase === 'guessing' && !gs.setterHintUsed && (
          <form className={styles.extraHintForm} onSubmit={e => {
            e.preventDefault()
            const h = e.target.hint.value.trim()
            if (!h) return
            socket.emit('game:action', { roomCode, action: 'add-hint', payload: { hint: h } })
            e.target.reset()
          }}>
            <input name="hint" className={styles.extraHintInput} placeholder="Add one extra hint (optional)..." maxLength={80} />
            <button className={styles.extraHintBtn} type="submit">Send Hint</button>
          </form>
        )}
        {gs.setterExtraHint && (
          <div className={styles.extraHintDisplay}>
            💡 Extra hint: <em>{gs.setterExtraHint}</em>
          </div>
        )}
      </div>

      <button className={styles.leaveBtn} onClick={leaveGame}>🚪 Leave</button>
    </div>
  )
}

function Topbar({ roomCode }) {
  return (
    <div className='gameTopbar'>
      <button className='gameBackBtn' onClick={() => window.history.back()}>← Back</button>
      <div className='gameTitle'>🔤 Word Duel</div>
      <div className='gameTopbarRight'>
        <div className='gameRoom'>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
      </div>
    </div>
  )
}
