require('dotenv').config()
const express    = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')
const helmet     = require('helmet')
const compression = require('compression')
const rateLimit  = require('express-rate-limit')
const mongoose   = require('mongoose')
const registerSocketHandlers = require('./socket/handlers')
const authRoutes = require('./routes/auth')
const { setRoomModel, loadRoomsFromDB } = require('./rooms/roomManager')

const app        = express()
const httpServer = createServer(app)
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const PORT       = process.env.PORT || 5000

// ── Security ──────────────────────────────────────────────────
app.set('trust proxy', 1)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Socket.IO needs this off
}))

// ── Compression ───────────────────────────────────────────────
app.use(compression())

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }))
app.use(express.json({ limit: '10kb' })) // reject huge bodies

// ── Rate limiting ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,                   // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes.' },
  skip: req => process.env.NODE_ENV === 'development',
})

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  skip: req => process.env.NODE_ENV === 'development',
})

app.use('/api/', generalLimiter)
app.use('/api/auth/login',    authLimiter)
app.use('/api/auth/register', authLimiter)

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  })
})

// ── Socket.IO ─────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ['GET','POST'], credentials: true },
  pingTimeout:  60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e5, // 100KB max socket message
})

// Socket-level rate limiting
const socketMsgCount = new Map()
io.use((socket, next) => {
  const ip = socket.handshake.address
  const now = Date.now()
  const entry = socketMsgCount.get(ip) || { count: 0, reset: now + 10000 }

  if (now > entry.reset) { entry.count = 0; entry.reset = now + 10000 }
  entry.count++
  socketMsgCount.set(ip, entry)

  if (entry.count > 200) { // 200 events per 10s
    return next(new Error('Rate limit exceeded'))
  }
  next()
})

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket)
})

// ── Startup ───────────────────────────────────────────────────
async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI)
      console.log('[db] MongoDB connected')
      const Room = require('./models/Room')
      setRoomModel(Room)
      await loadRoomsFromDB()
    } catch (err) {
      console.error('[db] MongoDB failed:', err.message)
      console.warn('[db] Running without persistence')
    }
  } else {
    console.warn('[db] No MONGODB_URI — rooms are memory-only')
  }

  httpServer.listen(PORT, () => {
    console.log(`\n🎮 Gamero server on port ${PORT}`)
    console.log(`   Client: ${CLIENT_URL}`)
    console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`)
  })
}

start()
