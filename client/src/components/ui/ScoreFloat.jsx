import { useState, useEffect } from 'react'

// Call fireScoreFloat(pts, x, y) to show a floating score
let listeners = []

export function fireScoreFloat(pts, x, y) {
  listeners.forEach(fn => fn(pts, x, y))
}

export default function ScoreFloat() {
  const [floats, setFloats] = useState([])

  useEffect(() => {
    const handler = (pts, x, y) => {
      const id = Date.now() + Math.random()
      setFloats(f => [...f, { id, pts, x: x || window.innerWidth/2, y: y || window.innerHeight/2 }])
      setTimeout(() => setFloats(f => f.filter(i => i.id !== id)), 1900)
    }
    listeners.push(handler)
    return () => { listeners = listeners.filter(fn => fn !== handler) }
  }, [])

  return (
    <>
      {floats.map(f => (
        <div key={f.id} className="scoreFloat"
          style={{ left: f.x - 20, top: f.y - 20 }}>
          +{f.pts}
        </div>
      ))}
    </>
  )
}
