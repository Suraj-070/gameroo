import { useState, useEffect } from 'react'
import styles from './DisconnectBanner.module.css'

// Shows when YOUR connection drops — overlay telling you we're reconnecting
export function ReconnectOverlay({ visible, onGiveUp }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!visible) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [visible])

  if (!visible) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.overlayCard}>
        <div className={styles.spinner} />
        <h3 className={styles.overlayTitle}>Connection lost...</h3>
        <p className={styles.overlaySub}>Trying to reconnect to your game</p>
        <div className={styles.elapsed}>{elapsed}s</div>
        <p className={styles.overlaySub2}>Your game is being held — just come back!</p>
        <button className={styles.giveUpBtn} onClick={onGiveUp}>Leave Game</button>
      </div>
    </div>
  )
}

// Shows when PARTNER drops — online player decides what to do
export function PartnerDisconnectBanner({ playerName, visible, onCancel, onKeepWaiting }) {
  const [elapsed, setElapsed] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!visible) { setElapsed(0); setDismissed(false); return }
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [visible])

  if (!visible || dismissed) return null

  function handleKeepWaiting() {
    setDismissed(true)
    onKeepWaiting?.()
  }

  return (
    <div className={styles.banner}>
      <div className={styles.bannerLeft}>
        <span className={styles.bannerIcon}>⚠️</span>
        <div>
          <div className={styles.bannerTitle}>{playerName} lost connection</div>
          <div className={styles.bannerSub}>Waiting for them to come back... ({elapsed}s)</div>
        </div>
      </div>
      <div className={styles.bannerActions}>
        <button className={styles.keepBtn} onClick={handleKeepWaiting}>
          Keep Waiting
        </button>
        <button className={styles.cancelBtn} onClick={onCancel}>
          Cancel Game
        </button>
      </div>
    </div>
  )
}

// Shows when partner comes back
export function PartnerReconnectedBanner({ playerName, visible }) {
  if (!visible) return null
  return (
    <div className={`${styles.banner} ${styles.reconnectedBanner}`}>
      <span className={styles.bannerIcon}>🙌</span>
      <div className={styles.bannerTitle}>{playerName} reconnected!</div>
    </div>
  )
}
