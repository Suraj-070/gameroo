// Number Guessing — Turn-based with difficulty modes
// Flow: difficulty → setup → playing → over

const DIFFICULTY = {
  easy:   { min: 1,   max: 100   },
  medium: { min: 1,   max: 1000  },
  hard:   { min: 1,   max: 10000 },
}

function startNumberGuessing(io, roomCode, players) {
  if (players.length < 2) {
    io.to(roomCode).emit('game:error', { message: 'Need at least 2 players' })
    return null
  }

  const state = {
    phase:            'setup',
    difficulty:       'medium',
    difficultyChosen: false,
    min:              DIFFICULTY.medium.min,
    max:              DIFFICULTY.medium.max,
    secrets:          {},
    guesses:          {},
    ready:            {},
    guessCounts:      {},
    currentTurn:      null,
    turnIndex:        0,
    winner:           null,
    players:          players.map(p => p.name),
    ranges:           {},
    hostName:         players[0].name,   // store host by name, not socket id
  }

  players.forEach(p => {
    state.guesses[p.name]    = []
    state.guessCounts[p.name] = 0
    state.ready[p.name]      = false
    state.ranges[p.name]     = { low: state.min, high: state.max }
  })

  // Broadcast initial difficulty-picker state
  io.to(roomCode).emit('game:state', {
    phase:            'setup',
    difficultyChosen: false,
    difficulty:       state.difficulty,
    min:              state.min,
    max:              state.max,
    players:          state.players,
    ready:            state.ready,
  })

  return { state, timer: null }
}

function handleNumberGuessingAction(io, roomCode, playerName, action, payload, state, socket) {
  if (!state) return

  // ── Host sets difficulty ──────────────────────────────────────
  if (action === 'set-difficulty') {
    // Only host (first player by name) can set difficulty
    if (playerName !== state.hostName) return
    if (state.difficultyChosen) return

    const diff = DIFFICULTY[payload.difficulty]
    if (!diff) return

    state.difficulty       = payload.difficulty
    state.min              = diff.min
    state.max              = diff.max
    state.difficultyChosen = true

    // Reset ranges to match new difficulty
    state.players.forEach(n => {
      state.ranges[n] = { low: diff.min, high: diff.max }
    })

    io.to(roomCode).emit('game:state', {
      phase:            'setup',
      difficultyChosen: true,
      difficulty:       state.difficulty,
      min:              state.min,
      max:              state.max,
      players:          state.players,
      ready:            state.ready,
    })
    return
  }

  // ── Set secret ────────────────────────────────────────────────
  if (action === 'set-secret' && state.phase === 'setup') {
    if (!state.difficultyChosen) return // must choose difficulty first

    const parsed = parseInt(payload.number, 10)
    if (isNaN(parsed) || parsed < state.min || parsed > state.max) return

    state.secrets[playerName] = parsed
    state.ready[playerName]   = true

    io.to(roomCode).emit('game:state', {
      phase:            'setup',
      difficultyChosen: true,
      difficulty:       state.difficulty,
      min:              state.min,
      max:              state.max,
      players:          state.players,
      ready:            state.ready,
    })

    const allReady = state.players.every(n => state.ready[n])
    if (allReady) {
      state.phase       = 'playing'
      state.currentTurn = state.players[state.turnIndex % state.players.length]
      broadcastPlaying(io, roomCode, state)
    }
    return
  }

  // ── Guess ─────────────────────────────────────────────────────
  if (action === 'guess' && state.phase === 'playing') {
    if (state.winner) return
    if (playerName !== state.currentTurn) return

    const parsed = parseInt(payload.number, 10)
    if (isNaN(parsed) || parsed < state.min || parsed > state.max) return

    const targetIdx = (state.players.indexOf(playerName) + 1) % state.players.length
    const target    = state.players[targetIdx]
    const secret    = state.secrets[target]

    let hint
    if (parsed === secret)      hint = 'correct'
    else if (parsed < secret)   hint = 'low'
    else                        hint = 'high'

    const range = state.ranges[playerName]
    if (hint === 'low')  range.low  = Math.max(range.low,  parsed + 1)
    if (hint === 'high') range.high = Math.min(range.high, parsed - 1)

    state.guesses[playerName].push({ number: parsed, hint, range: { ...range } })
    state.guessCounts[playerName]++

    if (hint === 'correct') {
      state.winner = playerName
      state.phase  = 'over'
      const scores = {}
      state.players.forEach(n => {
        scores[n] = n === playerName
          ? Math.max(10, 100 - (state.guessCounts[n] - 1) * 10)
          : Math.max(5,  40  - state.guessCounts[n] * 5)
      })
      broadcastPlaying(io, roomCode, state)
      setTimeout(() => {
        io.to(roomCode).emit('game:over', {
          scores, winner: playerName,
          secrets:     state.secrets,
          guessCounts: state.guessCounts,
        })
      }, 1500)
      return
    }

    state.turnIndex++
    state.currentTurn = state.players[state.turnIndex % state.players.length]
    broadcastPlaying(io, roomCode, state)
    return
  }

  // ── Typing indicator ──────────────────────────────────────────
  if (action === 'typing') {
    if (socket) socket.to(roomCode).emit('game:typing', { from: playerName, count: payload.count || 0 })
    return
  }
  if (action === 'stop-typing') {
    if (socket) socket.to(roomCode).emit('game:stop-typing', { from: playerName })
    return
  }

  // ── Emoji reaction ────────────────────────────────────────────
  if (action === 'react') {
    io.to(roomCode).emit('game:reaction', { from: playerName, emoji: payload.emoji })
  }
}

function broadcastPlaying(io, roomCode, state) {
  io.to(roomCode).emit('game:state', {
    phase:            state.phase,
    difficulty:       state.difficulty,
    difficultyChosen: state.difficultyChosen,
    min:              state.min,
    max:              state.max,
    players:          state.players,
    guesses:          state.guesses,
    guessCounts:      state.guessCounts,
    currentTurn:      state.currentTurn,
    ranges:           state.ranges,
    winner:           state.winner,
    ...(state.phase === 'over' ? { secrets: state.secrets } : {}),
  })
}

module.exports = { startNumberGuessing, handleNumberGuessingAction }