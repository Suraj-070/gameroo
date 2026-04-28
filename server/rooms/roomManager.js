// roomManager.js — in-memory Map + MongoDB persistence
// In-memory = fast reads every socket event
// MongoDB = survives server restarts, Render spin-downs, disconnects

let Room = null  // lazy-loaded so server works without DB too

function setRoomModel(model) { Room = model }

const rooms = new Map()  // roomCode -> room object (in-memory)

// ── DB sync helpers ────────────────────────────────────────────
async function saveRoom(room) {
  if (!Room) return
  try {
    const doc = await Room.findOneAndUpdate(
      { code: room.code },
      {
        code:        room.code,
        hostName:    room.players.find(p=>p.isHost)?.name || '',
        players:     room.players.map(p => ({
          name:           p.name,
          isHost:         p.isHost,
          connected:      p.connected,
          disconnectedAt: p.disconnectedAt ? new Date(p.disconnectedAt) : null,
        })),
        currentGame: room.currentGame,
        gameState:   room.gameState,
        scores:      room.scores,
        phase:       room.phase,
        expiresAt:   new Date(Date.now() + 2*60*60*1000), // touch TTL
      },
      { upsert: true, new: true }
    )
  } catch (e) {
    console.error('[room] DB save error:', e.message)
  }
}

async function deleteRoom(code) {
  if (!Room) return
  try { await Room.deleteOne({ code }) } catch {}
}

// Checkpoint game state (called after every game action)
async function checkpointGame(code, gameState) {
  if (!Room) return
  try {
    await Room.updateOne({ code }, { $set: { gameState, expiresAt: new Date(Date.now() + 2*60*60*1000) } })
  } catch (e) {
    console.error('[room] checkpoint error:', e.message)
  }
}

// Load all active rooms from DB into memory on server start
async function loadRoomsFromDB() {
  if (!Room) return
  try {
    const docs = await Room.find({ expiresAt: { $gt: new Date() } })
    docs.forEach(doc => {
      rooms.set(doc.code, {
        code:        doc.code,
        hostId:      null, // socket IDs don't survive — all players disconnected
        players:     doc.players.map(p => ({
          id:             null,  // no socket yet
          name:           p.name,
          isHost:         p.isHost,
          connected:      false, // everyone offline after server restart
          disconnectedAt: p.disconnectedAt ? p.disconnectedAt.getTime() : Date.now(),
        })),
        currentGame: doc.currentGame,
        gameState:   doc.gameState,
        scores:      doc.scores || {},
        phase:       doc.phase || 'lobby',
        createdAt:   doc.createdAt.getTime(),
      })
    })
    console.log(`[room] Loaded ${docs.length} rooms from DB`)
  } catch (e) {
    console.error('[room] Failed to load rooms from DB:', e.message)
  }
}

// ── Code gen ───────────────────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ── Core operations ────────────────────────────────────────────
function createRoom(hostId, hostName) {
  let code
  do { code = generateCode() } while (rooms.has(code))

  const room = {
    code, hostId,
    players: [{ id: hostId, name: hostName, isHost: true, connected: true, disconnectedAt: null }],
    currentGame: null, gameState: null,
    scores: {}, phase: 'lobby',
    createdAt: Date.now(),
  }
  rooms.set(code, room)
  saveRoom(room)  // async, non-blocking
  return room
}

function getRoom(code) { return rooms.get(code) || null }

function getRoomBySocketId(socketId) {
  for (const room of rooms.values()) {
    const p = room.players.find(p => p.id === socketId)
    if (p) return { room, player: p }
  }
  return null
}

function joinRoom(code, playerId, playerName) {
  const room = rooms.get(code)
  if (!room) return { error: 'Room not found' }

  // Check for disconnected player with same name → rejoin
  const disconnected = room.players.find(
    p => p.name.toLowerCase() === playerName.toLowerCase() && !p.connected
  )
  if (disconnected) return rejoinRoom(code, playerId, playerName)

  if (room.phase !== 'lobby') return { error: 'Game already in progress' }
  if (room.players.filter(p => p.connected).length >= 10) return { error: 'Room is full' }

  const exists = room.players.find(
    p => p.name.toLowerCase() === playerName.toLowerCase() && p.connected
  )
  if (exists) return { error: 'Name already taken in this room' }

  room.players.push({ id: playerId, name: playerName, isHost: false, connected: true, disconnectedAt: null })
  saveRoom(room)
  return { room, rejoined: false }
}

function rejoinRoom(code, newSocketId, playerName) {
  const room = rooms.get(code)
  if (!room) return { error: 'Room not found — it may have expired' }

  const player = room.players.find(p => p.name.toLowerCase() === playerName.toLowerCase())
  if (!player) return { error: 'Player not found in this room' }

  const wasConnected    = player.connected
  player.id             = newSocketId
  player.connected      = true
  player.disconnectedAt = null
  if (player.isHost) room.hostId = newSocketId

  saveRoom(room)
  return { room, player, rejoined: !wasConnected }
}

function markDisconnected(socketId) {
  const result = getRoomBySocketId(socketId)
  if (!result) return null

  const { room, player } = result
  player.connected      = false
  player.disconnectedAt = Date.now()

  saveRoom(room)
  return { room, player }
}

function cancelRoom(code) {
  rooms.delete(code)
  deleteRoom(code)
  return true
}

function removePlayer(socketId) {
  for (const [code, room] of rooms.entries()) {
    const idx = room.players.findIndex(p => p.id === socketId)
    if (idx === -1) continue

    const [removed] = room.players.splice(idx, 1)

    if (room.players.length === 0) {
      rooms.delete(code)
      deleteRoom(code)
      return { code, deleted: true, players: [] }
    }

    if (removed.isHost || room.hostId === socketId) {
      const next = room.players.find(p => p.connected) || room.players[0]
      next.isHost  = true
      room.hostId  = next.id
    }

    saveRoom(room)
    return { code, deleted: false, players: room.players }
  }
  return null
}

function resetRoom(code) {
  const room = rooms.get(code)
  if (!room) return null
  room.currentGame = null
  room.gameState   = null
  room.scores      = {}
  room.phase       = 'lobby'
  saveRoom(room)
  return room
}

function updateGameState(code, gameState) {
  const room = rooms.get(code)
  if (!room) return
  room.gameState = gameState
  checkpointGame(code, gameState)  // async checkpoint
}

function updateScores(code, updates) {
  const room = rooms.get(code)
  if (!room) return
  for (const [name, pts] of Object.entries(updates)) {
    room.scores[name] = (room.scores[name] || 0) + pts
  }
  saveRoom(room)
}

module.exports = {
  setRoomModel,
  loadRoomsFromDB,
  createRoom, getRoom, joinRoom, rejoinRoom,
  markDisconnected, cancelRoom, removePlayer,
  resetRoom, updateScores, updateGameState,
  getRoomBySocketId,
}
