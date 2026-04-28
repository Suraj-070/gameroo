const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 20,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  avatar: {
    type: String,
    default: null, // initials-based on frontend if null
  },
  stats: {
    gamesPlayed:  { type: Number, default: 0 },
    gamesWon:     { type: Number, default: 0 },
    totalScore:   { type: Number, default: 0 },
    wordDuel:       { wins: { type: Number, default: 0 }, played: { type: Number, default: 0 } },
    triviaBlitz:    { wins: { type: Number, default: 0 }, played: { type: Number, default: 0 } },
    bluffClub:      { wins: { type: Number, default: 0 }, played: { type: Number, default: 0 } },
    wordWordle:     { wins: { type: Number, default: 0 }, played: { type: Number, default: 0 } },
    numberWordle:   { wins: { type: Number, default: 0 }, played: { type: Number, default: 0 } },
    numberGuessing: { wins: { type: Number, default: 0 }, played: { type: Number, default: 0 } },
  },
}, { timestamps: true })

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare password
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password)
}

// Safe public profile (never expose password)
userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    stats: this.stats,
    createdAt: this.createdAt,
  }
}

module.exports = mongoose.model('User', userSchema)
