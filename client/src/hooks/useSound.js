// Global sound system — works in all game components
import { useRef, useCallback, useMemo } from 'react'

function createAudioCtx() {
  try { return new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
}

function playTone(ctx, freq, type, dur, vol = 0.2, delay = 0) {
  if (!ctx) return
  if (window.__gameroSoundEnabled === false) return  // FIX: respect sound toggle
  try {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = type; o.frequency.value = freq
    const t = ctx.currentTime + delay
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.start(t); o.stop(t + dur)
  } catch {}
}

export function useSound() {
  const ctxRef = useRef(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = createAudioCtx()
    return ctxRef.current
  }, [])

  return useMemo(() => ({
    // UI interactions
    click:   () => playTone(getCtx(), 600, 'sine', 0.06, 0.12),
    pop:     () => playTone(getCtx(), 800, 'sine', 0.08, 0.15),
    type:    () => playTone(getCtx(), 440, 'sine', 0.04, 0.08),

    // Game feedback
    correct: () => {
      const c = getCtx()
      ;[523,659,784,1047].forEach((f,i) => playTone(c, f, 'sine', 0.2, 0.2, i*0.08))
    },
    wrong:   () => playTone(getCtx(), 180, 'sawtooth', 0.2, 0.22),
    submit:  () => playTone(getCtx(), 440, 'sine', 0.08, 0.15),
    reveal:  () => {
      const c = getCtx()
      ;[392, 494, 587].forEach((f,i) => playTone(c, f, 'sine', 0.15, 0.18, i*0.1))
    },

    // Win / Lose
    win: () => {
      const c = getCtx()
      const melody = [523,659,784,1047,1319]
      melody.forEach((f,i) => playTone(c, f, 'sine', 0.3, 0.25, i*0.1))
    },
    lose: () => {
      const c = getCtx()
      ;[300, 250, 200].forEach((f,i) => playTone(c, f, 'sawtooth', 0.25, 0.2, i*0.12))
    },

    // Social
    join:   () => { const c=getCtx(); ;[440,550].forEach((f,i)=>playTone(c,f,'sine',0.15,0.18,i*0.1)) },
    taunt:  () => playTone(getCtx(), 880, 'sine', 0.08, 0.18),
    tick:   () => playTone(getCtx(), 1000, 'square', 0.03, 0.06),
    urgent: () => { const c=getCtx(); ;[880,880].forEach((f,i)=>playTone(c,f,'square',0.06,0.09,i*0.15)) },
  }), [getCtx])
}

// Haptic feedback — works on mobile
export function haptic(pattern = [30]) {
  try { navigator.vibrate?.(pattern) } catch {}
}

export const Haptics = {
  light:   () => haptic([15]),
  medium:  () => haptic([30]),
  heavy:   () => haptic([60]),
  success: () => haptic([30, 50, 30]),
  error:   () => haptic([80, 40, 80]),
  win:     () => haptic([50, 30, 50, 30, 100]),
}
