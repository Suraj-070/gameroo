import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Auth.module.css'

export default function Auth() {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const [tab, setTab] = useState('login') // 'login' | 'register'

  // Login state
  const [loginData, setLoginData] = useState({ email: '', password: '' })

  // Register state
  const [regData, setRegData] = useState({ username: '', email: '', password: '', confirm: '' })

  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [showPass, setShowPass]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (!loginData.email || !loginData.password) return setError('Fill in all fields')
    setLoading(true)
    setError('')
    try {
      await login(loginData)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    const { username, email, password, confirm } = regData
    if (!username || !email || !password || !confirm) return setError('Fill in all fields')
    if (password !== confirm) return setError('Passwords do not match')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    setError('')
    try {
      await register({ username, email, password })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  function switchTab(t) {
    setTab(t)
    setError('')
  }

  return (
    <div className={styles.page}>
      <div className={styles.dotGrid} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.center}>
        {/* Logo */}
        <Link to="/" className={styles.logoLink}>
          <span className={styles.logo}>GAMERO</span>
        </Link>

        <div className={styles.card}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'login' ? styles.activeTab : ''}`}
              onClick={() => switchTab('login')}
            >
              Log In
            </button>
            <button
              className={`${styles.tab} ${tab === 'register' ? styles.activeTab : ''}`}
              onClick={() => switchTab('register')}
            >
              Register
            </button>
          </div>

          {/* Login form */}
          {tab === 'login' && (
            <form className={styles.form} onSubmit={handleLogin} key="login">
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="you@example.com"
                  value={loginData.email}
                  onChange={e => setLoginData(d => ({ ...d, email: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Password</label>
                <div className={styles.passWrap}>
                  <input
                    className={styles.input}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={e => setLoginData(d => ({ ...d, password: e.target.value }))}
                    style={{ paddingRight:'2.5rem' }}
                  />
                  <button type="button" className={styles.passToggle} onClick={() => setShowPass(s => !s)} tabIndex={-1}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button className={styles.btnPrimary} type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Log In →'}
              </button>

              <p className={styles.switchHint}>
                No account?{' '}
                <button type="button" className={styles.switchLink} onClick={() => switchTab('register')}>
                  Register here
                </button>
              </p>
            </form>
          )}

          {/* Register form */}
          {tab === 'register' && (
            <form className={styles.form} onSubmit={handleRegister} key="register">
              <div className={styles.field}>
                <label className={styles.label}>Username</label>
                <input
                  className={styles.input}
                  placeholder="YourGamertag"
                  value={regData.username}
                  onChange={e => setRegData(d => ({ ...d, username: e.target.value }))}
                  maxLength={20}
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="you@example.com"
                  value={regData.email}
                  onChange={e => setRegData(d => ({ ...d, email: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Password</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Min. 6 characters"
                  value={regData.password}
                  onChange={e => setRegData(d => ({ ...d, password: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm Password</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="Repeat password"
                  value={regData.confirm}
                  onChange={e => setRegData(d => ({ ...d, confirm: e.target.value }))}
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button className={styles.btnPrimary} type="submit" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account →'}
              </button>

              <p className={styles.switchHint}>
                Already have an account?{' '}
                <button type="button" className={styles.switchLink} onClick={() => switchTab('login')}>
                  Log in
                </button>
              </p>
            </form>
          )}
        </div>

        {/* Guest bypass */}
        <div className={styles.guestWrap}>
          <span className={styles.orDivider}>or</span>
          <Link to="/?guest=1" className={styles.guestLink}>
            Continue as Guest — no account needed
          </Link>
        </div>
      </div>
    </div>
  )
}
