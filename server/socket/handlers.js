const {
  createToken, resolveToken, refreshToken,
  destroyToken, destroyRoomTokens, destroyPlayerToken,
} = require('../rooms/tokenManager')

const {
  createRoom, getRoom, joinRoom, rejoinRoom,
  markDisconnected, cancelRoom, removePlayer,
  resetRoom, updateScores, updateGameState, getRoomBySocketId,
} = require('../rooms/roomManager')

const { startWordDuel,       handleWordDuelAction       } = require('../games/wordDuel')
const { startTriviaBlitz,    handleTriviaAction         } = require('../games/triviaBlitz')
const { startBluffClub,      handleBluffAction          } = require('../games/bluffClub')
const { startNumberGuessing, handleNumberGuessingAction } = require('../games/numberGuessing')
const { startNumberWordle,   handleNumberWordleAction   } = require('../games/numberWordle')
const { startWordWordle,     handleWordWordleAction     } = require('../games/wordWordle')

const activeSessions = new Map()

module.exports = function registerSocketHandlers(io, socket) {
  console.log(`[socket] connected: ${socket.id}`)

  // ── Room: Create ──────────────────────────────────────────────
  socket.on('room:create', (data, cb) => {
    if (!data || typeof cb !== 'function') return
    const { playerName } = data
    if (!playerName?.trim()) return cb({ error: 'Name required' })
    if (playerName.trim().length > 20) return cb({ error: 'Name too long' })
    const room = createRoom(socket.id, playerName.trim())
    socket.join(room.code)
    console.log(`[room] created ${room.code} by ${playerName}`)
    const token = createToken(room.code, playerName.trim())
    cb({ roomCode: room.code, token })
    io.to(room.code).emit('room:players', room.players)
  })

  // ── Room: Join (also handles reconnect by name match) ─────────
  socket.on('room:join', (data, cb) => {
    if (!data || typeof cb !== 'function') return
    const { playerName, roomCode } = data
    if (!playerName?.trim()) return cb({ error: 'Name required' })
    if (playerName.trim().length > 20) return cb({ error: 'Name too long' })
    if (!roomCode?.trim())   return cb({ error: 'Room code required' })
    if (roomCode.trim().length > 6) return cb({ error: 'Invalid room code' })

    const result = joinRoom(roomCode.toUpperCase(), socket.id, playerName.trim())
    if (result.error) return cb({ error: result.error })

    socket.join(roomCode)
    console.log(`[room] ${playerName} ${result.rejoined ? 'rejoined' : 'joined'} ${roomCode}`)
    const token = createToken(roomCode, playerName.trim())
    cb({ roomCode, rejoined: result.rejoined || false, token })

    if (result.rejoined) {
      // Restore full game state to the reconnecting socket
      const session = activeSessions.get(roomCode)
      if (session?.state) socket.emit('game:state', session.state)
      const room = getRoom(roomCode)
      if (room?.currentGame) socket.emit('game:starting', { game: room.currentGame })
      // Tell others they're back
      socket.to(roomCode).emit('room:partner-reconnected', { playerName: playerName.trim() })
    }

    io.to(roomCode).emit('room:players', result.room.players)
  })

  // ── Room: Rejoin (explicit call from client on page load) ─────
  socket.on('room:rejoin', ({ playerName, roomCode }, cb) => {
    if (!playerName?.trim() || !roomCode?.trim()) return cb({ error: 'Missing fields' })

    const result = rejoinRoom(roomCode.toUpperCase(), socket.id, playerName.trim())
    if (result.error) return cb({ error: result.error })

    socket.join(roomCode)
    console.log(`[room] ${playerName} rejoined ${roomCode} (explicit)`)

    const room    = getRoom(roomCode)
    const session = activeSessions.get(roomCode)

    cb({
      roomCode,
      currentGame: room?.currentGame || null,
      phase:       room?.phase || 'lobby',
      players:     room?.players || [],
      scores:      room?.scores || {},
      hadSession:  true,
    })

    // Restore full game state
    if (session?.state) {
      socket.emit('game:state', session.state)
    } else if (room?.gameState) {
      // FIX: cold start recovery — rebuild activeSessions from DB-persisted state
      if (!activeSessions.has(roomCode)) {
        activeSessions.set(roomCode, { state: room.gameState, timer: null })
      }
      socket.emit('game:state', room.gameState)
    }
    if (room?.currentGame && room?.phase === 'playing') {
      socket.emit('game:starting', { game: room.currentGame })
    }

    // Tell others
    socket.to(roomCode).emit('room:partner-reconnected', { playerName: playerName.trim() })
    io.to(roomCode).emit('room:players', room.players)
  })


  // ── Room: Reconnect (token-based — replaces old room:rejoin flow) ──
  socket.on('room:reconnect', ({ token }, cb) => {
    if (typeof cb !== 'function') return
    const session = resolveToken(token)
    if (!session) return cb({ error: 'Session expired. Please rejoin.' })

    const { roomCode, playerName } = session
    const result = rejoinRoom(roomCode, socket.id, playerName)
    if (result.error) {
      destroyToken(token)
      return cb({ error: result.error })
    }

    socket.join(roomCode)
    const room    = getRoom(roomCode)
    const actSess = activeSessions.get(roomCode)

    // Rebuild activeSessions from DB if cold-started
    if (!actSess && room?.gameState) {
      activeSessions.set(roomCode, { state: room.gameState, timer: null })
    }

    const gameState = actSess?.state || room?.gameState || null

    cb({
      roomCode,
      playerName,
      token,        // send back same token (refreshed)
      currentGame:  room?.currentGame || null,
      phase:        room?.phase || 'lobby',
      players:      room?.players || [],
      scores:       room?.scores || {},
      gameState,
    })

    if (gameState) socket.emit('game:state', gameState)
    if (room?.currentGame && room?.phase === 'playing') {
      socket.emit('game:starting', { game: room.currentGame })
    }

    socket.to(roomCode).emit('room:partner-reconnected', { playerName })
    io.to(roomCode).emit('room:players', room.players)
    console.log(`[token] ${playerName} reconnected to ${roomCode} via token`)
  })

  // ── Room: Leave ───────────────────────────────────────────────
  socket.on('room:leave', ({ roomCode, token }) => {
    if (token) destroyToken(token)
    else {
      // fallback: find by socket+room
      const room = getRoom(roomCode)
      const player = room?.players.find(p => p.id === socket.id)
      if (player) destroyPlayerToken(roomCode, player.name)
    }
    hardLeave(io, socket, roomCode)
  })


  // ── Room: Rename (gamertag change) ───────────────────────────
  socket.on('room:rename', ({ roomCode, newName }, cb) => {
    if (!newName?.trim()) return cb({ error: 'Name required' })
    const room = getRoom(roomCode)
    if (!room) return cb({ error: 'Room not found' })

    const player = room.players.find(p => p.id === socket.id)
    if (!player) return cb({ error: 'Player not found' })

    const taken = room.players.find(
      p => p.id !== socket.id && p.name.toLowerCase() === newName.trim().toLowerCase()
    )
    if (taken) return cb({ error: 'Name already taken in this room' })

    player.name = newName.trim()
    if (player.isHost) room.hostId = socket.id

    cb({ success: true })
    io.to(roomCode).emit('room:players', room.players)
  })

  // ── Room: Cancel (online player chose to end while partner away) ─
  socket.on('room:cancel', ({ roomCode }) => {
    const room = getRoom(roomCode)
    if (!room) return
    console.log(`[room] ${roomCode} cancelled by online player`)
    io.to(roomCode).emit('room:cancelled', { reason: 'The other player cancelled the game.' })
    cancelRoom(roomCode)
    activeSessions.delete(roomCode)
    destroyRoomTokens(roomCode)
  })

  // ── Room: Reset ───────────────────────────────────────────────
  socket.on('room:reset', ({ roomCode }) => {
    const room = getRoom(roomCode)
    if (!room) return
    // FIX: host-only guard — anyone could trigger this before
    if (socket.id !== room.hostId) return
    const reset = resetRoom(roomCode)
    if (!reset) return
    // FIX: clear any game timers before deleting session
    const oldSession = activeSessions.get(roomCode)
    if (oldSession?.state?._timer) clearTimeout(oldSession.state._timer)
    activeSessions.delete(roomCode)
    destroyRoomTokens(roomCode)
    io.to(roomCode).emit('room:reset', { players: reset.players })
    io.to(roomCode).emit('room:players', reset.players)
  })

  // ── Room: Request State (client asks for current game state) ────
  socket.on('room:request-state', ({ roomCode }) => {
    const room    = getRoom(roomCode)
    const session = activeSessions.get(roomCode)
    // Always send game:starting so client knows which game component to mount
    if (room?.currentGame) socket.emit('game:starting', { game: room.currentGame })
    if (session?.state)    socket.emit('game:state', session.state)
  })

  // ── Game: Start ───────────────────────────────────────────────
  socket.on('game:start', ({ roomCode, game }) => {
    const room = getRoom(roomCode)
    if (!room) return
    if (socket.id !== room.hostId) return

    if (room.players.filter(p=>p.connected).length < 2) {
      socket.emit('room:error', { message: 'Need at least 2 players to start' })
      return
    }
    room.currentGame = game
    room.phase = 'playing'
    io.to(roomCode).emit('game:starting', { game })

    // Start session immediately — countdown is client-side, no delay needed
    let session
    if (game === 'word-duel')           session = startWordDuel(io, roomCode, room.players)
    else if (game === 'trivia-blitz')   session = startTriviaBlitz(io, roomCode, room.players)
    else if (game === 'bluff-club')     session = startBluffClub(io, roomCode, room.players)
    else if (game === 'number-guessing') session = startNumberGuessing(io, roomCode, room.players)
    else if (game === 'number-wordle')  session = startNumberWordle(io, roomCode, room.players)
    else if (game === 'word-wordle')    session = startWordWordle(io, roomCode, room.players)
    if (session) activeSessions.set(roomCode, session)
  })

  // ── Game: Action ──────────────────────────────────────────────
  socket.on('game:action', (data) => {
    // Input validation
    if (!data || typeof data !== 'object') return
    const { roomCode, action, payload, token } = data
    if (typeof roomCode !== 'string' || roomCode.length > 10) return
    if (token) refreshToken(token)  // heartbeat — keep token alive
    if (typeof action !== 'string' || action.length > 30) return
    if (payload && typeof payload !== 'object') return
    if (payload?.guess && typeof payload.guess === 'string') payload.guess = payload.guess.slice(0, 50)
    if (payload?.playerName && typeof payload.playerName === 'string') payload.playerName = payload.playerName.slice(0, 20)

    const room = getRoom(roomCode)
    if (!room) return
    const player = room.players.find(p => p.id === socket.id)
    if (!player) return
    const session = activeSessions.get(roomCode)
    // FIX: heartbeat action should never crash — just ignore if no session
    if (action === 'heartbeat') return
    if (!session) return
    const { state, timer } = session

    if (room.currentGame === 'word-duel')       handleWordDuelAction(io, roomCode, player.name, action, payload, state, timer)
    else if (room.currentGame === 'trivia-blitz')    handleTriviaAction(io, roomCode, player.name, action, payload, state, timer)
    else if (room.currentGame === 'bluff-club')      handleBluffAction(io, roomCode, player.name, action, payload, state)
    else if (room.currentGame === 'number-guessing') handleNumberGuessingAction(io, roomCode, player.name, action, payload, state, socket)
    else if (room.currentGame === 'number-wordle')   handleNumberWordleAction(io, roomCode, player.name, action, payload, state, socket)
    else if (room.currentGame === 'word-wordle')     handleWordWordleAction(io, roomCode, player.name, action, payload, state, socket)

    // Checkpoint game state to DB after every action
    if (session?.state) updateGameState(roomCode, session.state)
  })

  // ── Disconnect ────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`)

    // Intentional leave (room:leave was called first) — already handled
    if (reason === 'io client disconnect') return

    // Unexpected disconnect (refresh, network drop, tab close)
    const result = markDisconnected(socket.id)
    if (!result) return

    const { room, player } = result
    console.log(`[room] ${player.name} disconnected from ${room.code} — waiting for rejoin`)

    // Tell online players their partner dropped — let THEM decide to cancel
    socket.to(room.code).emit('room:partner-disconnected', {
      playerName: player.name,
      // No countdown — online player controls this
    })

    // Broadcast updated player list (shows disconnected state)
    io.to(room.code).emit('room:players', room.players)
  })
}

// Hard leave — player intentionally left
function hardLeave(io, socket, roomCode) {
  const result = removePlayer(socket.id)
  if (!result) return

  socket.leave(result.code || roomCode)

  if (result.deleted) {
    console.log(`[room] ${result.code} deleted (empty)`)
    activeSessions.delete(result.code)
  } else {
    // Tell remaining players this person fully left (not just disconnected)
    const newHost = result.players.find(p => p.isHost)
    io.to(result.code).emit('room:player-left', {
      players: result.players,
      message: 'A player left the game.',
      newHostName: newHost?.name || null,   // FIX: clients need to know new host
    })
    io.to(result.code).emit('room:players', result.players)
  }
}