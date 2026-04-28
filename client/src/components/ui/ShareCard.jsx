import { useState } from 'react'
import styles from './ShareCard.module.css'

// Generates shareable text result like Wordle's grid share
export default function ShareCard({ game, winner, myName, scores, extras = {} }) {
  const [copied, setCopied] = useState(false)
  const iWon    = winner === myName
  const sorted  = Object.entries(scores || {}).sort((a,b) => b[1]-a[1])
  const medals  = ['🥇','🥈','🥉']

  const gameEmoji = {
    'word-wordle':     '📝',
    'number-wordle':   '🔢',
    'number-guessing': '🎯',
    'trivia-blitz':    '🧠',
    'word-duel':       '🔤',
    'bluff-club':      '🤥',
  }[game] || '🎮'

  function buildShareText() {
    const lines = [
      `${gameEmoji} GAMERO — ${game?.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ')}`,
      iWon ? '🏆 I won!' : `${winner} won!`,
      '',
      ...sorted.map(([name, score], i) => `${medals[i]||`#${i+1}`} ${name}: ${score} pts`),
    ]
    if (extras.word)       lines.push(``, `The word was: ${extras.word}`)
    if (extras.guessCount) lines.push(`Solved in ${extras.guessCount} guess${extras.guessCount!==1?'es':''}`)
    lines.push('', 'Play at gamero.vercel.app')
    return lines.join('\n')
  }

  function share() {
    const text = buildShareText()
    if (navigator.share) {
      navigator.share({ title: 'Gamero Result', text }).catch(() => copyText(text))
    } else {
      copyText(text)
    }
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <button className={`${styles.btn} ${copied ? styles.copied : ''}`} onClick={share}>
      {copied ? '✅ Copied!' : '📤 Share Result'}
    </button>
  )
}
