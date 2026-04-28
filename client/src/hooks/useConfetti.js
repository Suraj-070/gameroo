// Confetti burst on win — canvas-confetti via CDN (loaded lazily)
let loaded = false
let confettiFn = null

async function loadConfetti() {
  if (loaded) return confettiFn
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
    s.onload = () => {
      loaded = true
      confettiFn = window.confetti
      resolve(confettiFn)
    }
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
}

export async function fireConfetti(type = 'win') {
  const confetti = await loadConfetti()
  if (!confetti) return

  if (type === 'win') {
    // Left burst
    confetti({ particleCount: 60, spread: 55, origin: { x: 0.1, y: 0.6 },
      colors: ['#6C63FF','#a855f7','#ec4899','#f97316','#10B981'] })
    // Right burst (slight delay)
    setTimeout(() => confetti({ particleCount: 60, spread: 55, origin: { x: 0.9, y: 0.6 },
      colors: ['#6C63FF','#a855f7','#ec4899','#f97316','#10B981'] }), 150)
    // Center shower
    setTimeout(() => confetti({ particleCount: 80, spread: 90, origin: { x: 0.5, y: 0.4 },
      colors: ['#6C63FF','#fff','#a855f7'] }), 300)
  }

  if (type === 'small') {
    confetti({ particleCount: 30, spread: 60, origin: { x: 0.5, y: 0.5 },
      colors: ['#6C63FF','#a855f7','#10B981'] })
  }

  if (type === 'correct') {
    confetti({ particleCount: 20, spread: 40, origin: { x: 0.5, y: 0.7 },
      colors: ['#10B981','#6EE7B7'], ticks: 60 })
  }
}
