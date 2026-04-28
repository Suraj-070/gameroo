// Word Duel — Round 1: Player B guesses Player A's word. Round 2: swap. Fewest guesses wins.

const WORDS = [
  'PLANET','CASTLE','BRIDGE','JUNGLE','MIRROR','CANDLE','FROZEN','PIRATE',
  'GARDEN','TEMPLE','DRAGON','CACTUS','ROCKET','WIZARD','MUSEUM','ISLAND',
  'FOREST','MARKET','PALACE','SILVER','BUTTON','ANCHOR','GRAVEL','FLUTE',
  'STORM','BRAVE','CHESS','CRISP','DRAFT','GLOOM','HINGE','IRONY','KNACK',
  'MARSH','ONSET','PLANK','SCOUT','TULIP','ALLOW','BIRTH','CHILL','ELBOW',
  'FROWN','GUILD','HASTE','IMAGE','KARMA','LIMBO','MANOR','NOMAD','OZONE',
  'PIXEL','QUEST','RADAR','SHELF','TOAST','BLOOM','CANDY','DEPOT','FABLE',
  'GIANT','LUNAR','MOOSE','NOBLE','OTTER','RISKY','WALTZ','BOXER','ELDER',
  'GREET','HIPPO','JOUST','SWORD','ANGEL','ARROW','BEACH','CLOUD','DANCE',
  'EAGLE','FLAME','GRACE','HEART','KNIFE','LEMON','MAGIC','NIGHT','OCEAN',
  'STEAK','PIANO','GLASS','FLAME','RAPID','THICK','BLANK','TROOP','CIVIC',
  'YACHT','VALID','TOWER','STONE','SMOKE','RIDER','QUEEN','POWER','PEARL',
]

const HINTS = {
  PLANET:'Orbits a star',CASTLE:'Medieval stronghold',BRIDGE:'Connects two sides',
  JUNGLE:'Dense tropical forest',MIRROR:'Shows your reflection',CANDLE:'Provides light when lit',
  FROZEN:'Solid from cold',PIRATE:'Sails the high seas',GARDEN:'Where flowers grow',
  TEMPLE:'Place of worship',DRAGON:'Mythical fire-breather',CACTUS:'Desert plant with spines',
  ROCKET:'Launched into space',WIZARD:'Casts magic spells',MUSEUM:'Houses art and history',
  ISLAND:'Land surrounded by water',FOREST:'Dense trees',MARKET:'Place to buy and sell',
  PALACE:'Royal residence',SILVER:'Precious grey metal',BUTTON:'Fastens clothing',
  ANCHOR:'Keeps ships in place',GRAVEL:'Small loose stones',FLUTE:'A wind instrument',
  STORM:'Violent weather',BRAVE:'Showing courage',CHESS:'Board game with kings',
  CRISP:'Fresh and firm',DRAFT:'Early version',GLOOM:'Darkness or sadness',
  HINGE:'Door pivot',IRONY:'Opposite of expected',KNACK:'Natural talent',
  MARSH:'Wetland area',ONSET:'Beginning of something',PLANK:'Flat piece of wood',
  SCOUT:'One who explores ahead',TULIP:'Spring flower',ALLOW:'To permit',
  BIRTH:'Coming into existence',CHILL:'Mild coldness',ELBOW:'Arm joint',
  FROWN:'Unhappy expression',GUILD:'Workers association',HASTE:'Hurrying',
  IMAGE:'Visual representation',KARMA:'What goes around comes around',LIMBO:'Uncertain state',
  MANOR:'Large country house',NOMAD:'Wandering person',OZONE:'Protective atmospheric layer',
  PIXEL:'Smallest screen unit',QUEST:'An adventure or search',RADAR:'Detection system',
  SHELF:'Storage ledge',TOAST:'Browned bread',BLOOM:'A flower or to flourish',
  CANDY:'Sweet confection',DEPOT:'Storage facility',FABLE:'A moral story',
  GIANT:'Very large creature',LUNAR:'Related to the moon',MOOSE:'Large deer species',
  NOBLE:'Having high morals',OTTER:'River-swimming mammal',RISKY:'Involves danger',
  WALTZ:'Elegant ballroom dance',BOXER:'Fighting athlete',ELDER:'Older or senior',
  GREET:'Welcome someone',HIPPO:'Large African animal',JOUST:'Knights on horseback fighting',
  SWORD:'Long bladed weapon',ANGEL:'Divine messenger',ARROW:'Shot from a bow',
  BEACH:'Sandy coastal area',CLOUD:'Water vapor in sky',DANCE:'Move rhythmically',
  EAGLE:'Large bird of prey',FLAME:'Fire light',GRACE:'Elegance of movement',
  HEART:'Pumps blood',KNIFE:'Sharp cutting tool',LEMON:'Sour yellow fruit',
  MAGIC:'Supernatural power',NIGHT:'Dark period of day',OCEAN:'Large saltwater body',
  STEAK:'Grilled meat cut',PIANO:'Musical keyboard instrument',GLASS:'Transparent material',
  RAPID:'Very fast',THICK:'Not thin',BLANK:'Empty or unfilled',
  TROOP:'Group of soldiers',CIVIC:'Relating to a city',YACHT:'Luxury sailing vessel',
  VALID:'Legally acceptable',TOWER:'Tall narrow structure',STONE:'Hard mineral matter',
  SMOKE:'Gas from fire',RIDER:'One who rides',QUEEN:'Female monarch',
  POWER:'Ability to act',PEARL:'Gem from an oyster',
}

function randomWord() {
  let w
  do { w = WORDS[Math.floor(Math.random()*WORDS.length)] } while (!HINTS[w])
  return w
}

function startWordDuel(io, roomCode, players) {
  if (players.length < 2) {
    io.to(roomCode).emit('game:error', { message: 'Need at least 2 players' })
    return null
  }

  // FIX: Pick two different words — one per round
  const word1 = randomWord()
  let word2 = randomWord()
  while (word2 === word1) word2 = randomWord()

  const state = {
    // Round tracking
    round: 1,
    totalRounds: 2,
    words: [word1, word2],
    hints: [HINTS[word1] || 'Guess the word', HINTS[word2] || 'Guess the word'],
    roundResults: [], // [{ word, guesser, guessCount, solved }]

    // Current round
    word: word1,
    hint: HINTS[word1] || 'Guess the word',
    letters: word1.length,
    phase: 'guessing',
    guesser: players[1].name,  // p[1] guesses first
    setter:  players[0].name,  // p[0] sets first
    players: players.map(p => p.name),
    guesses: [],
    guessCount: 0,
    maxGuesses: 8,
    roundStart: Date.now(),

    // Setter hint
    setterHintUsed: false,
    setterExtraHint: null,
  }

  state._timer = setTimeout(() => {
    state.phase = 'reveal'
    broadcastState(io, roomCode, state)
    setTimeout(() => advanceRound(io, roomCode, state), 3000)
  }, 60 * 1000)

  broadcastState(io, roomCode, state)
  return { state, timer: null }
}

function handleWordDuelAction(io, roomCode, playerName, action, payload, state, timer) {
  if (!state) return

  // FIX: setter can add one extra hint
  if (action === 'add-hint' && state.phase === 'guessing' && playerName === state.setter) {
    if (state.setterHintUsed) return
    const hint = (payload.hint || '').trim().slice(0, 80)
    if (!hint) return
    state.setterHintUsed = true
    state.setterExtraHint = hint
    broadcastState(io, roomCode, state)
    return
  }

  if (action !== 'guess' || state.phase !== 'guessing') return
  if (playerName !== state.guesser) return

  const guess   = (payload.guess || '').toUpperCase().trim()
  const correct = guess === state.word.toUpperCase()

  state.guesses.push({ player: playerName, guess, correct })
  state.guessCount++

  if (correct) {
    clearTimeout(state._timer)
    state.phase = 'reveal'
    broadcastState(io, roomCode, state)
    setTimeout(() => advanceRound(io, roomCode, state), 3000)
    return
  }

  if (state.guessCount >= state.maxGuesses) {
    clearTimeout(state._timer)
    state.phase = 'reveal'
    broadcastState(io, roomCode, state)
    setTimeout(() => advanceRound(io, roomCode, state), 3000)
    return
  }

  broadcastState(io, roomCode, state)
}

function advanceRound(io, roomCode, state) {
  // Save round result
  const solved = state.guesses.some(g => g.correct)
  state.roundResults.push({
    round: state.round,
    word: state.word,
    guesser: state.guesser,
    setter: state.setter,
    guessCount: state.guessCount,
    solved,
  })

  // FIX: if round 1 done, start round 2 with swapped roles
  if (state.round < state.totalRounds) {
    state.round++
    const word2 = state.words[1]
    state.word     = word2
    state.hint     = state.hints[1]
    state.letters  = word2.length
    state.phase    = 'guessing'
    // Swap setter and guesser
    const prevGuesser = state.guesser
    state.guesser  = state.setter
    state.setter   = prevGuesser
    state.guesses  = []
    state.guessCount = 0
    state.setterHintUsed  = false
    state.setterExtraHint = null
    state.roundStart = Date.now()

    // FIX: store round 2 timer on state
    state._timer = setTimeout(() => {
      state.phase = 'reveal'
      broadcastState(io, roomCode, state)
      setTimeout(() => endWordDuel(io, roomCode, state), 3000)
    }, 60 * 1000)

    broadcastState(io, roomCode, state)
  } else {
    endWordDuel(io, roomCode, state)
  }
}

function endWordDuel(io, roomCode, state) {
  // Score: fewer guesses = more points. Setter gets bonus if guesser failed.
  const scores = {}
  state.players.forEach(n => { scores[n] = 0 })

  state.roundResults.forEach(r => {
    if (r.solved) {
      scores[r.guesser] = (scores[r.guesser] || 0) + Math.max(10, 100 - (r.guessCount - 1) * 10)
      scores[r.setter]  = (scores[r.setter]  || 0) + 20 // setter participation
    } else {
      scores[r.setter]  = (scores[r.setter]  || 0) + 60 // setter wins if guesser failed
      scores[r.guesser] = (scores[r.guesser] || 0) + 5  // consolation
    }
  })

  const winner = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]?.[0] || null

  io.to(roomCode).emit('game:over', {
    scores,
    winner,
    roundResults: state.roundResults,
    words: state.words,
  })
}

function broadcastState(io, roomCode, state) {
  io.to(roomCode).emit('game:state', {
    phase:          state.phase,
    round:          state.round,
    totalRounds:    state.totalRounds,
    hint:           state.hint,
    setterExtraHint: state.setterExtraHint,
    setterHintUsed: state.setterHintUsed,
    letters:        state.letters,
    guesses:        state.guesses,
    guessCount:     state.guessCount,
    maxGuesses:     state.maxGuesses,
    guesser:        state.guesser,
    setter:         state.setter,
    players:        state.players,
    roundResults:   state.roundResults,
    ...(state.phase === 'reveal' ? { word: state.word } : {}),
  })
}

module.exports = { startWordDuel, handleWordDuelAction }