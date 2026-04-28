import styles from './AppLoader.module.css'

export default function AppLoader() {
  return (
    <div className={styles.page}>
      <div className={styles.logo}>GAMERO</div>
      <div className={styles.spinner} />
    </div>
  )
}
