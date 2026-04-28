// Word Wordle — SIMULTANEOUS multiplayer
// Server picks ONE secret word, BOTH players guess at the same time
// First to get all green wins. Opponent gets remaining guesses after someone wins.
// Max 6 guesses each. Letters hidden on opponent board (colours only).

const { ANSWER_WORDS, VALID_WORDS } = require("./wordList")

const MAX_GUESSES = 6
const WORD_LEN    = 5

function randomWord() {
  return ANSWER_WORDS[Math.floor(Math.random() * ANSWER_WORDS.length)]
}

function calcFeedback(guess, secret) {
  const g = guess.toUpperCase().split('')
  const s = secret.toUpperCase().split('')
  const fb = Array(WORD_LEN).fill('gray')
  const used = Array(WORD_LEN).fill(false)
  for (let i = 0; i < WORD_LEN; i++) {
    if (g[i] === s[i]) { fb[i] = 'green'; used[i] = true }
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (fb[i] === 'green') continue
    for (let j = 0; j < WORD_LEN; j++) {
      if (!used[j] && g[i] === s[j]) { fb[i] = 'yellow'; used[j] = true; break }
    }
  }
  return fb
}

function isValidWord(word) {
  const w = word.toUpperCase()
  // FIX: if VALID_WORDS is populated use it, otherwise accept any 5-letter alpha word
  // This prevents silent rejections when word list is incomplete
  if (VALID_WORDS && VALID_WORDS.size > 100) {
    return VALID_WORDS.has(w)
  }
  // Fallback: accept any 5 alphabetic characters
  return /^[A-Z]{5}$/.test(w)
}

function startWordWordle(io, roomCode, players) {
  if (players.length < 2) {
    io.to(roomCode).emit('game:error', { message: 'Need at least 2 players' })
    return null
  }

  const state = {
    phase: 'ready',   // ready → playing → over
    word: randomWord(),
    players: players.map(p => p.name),
    ready: {},
    guesses: {},       // name -> [{ letters, feedback }]
    guessCounts: {},
    solved: {},        // name -> true if they got it
    winner: null,
    bothFailed: false,
  }

  players.forEach(p => {
    state.ready[p.name] = false
    state.guesses[p.name] = []
    state.guessCounts[p.name] = 0
    state.solved[p.name] = false
  })

  broadcastState(io, roomCode, state)
  return { state, timer: null }
}

function handleWordWordleAction(io, roomCode, playerName, action, payload, state, socket) {
  if (!state) return

  // ── Ready ─────────────────────────────────────────────────────
  if (action === 'ready' && state.phase === 'ready') {
    state.ready[playerName] = true
    const allReady = state.players.every(n => state.ready[n])
    if (allReady) {
      state.phase = 'playing'
    }
    broadcastState(io, roomCode, state)
    return
  }

  // ── Guess ─────────────────────────────────────────────────────
  if (action === 'guess' && state.phase === 'playing') {
    if (state.solved[playerName]) return
    if (state.guessCounts[playerName] >= MAX_GUESSES) return

    const guess = (payload.guess || '').toUpperCase().trim()
    if (guess.length !== WORD_LEN) return sendError(socket, 'Word must be 5 letters')
    if (!/^[A-Z]+$/.test(guess))   return sendError(socket, 'Letters only')
    if (!isValidWord(guess))       return sendError(socket, 'Not a valid word')

    const feedback = calcFeedback(guess, state.word)
    const won = feedback.every(f => f === 'green')

    state.guesses[playerName].push({ letters: guess.split(''), feedback })
    state.guessCounts[playerName]++

    if (won) {
      state.solved[playerName] = true
      if (!state.winner) state.winner = playerName
    }

    broadcastState(io, roomCode, state)

    // Check if game is over
    const allDone = state.players.every(n =>
      state.solved[n] || state.guessCounts[n] >= MAX_GUESSES
    )

    if (allDone) {
      state.phase = 'over'
      const noOneSolved = state.players.every(n => !state.solved[n])
      state.bothFailed = noOneSolved

      const scores = {}
      state.players.forEach(n => {
        if (state.solved[n]) {
          scores[n] = Math.max(10, 100 - (state.guessCounts[n] - 1) * 12)
        } else {
          scores[n] = 0
        }
      })

      broadcastState(io, roomCode, state)
      setTimeout(() => {
        io.to(roomCode).emit('game:over', {
          scores,
          winner: state.winner,
          word: state.word,
          bothFailed: state.bothFailed,
          guessCounts: state.guessCounts,
          guesses: state.guesses,
        })
      }, 1500)
    }
    return
  }

  // ── Typing indicator ──────────────────────────────────────────
  if (action === 'typing') {
    if (socket) socket.to(roomCode).emit('game:typing', { from: playerName, count: payload?.count || 0 })
    return
  }
  if (action === 'stop-typing') {
    if (socket) socket.to(roomCode).emit('game:stop-typing', { from: playerName })
    return
  }

  // ── Taunt / reaction ──────────────────────────────────────────
  if (action === 'react') {
    io.to(roomCode).emit('game:reaction', { from: playerName, emoji: payload.emoji })
  }
}

function sendError(socket, message) {
  if (socket) socket.emit('game:validation-error', { message })
}

function broadcastState(io, roomCode, state) {
  io.to(roomCode).emit('game:state', {
    phase: state.phase,
    players: state.players,
    ready: state.ready,
    guesses: state.guesses,
    guessCounts: state.guessCounts,
    solved: state.solved,
    winner: state.winner,
    maxGuesses: MAX_GUESSES,
    wordLen: WORD_LEN,
    ...(state.phase === 'over' ? { word: state.word } : {}),
  })
}

module.exports = { startWordWordle, handleWordWordleAction }