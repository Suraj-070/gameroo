import { useState, useEffect } from 'react'
import styles from './GameCountdown.module.css'
import { useSound, Haptics } from '../../hooks/useSound'

// Shows 3-2-1 countdown before game starts
export default function GameCountdown({ onDone, gameName }) {
  const [count, setCount] = useState(3)
  const sound = useSound()

  useEffect(() => {
    sound.tick()
    Haptics.medium()
    const t = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          clearInterval(t)
          sound.win()
          Haptics.success()
          setTimeout(onDone, 600)
          return 0
        }
        sound.tick()
        Haptics.medium()
        return c - 1
      })
    }, 900)
    return () => clearInterval(t)
  }, [])

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <p className={styles.label}>{gameName} starting</p>
        <div className={`${styles.number} ${count === 0 ? styles.go : ''}`}>
          {count === 0 ? 'GO!' : count}
        </div>
        <div className={styles.dots}>
          {[3,2,1].map(n => (
            <div key={n} className={`${styles.dot} ${count <= n ? styles.dotActive : ''}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
