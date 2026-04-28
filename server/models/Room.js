const mongoose = require('mongoose')

const playerSchema = new mongoose.Schema({
  name:            { type: String, required: true },
  isHost:          { type: Boolean, default: false },
  connected:       { type: Boolean, default: true },
  disconnectedAt:  { type: Date, default: null },
}, { _id: false })

const roomSchema = new mongoose.Schema({
  code:        { type: String, required: true, unique: true, uppercase: true, index: true },
  hostName:    { type: String, required: true },
  players:     [playerSchema],
  currentGame: { type: String, default: null },
  gameState:   { type: mongoose.Schema.Types.Mixed, default: null },
  scores:      { type: mongoose.Schema.Types.Mixed, default: {} },
  phase:       { type: String, default: 'lobby', enum: ['lobby','playing','results'] },
  expiresAt:   { type: Date, default: () => new Date(Date.now() + 2*60*60*1000) }, // 2hr TTL
}, { timestamps: true })

// Auto-delete expired rooms via MongoDB TTL index
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Touch expiry whenever room is updated (keep active rooms alive)
roomSchema.methods.touch = function () {
  this.expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // extend 2hr from now
}

module.exports = mongoose.model('Room', roomSchema)
