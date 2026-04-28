import { useNavigate } from 'react-router-dom'
import styles from './NotFound.module.css'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className={styles.page}>
      <div className={styles.meshBg} />
      <div className={styles.center}>
        <div className={styles.glitch} data-text="404">404</div>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.sub}>This room doesn't exist or has already ended.</p>
        <div className={styles.games}>
          {['🎯','🧠','📝','🔢','🤥','🔤'].map((e,i)=>(
            <span key={i} className={styles.gameIcon} style={{ animationDelay:`${i*0.15}s` }}>{e}</span>
          ))}
        </div>
        <button className={styles.btn} onClick={() => navigate('/')}>
          Back to Home →
        </button>
      </div>
    </div>
  )
}
