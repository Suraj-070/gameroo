// Number Wordle — Turn-based with difficulty modes
// Easy:   4 digits, no repeats
// Medium: 5 digits, no repeats
// Hard:   5 digits, repeats allowed

const DIFF_CONFIG = {
  easy:   { digits: 4, repeats: false, label: '🟢 Easy — 4 digits, no repeats' },
  medium: { digits: 5, repeats: false, label: '🟡 Medium — 5 digits, no repeats' },
  hard:   { digits: 5, repeats: true,  label: '🔴 Hard — 5 digits, repeats allowed' },
}

function calcFeedback(guess, secret) {
  const len = secret.length
  const fb   = Array(len).fill('gray')
  const sec  = secret.split('')
  const g    = guess.split('')
  const used = Array(len).fill(false)

  for (let i = 0; i < len; i++) {
    if (g[i] === sec[i]) { fb[i] = 'green'; used[i] = true }
  }
  for (let i = 0; i < len; i++) {
    if (fb[i] === 'green') continue
    for (let j = 0; j < len; j++) {
      if (!used[j] && g[i] === sec[j]) { fb[i] = 'yellow'; used[j] = true; break }
    }
  }
  return fb
}

function validateSecret(s, difficulty) {
  const cfg = DIFF_CONFIG[difficulty] || DIFF_CONFIG.easy
  if (s.length !== cfg.digits)             return `Must be exactly ${cfg.digits} digits`
  if (!/^\d+$/.test(s))                    return 'Digits only'
  if (!cfg.repeats && new Set(s).size !== cfg.digits) return 'All digits must be unique'
  return null
}

function startNumberWordle(io, roomCode, players) {
  if (players.length < 2) {
    io.to(roomCode).emit('game:error', { message: 'Need at least 2 players' })
    return null
  }

  const state = {
    phase: 'difficulty',  // difficulty → setup → playing → over
    difficulty: 'easy',
    players: players.map(p => p.name),
    hostId: players[0].name,
    secrets: {},
    ready: {},
    guesses: {},
    guessCounts: {},
    currentTurn: null,
    turnIndex: 0,
    winner: null,
  }

  players.forEach(p => {
    state.secrets[p.name]     = null
    state.ready[p.name]       = false
    state.guesses[p.name]     = []
    state.guessCounts[p.name] = 0
  })

  broadcastState(io, roomCode, state)
  return { state, timer: null }
}

function handleNumberWordleAction(io, roomCode, playerName, action, payload, state, socket) {
  if (!state) return

  // ── Host sets difficulty ──────────────────────────────────────
  if (action === 'set-difficulty' && state.phase === 'difficulty') {
    if (playerName !== state.hostId) return
    const diff = payload.difficulty
    if (!DIFF_CONFIG[diff]) return
    state.difficulty = diff
    io.to(roomCode).emit('game:state', {
      phase: 'difficulty',
      difficulty: diff,
      players: state.players,
      hostId: state.hostId,
      diffConfig: DIFF_CONFIG[diff],
    })
    return
  }

  // ── Host confirms difficulty → move to setup ──────────────────
  if (action === 'confirm-difficulty' && state.phase === 'difficulty') {
    if (playerName !== state.hostId) return
    state.phase = 'setup'
    broadcastState(io, roomCode, state)
    return
  }

  // ── Set secret ────────────────────────────────────────────────
  if (action === 'set-secret' && state.phase === 'setup') {
    const secret = String(payload.number || '').trim()
    const err = validateSecret(secret, state.difficulty)
    if (err) {
      io.to(roomCode).emit('game:validation-error', { to: playerName, message: err })
      return
    }
    state.secrets[playerName] = secret
    state.ready[playerName]   = true

    io.to(roomCode).emit('game:state', {
      phase: 'setup',
      players: state.players,
      ready: state.ready,
      difficulty: state.difficulty,
      diffConfig: DIFF_CONFIG[state.difficulty],
    })

    if (state.players.every(n => state.ready[n])) {
      state.phase       = 'playing'
      state.currentTurn = state.players[0]
      broadcastState(io, roomCode, state)
    }
    return
  }

  // ── Guess ─────────────────────────────────────────────────────
  if (action === 'guess' && state.phase === 'playing') {
    if (playerName !== state.currentTurn) return
    if (state.winner) return

    const cfg   = DIFF_CONFIG[state.difficulty]
    const guess = String(payload.guess || '').trim()
    const err   = validateSecret(guess, state.difficulty)
    if (err) {
      io.to(roomCode).emit('game:validation-error', { to: playerName, message: err })
      return
    }

    const targetIdx = (state.players.indexOf(playerName) + 1) % state.players.length
    const target    = state.players[targetIdx]
    const secret    = state.secrets[target]
    const feedback  = calcFeedback(guess, secret)
    const won       = feedback.every(f => f === 'green')

    state.guesses[playerName].push({ digits: guess.split(''), feedback })
    state.guessCounts[playerName]++

    if (won) {
      state.winner = playerName
      state.phase  = 'over'
      broadcastState(io, roomCode, state)
      const scores = {}
      state.players.forEach(n => {
        scores[n] = n === playerName
          ? Math.max(10, 100 - (state.guessCounts[n] - 1) * 10)
          : Math.max(5,  40  - state.guessCounts[n] * 5)
      })
      setTimeout(() => {
        io.to(roomCode).emit('game:over', { scores, winner: playerName, secrets: state.secrets, guessCounts: state.guessCounts })
      }, 2000)
      return
    }

    // Next turn
    state.turnIndex++
    state.currentTurn = state.players[state.turnIndex % state.players.length]
    broadcastState(io, roomCode, state)
    return
  }

  // ── Typing indicator ──────────────────────────────────────────
  if (action === 'typing') {
    socket.to(roomCode).emit('game:typing', { from: playerName, count: payload.count || 0 })
    return
  }
  if (action === 'stop-typing') {
    socket.to(roomCode).emit('game:stop-typing', { from: playerName })
    return
  }

  // ── Emoji reaction ────────────────────────────────────────────
  if (action === 'react') {
    io.to(roomCode).emit('game:reaction', { from: playerName, emoji: payload.emoji })
  }
}

function broadcastState(io, roomCode, state) {
  const cfg = DIFF_CONFIG[state.difficulty]
  io.to(roomCode).emit('game:state', {
    phase:       state.phase,
    difficulty:  state.difficulty,
    diffConfig:  cfg,
    players:     state.players,
    hostId:      state.hostId,
    ready:       state.ready,
    guesses:     state.guesses,
    guessCounts: state.guessCounts,
    currentTurn: state.currentTurn,
    winner:      state.winner,
    maxGuesses:  6,
    ...(state.phase === 'over' ? { secrets: state.secrets } : {}),
  })
}

module.exports = { startNumberWordle, handleNumberWordleAction }