import { useState, useEffect } from 'react'
import { useSocket } from '../../context/SocketContext'
import { useRoom } from '../../context/RoomContext'
import { useToast } from '../ui/Toast'
import { usePageTitle } from '../../hooks/useGameUtils'
import ScoreFloat from '../ui/ScoreFloat'
import styles from './BluffClub.module.css'
import SoundToggle from '../ui/SoundToggle'

export default function BluffClub({ roomCode }) {
  const { socket }         = useSocket()
  const { room, dispatch } = useRoom()
  const toast              = useToast()
  const gs                 = room.gameState || {}   // FIX: was `onst` (syntax crash)

  const [statements, setStatements] = useState(['','',''])
  const [lieIndex,   setLieIndex]   = useState(1)
  const [submitted,  setSubmitted]  = useState(false)
  const [voted,      setVoted]      = useState(false)
  const [shuffledOrder, setShuffledOrder] = useState(null)
  const [revealedLie, setRevealedLie] = useState(false)

  const myName  = room.playerName
  const phase   = gs.phase || 'submit'
  usePageTitle(phase!=='over', 'Bluff Club')
  const players = gs.players || []
  const isCurrentPlayer = gs.currentPlayer === myName

  useEffect(() => {
    if (!socket) return
    function onState(s) { dispatch({ type:'SET_GAME_STATE', gameState:s }) }
    socket.on('game:state', onState)
    return () => socket.off('game:state', onState)
  }, [socket])

  // Reset vote state, shuffle statements, and reset reveal animation when new round starts
  useEffect(() => {
    if (phase === 'vote' && gs.statements?.length) {
      setVoted(false)
      setRevealedLie(false)
      const order = gs.statements.map((_,i) => i)
      for (let i = order.length-1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i+1));
        [order[i], order[j]] = [order[j], order[i]]
      }
      setShuffledOrder(order)
    }
    // Trigger reveal animation with a short delay so players see it
    if (phase === 'reveal') {
      setRevealedLie(false)
      setTimeout(() => setRevealedLie(true), 400)
    }
  }, [gs.currentPlayer, phase])

  // Reset submitted flag each round (when currentPlayer changes)
  useEffect(() => {
    if (phase === 'submit') setSubmitted(false)
  }, [gs.currentPlayer])

  function updateStatement(i, val) {
    const next = [...statements]; next[i] = val; setStatements(next)
  }

  function submitStatements(e) {
    e.preventDefault()
    if (statements.some(s => !s.trim())) { toast.warning('Fill in all 3 statements'); return }
    socket.emit('game:action', { roomCode, action:'submit', payload:{ statements, lieIndex } })
    setSubmitted(true)
  }

  function vote(idx) {
    if (voted) return
    setVoted(true)
    socket.emit('game:action', { roomCode, action:'vote', payload:{ lieIndex: idx } })
  }

  // FIX: emit room:leave before navigating so other players are notified
  function leaveGame() {
    socket.emit('room:leave', { roomCode })
    window.location.href = '/'
  }

  // ── OVER ──────────────────────────────────────────────────────
  if (phase === 'over') {
    const scores = gs.scores || {}
    const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1])
    const iWon   = sorted[0]?.[0] === myName
    return (
      <div className={styles.page}>
        <Topbar roomCode={roomCode} />
        <div className={styles.overWrap}>
          <div className={styles.overCard}>
            <div className={styles.overEmoji}>{iWon?'🏆':'🤥'}</div>
            <h2 className={styles.overTitle}>{iWon?'You won!': `${sorted[0]?.[0]} wins!`}</h2>
            <div className={styles.scoreList}>
              {sorted.map(([name,score],i)=>(
                <div key={name} className={styles.scoreRow}>
                  <span className={styles.scoreRank}>{['🥇','🥈','🥉'][i]||`#${i+1}`}</span>
                  <span className={styles.scoreName}>{name}{name===myName&&<span className={styles.youBadge}> YOU</span>}</span>
                  <span className={styles.scoreNum}>{score} pts</span>
                </div>
              ))}
            </div>
            <p className={styles.overSub}>Returning to lobby...</p>
          </div>
        </div>
      </div>
    )
  }

  // Statement role labels — dynamically update based on which index is the lie
  function statementLabel(i) {
    if (lieIndex === i) return { label: 'LIE', cls: styles.roleLie }
    const truthNum = i < lieIndex ? i + 1 : i  // count truths excluding lie position
    return { label: `TRUTH ${truthNum}`, cls: styles.roleTruth }
  }

  return (
    <div className={styles.page}>
      <ScoreFloat />
      <Topbar roomCode={roomCode} />

      {/* Round indicator */}
      {gs.roundNum && (
        <div className={styles.roundBar}>
          Round {gs.roundNum} of {gs.totalRounds} · <strong>{gs.currentPlayer}</strong>'s turn
        </div>
      )}

      <div className={styles.center}>

        {/* ── SUBMIT PHASE — non-current player waiting ── */}
        {phase === 'submit' && !isCurrentPlayer && (
          <div className={styles.card} style={{ textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>⏳</div>
            <h3 className={styles.cardTitle}>{gs.currentPlayer}'s turn</h3>
            <p className={styles.cardSub}>
              Round {gs.roundNum || 1} of {gs.totalRounds || players.length} · They are writing their statements...
            </p>
            <div className={styles.submittedList}>
              {players.map(p => (
                <span key={p} className={`${styles.submittedChip} ${p===gs.currentPlayer?styles.doneChip:''}`}>
                  {p} {p===gs.currentPlayer?'✍️':'⏳'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── SUBMIT PHASE — current player submitted ── */}
        {phase === 'submit' && submitted && isCurrentPlayer && (
          <div className={styles.card} style={{ textAlign:'center' }}>
            <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>✅</div>
            <h3 className={styles.cardTitle}>Locked in!</h3>
            {/* FIX: show submission progress so players aren't left guessing */}
            <p className={styles.cardSub}>
              {(gs.submitted||[]).length}/{players.length} players ready
            </p>
            <div className={styles.submittedList}>
              {players.map(p=>(
                <span key={p} className={`${styles.submittedChip} ${(gs.submitted||[]).includes(p)?styles.doneChip:''}`}>
                  {p} {(gs.submitted||[]).includes(p)?'✓':'⏳'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── SUBMIT PHASE — my turn to write ── */}
        {phase === 'submit' && !submitted && isCurrentPlayer && (
          <div className={styles.card}>
            <div className={styles.cardIcon}>🤥</div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.4)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'0.25rem' }}>
              Round {gs.roundNum || 1} of {gs.totalRounds || players.length} · Your turn
            </div>
            <h2 className={styles.cardTitle}>Write your statements</h2>
            <p className={styles.cardSub}>2 truths and 1 lie — click the badge on the left to mark which is the lie!</p>

            <form onSubmit={submitStatements} className={styles.statementsForm}>
              {statements.map((s,i) => {
                const { label, cls } = statementLabel(i)
                return (
                  <div key={i} className={`${styles.statementRow} ${lieIndex===i ? styles.lieRow : ''}`}>
                    {/* FIX: dynamic label shows TRUTH/LIE per row */}
                    <button type="button"
                      className={`${styles.lieToggle} ${lieIndex===i?styles.lieActive:''}`}
                      onClick={() => setLieIndex(i)}
                      title="Mark as the lie"
                    >
                      <span className={cls}>{label}</span>
                    </button>
                    <input
                      className={styles.statementInput}
                      value={s}
                      onChange={e=>updateStatement(i,e.target.value)}
                      placeholder={lieIndex===i ? 'Your lie...' : 'A true statement...'}
                      maxLength={120}
                    />
                  </div>
                )
              })}
              <button className={styles.primaryBtn} type="submit">Lock In →</button>
            </form>
          </div>
        )}

        {/* ── VOTE PHASE ── */}
        {phase === 'vote' && (
          <div className={styles.card}>
            <div className={styles.voteHeader}>
              <span className={styles.voteAvatar}>{gs.currentPlayer?.charAt(0).toUpperCase()}</span>
              <div>
                <div className={styles.voteName}>{gs.currentPlayer}'s statements</div>
                <div className={styles.voteSub}>Which one is the lie?</div>
              </div>
            </div>

            {isCurrentPlayer ? (
              <div className={styles.ownTurn}>
                <span>⏳</span> Others are voting on your statements...
                {/* FIX: show vote progress for current player */}
                <p className={styles.cardSub} style={{ marginTop:'0.5rem' }}>
                  {Object.keys(gs.votes||{}).length}/{players.filter(p=>p!==myName).length} votes in
                </p>
                <div className={styles.submittedList}>
                  {players.filter(p=>p!==myName).map(p=>(
                    <span key={p} className={`${styles.submittedChip} ${gs.votes?.[p]!==undefined?styles.doneChip:''}`}>
                      {p} {gs.votes?.[p]!==undefined?'✓':'⏳'}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.voteOptions}>
                {/* FIX: fixed broken map — was using undeclared variables i and s */}
                {(shuffledOrder || gs.statements?.map((_,i)=>i) || []).map((realIdx, displayIdx) => {
                  const s = gs.statements?.[realIdx]
                  return (
                    <button key={realIdx}
                      className={`${styles.voteBtn} ${voted?styles.votedBtn:''}`}
                      onClick={() => vote(realIdx)}
                      disabled={voted}
                    >
                      <span className={styles.voteNum}>{displayIdx+1}</span>
                      <span className={styles.voteText}>{s}</span>
                      {voted && gs.votes?.[myName]===realIdx && <span className={styles.myVoteMark}>← your pick</span>}
                    </button>
                  )
                })}
                {voted && <p className={styles.waitVote}>Voted! Waiting for others... (30s timeout)</p>}
              </div>
            )}
          </div>
        )}

        {/* ── REVEAL PHASE — with animation on the lie ── */}
        {phase === 'reveal' && (
          <div className={styles.card}>
            <div className={styles.revealHeader}>
              <span className={styles.revealIcon}>🎭</span>
              <h3 className={styles.revealTitle}>The Lie Revealed!</h3>
            </div>

            <div className={styles.revealStatements}>
              {(gs.statements||[]).map((s,i)=>(
                <div key={i} className={`${styles.revealStatement} ${i===gs.lieIndex?styles.isLie:styles.isTruth} ${i===gs.lieIndex && revealedLie ? styles.lieAnimated : ''}`}>
                  <span className={styles.revealMark}>{i===gs.lieIndex?'🤥':'✓'}</span>
                  <span className={styles.revealText}>{s}</span>
                  {i===gs.lieIndex && <span className={styles.lieBadge}>LIE</span>}
                </div>
              ))}
            </div>

            {/* Who guessed what */}
            <div className={styles.voteResults}>
              {players.filter(p=>p!==gs.currentPlayer).map(p=>{
                const correct = gs.votes?.[p] === gs.lieIndex
                return (
                  <div key={p} className={`${styles.voteResult} ${correct?styles.correct:styles.wrong}`}>
                    <span className={styles.voteResultName}>{p}</span>
                    <span>{correct?'✓ Spotted it!':'✗ Fooled!'}</span>
                  </div>
                )
              })}
            </div>

            <p className={styles.revealSub}>Next round starting soon...</p>
          </div>
        )}

        {/* Score strip */}
        {gs.scores && (
          <div className={styles.scoreStrip}>
            {Object.entries(gs.scores).sort((a,b)=>b[1]-a[1]).map(([name,score])=>(
              <div key={name} className={`${styles.scoreChip} ${name===myName?styles.myChip:''}`}>
                <span className={styles.chipName}>{name}</span>
                <span className={styles.chipScore}>{score}</span>
              </div>
            ))}
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
      <div className='gameTitle'>🤥 Bluff Club</div>
      <div className='gameTopbarRight'>
        <div className='gameRoom'>Room: <strong>{roomCode}</strong></div>
        <SoundToggle />
      </div>
    </div>
  )
}
