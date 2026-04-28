// TriviaBlitz — server-authoritative timer, answer order, wrong-answer penalty, streak bonus

const QUESTIONS = [
  // Geography
  { q:'What is the capital of Japan?', choices:['Beijing','Seoul','Tokyo','Bangkok'], answer:'Tokyo', cat:'🌍' },
  { q:'Which is the largest ocean?', choices:['Atlantic','Indian','Arctic','Pacific'], answer:'Pacific', cat:'🌍' },
  { q:'Which country has the most natural lakes?', choices:['USA','Russia','Brazil','Canada'], answer:'Canada', cat:'🌍' },
  { q:'What is the longest river in the world?', choices:['Amazon','Yangtze','Mississippi','Nile'], answer:'Nile', cat:'🌍' },
  { q:'Which continent is the Sahara Desert on?', choices:['Asia','Australia','Africa','South America'], answer:'Africa', cat:'🌍' },
  { q:'What is the smallest country in the world?', choices:['Monaco','San Marino','Vatican City','Liechtenstein'], answer:'Vatican City', cat:'🌍' },
  { q:'Which country has the most pyramids?', choices:['Egypt','Mexico','Peru','Sudan'], answer:'Sudan', cat:'🌍' },
  { q:'What is the capital of Australia?', choices:['Sydney','Melbourne','Brisbane','Canberra'], answer:'Canberra', cat:'🌍' },
  { q:'What is the capital of Brazil?', choices:['Rio de Janeiro','São Paulo','Brasília','Salvador'], answer:'Brasília', cat:'🌍' },
  { q:'Which country owns Greenland?', choices:['USA','Canada','Norway','Denmark'], answer:'Denmark', cat:'🌍' },
  // Science
  { q:'What gas do plants absorb during photosynthesis?', choices:['Oxygen','Nitrogen','Carbon Dioxide','Hydrogen'], answer:'Carbon Dioxide', cat:'🔬' },
  { q:'How many bones are in the adult human body?', choices:['196','206','216','226'], answer:'206', cat:'🔬' },
  { q:'What is the chemical symbol for gold?', choices:['Go','Gd','Au','Ag'], answer:'Au', cat:'🔬' },
  { q:'Which planet is known as the Red Planet?', choices:['Venus','Mars','Jupiter','Saturn'], answer:'Mars', cat:'🔬' },
  { q:'What is the speed of light (approx)?', choices:['300,000 km/s','150,000 km/s','450,000 km/s','600,000 km/s'], answer:'300,000 km/s', cat:'🔬' },
  { q:'What is the hardest natural substance?', choices:['Gold','Iron','Diamond','Quartz'], answer:'Diamond', cat:'🔬' },
  { q:'How many chromosomes do humans have?', choices:['23','44','46','48'], answer:'46', cat:'🔬' },
  { q:'What is the powerhouse of the cell?', choices:['Nucleus','Ribosome','Mitochondria','Vacuole'], answer:'Mitochondria', cat:'🔬' },
  { q:'Which element has the symbol Fe?', choices:['Fluorine','Iron','Francium','Fermium'], answer:'Iron', cat:'🔬' },
  { q:'How many planets are in our solar system?', choices:['7','8','9','10'], answer:'8', cat:'🔬' },
  { q:'What is absolute zero in Celsius?', choices:['-100°C','-173°C','-233°C','-273°C'], answer:'-273°C', cat:'🔬' },
  { q:'What type of wave is sound?', choices:['Transverse','Longitudinal','Electromagnetic','Gamma'], answer:'Longitudinal', cat:'🔬' },
  // History
  { q:'Who painted the Mona Lisa?', choices:['Michelangelo','Raphael','Da Vinci','Caravaggio'], answer:'Da Vinci', cat:'📜' },
  { q:'In which year did World War II end?', choices:['1943','1944','1945','1946'], answer:'1945', cat:'📜' },
  { q:'Who was the first person on the moon?', choices:['Buzz Aldrin','Yuri Gagarin','Neil Armstrong','John Glenn'], answer:'Neil Armstrong', cat:'📜' },
  { q:'In what year did the Berlin Wall fall?', choices:['1987','1988','1989','1991'], answer:'1989', cat:'📜' },
  { q:'Who wrote Romeo and Juliet?', choices:['Charles Dickens','Jane Austen','Shakespeare','Tolkien'], answer:'Shakespeare', cat:'📜' },
  { q:'Which country first gave women the right to vote?', choices:['USA','UK','France','New Zealand'], answer:'New Zealand', cat:'📜' },
  { q:'In what year did the Titanic sink?', choices:['1910','1911','1912','1913'], answer:'1912', cat:'📜' },
  { q:'Who was the first Roman Emperor?', choices:['Julius Caesar','Nero','Augustus','Caligula'], answer:'Augustus', cat:'📜' },
  // Entertainment
  { q:'How many strings does a standard guitar have?', choices:['4','5','6','7'], answer:'6', cat:'🎬' },
  { q:'Which band performed "Bohemian Rhapsody"?', choices:['The Beatles','Led Zeppelin','Queen','The Rolling Stones'], answer:'Queen', cat:'🎬' },
  { q:'What is the best-selling video game of all time?', choices:['Tetris','GTA V','Minecraft','Mario Kart'], answer:'Minecraft', cat:'🎬' },
  { q:'How many Harry Potter books are there?', choices:['5','6','7','8'], answer:'7', cat:'🎬' },
  { q:'What is the highest-grossing film of all time (adjusted)?', choices:['Avengers Endgame','Avatar','Gone with the Wind','Titanic'], answer:'Gone with the Wind', cat:'🎬' },
  { q:'In chess, which piece can only move diagonally?', choices:['Rook','Knight','Bishop','Queen'], answer:'Bishop', cat:'🎬' },
  // Sports
  { q:'How many players are on a basketball team?', choices:['4','5','6','7'], answer:'5', cat:'⚽' },
  { q:'In which sport do you use a shuttlecock?', choices:['Tennis','Badminton','Squash','Ping Pong'], answer:'Badminton', cat:'⚽' },
  { q:'How many rings are on the Olympic flag?', choices:['4','5','6','7'], answer:'5', cat:'⚽' },
  { q:'Which country has won the most FIFA World Cups?', choices:['Germany','Argentina','Italy','Brazil'], answer:'Brazil', cat:'⚽' },
  { q:'How long is a standard marathon (km)?', choices:['40','41','42','43'], answer:'42', cat:'⚽' },
  { q:'How many points is a touchdown worth in American football?', choices:['4','6','7','8'], answer:'6', cat:'⚽' },
  // Food & Nature
  { q:'Which country invented pizza?', choices:['France','Spain','Greece','Italy'], answer:'Italy', cat:'🍕' },
  { q:'What is the most consumed beverage after water?', choices:['Coffee','Beer','Tea','Milk'], answer:'Tea', cat:'🍕' },
  { q:'Which fruit has the most vitamin C?', choices:['Orange','Lemon','Guava','Strawberry'], answer:'Guava', cat:'🍕' },
  { q:'Which animal can sleep for up to 3 years?', choices:['Bear','Snail','Crocodile','Bat'], answer:'Snail', cat:'🐾' },
  { q:'How many hearts does an octopus have?', choices:['1','2','3','4'], answer:'3', cat:'🐾' },
  { q:'What is the fastest land animal?', choices:['Lion','Horse','Cheetah','Greyhound'], answer:'Cheetah', cat:'🐾' },
  { q:'How many legs does a spider have?', choices:['6','8','10','12'], answer:'8', cat:'🐾' },
  { q:'What is the largest land animal?', choices:['Rhino','Hippo','Elephant','Giraffe'], answer:'Elephant', cat:'🐾' },
  // Tech
  { q:'Who founded Microsoft?', choices:['Steve Jobs','Elon Musk','Bill Gates','Jeff Bezos'], answer:'Bill Gates', cat:'💻' },
  { q:'In what year was the first iPhone released?', choices:['2005','2006','2007','2008'], answer:'2007', cat:'💻' },
  { q:'What does "CPU" stand for?', choices:['Core Processing Unit','Central Process Utility','Central Processing Unit','Computer Process Unit'], answer:'Central Processing Unit', cat:'💻' },
  { q:'Which company created the Android operating system?', choices:['Apple','Microsoft','Samsung','Google'], answer:'Google', cat:'💻' },
  { q:'What does "RAM" stand for?', choices:['Random Access Memory','Read And Modify','Rapid Access Module','Run And Map'], answer:'Random Access Memory', cat:'💻' },
  // Math
  { q:'What is the square root of 144?', choices:['11','12','13','14'], answer:'12', cat:'🔢' },
  { q:'How many zeros in one billion?', choices:['6','7','8','9'], answer:'9', cat:'🔢' },
  { q:'What is 15% of 200?', choices:['25','30','35','40'], answer:'30', cat:'🔢' },
  { q:'Which shape has 8 sides?', choices:['Hexagon','Heptagon','Octagon','Nonagon'], answer:'Octagon', cat:'🔢' },
  { q:'What is the value of Pi (to 2 decimal places)?', choices:['3.12','3.14','3.16','3.18'], answer:'3.14', cat:'🔢' },
  { q:'What is 12 x 13?', choices:['144','152','156','164'], answer:'156', cat:'🔢' },
]

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function startTriviaBlitz(io, roomCode, players) {
  const pool  = shuffle(QUESTIONS).slice(0, 10)
  const state = {
    pool, currentIndex: 0,
    phase: 'question',
    answered: {},      // name -> { choice, correct, answeredAt (ms elapsed) }
    answeredOrder: [], // FIX: track who answered first
    streaks: {},       // FIX: streak tracking per player
    roundScores: {},
    timePerQ: 15,
    startedAt: Date.now(), // FIX: server-authoritative start time
    players: players.map(p => p.name),
  }
  players.forEach(p => {
    state.roundScores[p.name] = 0
    state.streaks[p.name] = 0
  })
  broadcastQuestion(io, roomCode, state)
  state._timer = scheduleReveal(io, roomCode, state)  // FIX: store on state so it's always current
  return { state, timer: null }
}

function broadcastQuestion(io, roomCode, state) {
  const q = state.pool[state.currentIndex]
  io.to(roomCode).emit('game:state', {
    phase: 'question',
    question: q.q,
    choices: q.choices,
    category: q.cat,
    questionNum: state.currentIndex + 1,
    total: state.pool.length,
    timePerQ: state.timePerQ,
    startedAt: state.startedAt, // FIX: send to client for accurate countdown
    answered: Object.keys(state.answered),
    answeredOrder: state.answeredOrder, // FIX: who answered in what order
    scores: state.roundScores,
    streaks: state.streaks, // FIX: send streaks
    players: state.players,
  })
}

function scheduleReveal(io, roomCode, state) {
  clearTimeout(state._timer)  // FIX: always clear previous before scheduling new
  state._timer = setTimeout(() => revealAnswer(io, roomCode, state), state.timePerQ * 1000)
  return state._timer
}

function revealAnswer(io, roomCode, state) {
  const q = state.pool[state.currentIndex]
  io.to(roomCode).emit('game:state', {
    phase: 'reveal',
    question: q.q,
    choices: q.choices,
    answer: q.answer,
    answered: state.answered,
    answeredOrder: state.answeredOrder,
    scores: state.roundScores,
    streaks: state.streaks,
    players: state.players,
    questionNum: state.currentIndex + 1,
    total: state.pool.length,
  })

  setTimeout(() => {
    state.currentIndex++
    state.answered = {}
    state.answeredOrder = []
    if (state.currentIndex >= state.pool.length) {
      io.to(roomCode).emit('game:over', {
        scores: state.roundScores,
        winner: topPlayer(state.roundScores),
        streaks: state.streaks,
      })
    } else {
      state.startedAt = Date.now()
      broadcastQuestion(io, roomCode, state)
      scheduleReveal(io, roomCode, state)  // FIX: schedule next question timer via state
    }
  }, 3500)
}

function handleTriviaAction(io, roomCode, playerName, action, payload, state, timer) {
  if (action !== 'answer' || state.phase !== 'question') return
  if (state.answered[playerName]) return

  const q       = state.pool[state.currentIndex]
  const correct = payload.choice === q.answer
  const elapsed = (Date.now() - state.startedAt) / 1000

  state.answered[playerName] = { choice: payload.choice, correct, elapsed }
  state.answeredOrder.push(playerName) // FIX: track order

  if (correct) {
    // FIX: speed-based points (30–100) + streak bonus
    const speedPts = Math.max(30, Math.round(100 - (elapsed / state.timePerQ) * 70))
    state.streaks[playerName] = (state.streaks[playerName] || 0) + 1
    const streak = state.streaks[playerName]
    const streakBonus = streak >= 3 ? Math.min(streak * 10, 50) : 0 // cap at +50
    state.roundScores[playerName] = (state.roundScores[playerName] || 0) + speedPts + streakBonus
  } else {
    // FIX: -10 penalty for wrong answer
    state.streaks[playerName] = 0
    state.roundScores[playerName] = Math.max(0, (state.roundScores[playerName] || 0) - 10)
  }

  // Broadcast updated answered state
  io.to(roomCode).emit('game:state', {
    phase: 'question',
    question: q.q,
    choices: q.choices,
    category: q.cat,
    questionNum: state.currentIndex + 1,
    total: state.pool.length,
    timePerQ: state.timePerQ,
    startedAt: state.startedAt,
    answered: Object.keys(state.answered),
    answeredOrder: state.answeredOrder,
    scores: state.roundScores,
    streaks: state.streaks,
    players: state.players,
  })

  // All answered — skip timer
  if (Object.keys(state.answered).length >= state.players.length) {
    clearTimeout(state._timer)  // FIX: use current timer from state
    revealAnswer(io, roomCode, state)
  }
}

function topPlayer(scores) {
  return Object.entries(scores).sort((a,b) => b[1]-a[1])[0]?.[0] || null
}

module.exports = { startTriviaBlitz, handleTriviaAction }