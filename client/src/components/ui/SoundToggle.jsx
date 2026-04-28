import { useState, useEffect } from 'react'
import styles from './SoundToggle.module.css'

const KEY = 'gamero_sound'

export function getSoundEnabled() {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

export default function SoundToggle() {
  const [on, setOn] = useState(getSoundEnabled)

  useEffect(() => {
    try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch {}
    // Patch Audio prototype so all sounds respect this toggle
    window.__gameroSoundEnabled = on
  }, [on])

  return (
    <button
      className={styles.btn}
      onClick={() => setOn(v => !v)}
      title={on ? 'Mute sounds' : 'Unmute sounds'}
      aria-label={on ? 'Mute sounds' : 'Unmute sounds'}
    >
      {on ? '🔊' : '🔇'}
    </button>
  )
}
