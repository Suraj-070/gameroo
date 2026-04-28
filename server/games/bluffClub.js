// BluffClub — per-round submit (only current player), vote timeout, score reveal delay

const VOTE_TIMEOUT_MS = 30000

function startBluffClub(io, roomCode, players) {
  const state = {
    players: players.map(p => p.name),
    currentPlayerIndex: 0,
    phase: 'submit',
    submissions: {},
    lieIndex: {},
    votes: {},
    scores: {},
    roundNum: 1,         // FIX: track round from start
    totalRounds: players.length,
    voteTimer: null,
  }
  players.forEach(p => { state.scores[p.name] = 0 })

  broadcastSubmitPhase(io, roomCode, state)
  return { state, timer: null }
}

function broadcastSubmitPhase(io, roomCode, state) {
  const currentPlayer = state.players[state.currentPlayerIndex]
  // FIX: include roundNum so client always knows progress during submit phase
  io.to(roomCode).emit('game:state', {
    phase: 'submit',
    players: state.players,
    currentPlayer,
    submitted: Object.keys(state.submissions),
    scores: state.scores,
    roundNum: state.currentPlayerIndex + 1,   // FIX: was missing in submit phase
    totalRounds: state.players.length,
  })
}

function handleBluffAction(io, roomCode, playerName, action, payload, state) {
  // FIX: only current player can submit — others wait
  if (action === 'submit' && state.phase === 'submit') {
    const currentPlayer = state.players[state.currentPlayerIndex]
    if (playerName !== currentPlayer) return // FIX: guard non-current players

    const { statements, lieIndex = 1 } = payload
    if (!statements || statements.length !== 3) return

    state.submissions[playerName] = statements
    state.lieIndex[playerName] = typeof lieIndex === 'number' ? lieIndex : 1
    startVotingRound(io, roomCode, state)
    return
  }

  if (action === 'vote' && state.phase === 'vote') {
    const targetPlayer = state.players[state.currentPlayerIndex]
    if (playerName === targetPlayer) return // can't vote on yourself

    state.votes[playerName] = payload.lieIndex

    io.to(roomCode).emit('game:state', {
      phase: 'vote',
      players: state.players,
      currentPlayer: targetPlayer,
      statements: state.submissions[targetPlayer],
      votes: Object.keys(state.votes), // only show count, not values
      scores: state.scores,
      roundNum: state.currentPlayerIndex + 1,
      totalRounds: state.players.length,
    })

    const voters = state.players.filter(n => n !== targetPlayer)
    if (voters.every(v => state.votes[v] !== undefined)) {
      clearTimeout(state.voteTimer)
      revealBluff(io, roomCode, state)
    }
  }
}

function startVotingRound(io, roomCode, state) {
  state.phase = 'vote'
  state.votes = {}
  const targetPlayer = state.players[state.currentPlayerIndex]
  const statements   = state.submissions[targetPlayer]

  io.to(roomCode).emit('game:state', {
    phase: 'vote',
    players: state.players,
    currentPlayer: targetPlayer,
    statements,
    votes: [],
    scores: state.scores,
    roundNum: state.currentPlayerIndex + 1,
    totalRounds: state.players.length,
  })

  // FIX: vote timeout — 30s, then auto-reveal
  clearTimeout(state.voteTimer)
  state.voteTimer = setTimeout(() => {
    // Fill in abstentions as -1 (invalid) so scoring ignores them
    const voters = state.players.filter(n => n !== targetPlayer)
    voters.forEach(v => { if (state.votes[v] === undefined) state.votes[v] = -1 })
    revealBluff(io, roomCode, state)
  }, VOTE_TIMEOUT_MS)
}

function revealBluff(io, roomCode, state) {
  const targetPlayer = state.players[state.currentPlayerIndex]
  const realLieIdx   = state.lieIndex[targetPlayer]
  const statements   = state.submissions[targetPlayer]

  let fooled = 0
  for (const [voter, guessedIdx] of Object.entries(state.votes)) {
    if (guessedIdx === realLieIdx) {
      state.scores[voter] = (state.scores[voter] || 0) + 50
    } else if (guessedIdx !== -1) {
      fooled++
    }
  }
  state.scores[targetPlayer] = (state.scores[targetPlayer] || 0) + fooled * 30

  // FIX: reveal phase first — scores update 2s later via score-update phase
  io.to(roomCode).emit('game:state', {
    phase: 'reveal',
    players: state.players,
    currentPlayer: targetPlayer,
    statements,
    lie: statements[realLieIdx],
    lieIndex: realLieIdx,
    votes: state.votes,
    scores: state.scores,
    roundNum: state.currentPlayerIndex + 1,
    totalRounds: state.players.length,
  })

  setTimeout(() => {
    state.currentPlayerIndex++
    state.votes = {}
    delete state.submissions[targetPlayer]

    if (state.currentPlayerIndex >= state.players.length) {
      const winner = Object.entries(state.scores).sort((a,b)=>b[1]-a[1])[0]?.[0] || null
      io.to(roomCode).emit('game:over', { scores: state.scores, winner })
    } else {
      // FIX: reset to submit phase for next player
      broadcastSubmitPhase(io, roomCode, state)
    }
  }, 5000)
}

module.exports = { startBluffClub, handleBluffAction }
