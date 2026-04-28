const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

function signTokens(userId) {
  const access = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' })
  const refresh = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
  return { access, refresh }
}

// ── POST /api/auth/register ────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body

    if (!username?.trim() || !email?.trim() || !password)
      return res.status(400).json({ error: 'All fields required' })

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' })

    if (username.trim().length < 2)
      return res.status(400).json({ error: 'Username must be at least 2 characters' })

    const emailTaken = await User.findOne({ email: email.toLowerCase() })
    if (emailTaken) return res.status(409).json({ error: 'Email already registered' })

    const usernameTaken = await User.findOne({ username: { $regex: new RegExp(`^${username.trim()}$`, 'i') } })
    if (usernameTaken) return res.status(409).json({ error: 'Username already taken' })

    const user = await User.create({ username: username.trim(), email: email.toLowerCase(), password })
    const tokens = signTokens(user._id)

    res.status(201).json({ user: user.toPublic(), ...tokens })
  } catch (err) {
    console.error('[auth] register error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/auth/login ───────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    const valid = await user.comparePassword(password)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const tokens = signTokens(user._id)
    res.json({ user: user.toPublic(), ...tokens })
  } catch (err) {
    console.error('[auth] login error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/auth/refresh ─────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refresh } = req.body
  if (!refresh) return res.status(400).json({ error: 'Refresh token required' })

  try {
    const decoded = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET)
    const user = await User.findById(decoded.id)
    if (!user) return res.status(401).json({ error: 'User not found' })

    const tokens = signTokens(user._id)
    res.json(tokens)
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' })
  }
})

// ── GET /api/auth/me ───────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user: user.toPublic() })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/auth/update-stats ────────────────────────────────
// Called by server internally after game over to persist stats
router.post('/update-stats', authMiddleware, async (req, res) => {
  try {
    const { game, won, score } = req.body
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    user.stats.gamesPlayed += 1
    user.stats.totalScore += score || 0
    if (won) user.stats.gamesWon += 1

    const gameKey = {
      'word-duel':       'wordDuel',
      'trivia-blitz':    'triviaBlitz',
      'bluff-club':      'bluffClub',
      'word-wordle':     'wordWordle',
      'number-wordle':   'numberWordle',
      'number-guessing': 'numberGuessing',
    }[game] || null

    if (gameKey) {
      user.stats[gameKey].played += 1
      if (won) user.stats[gameKey].wins += 1
    }

    await user.save()
    res.json({ stats: user.stats })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
