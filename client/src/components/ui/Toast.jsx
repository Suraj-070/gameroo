import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import styles from './Toast.module.css'

const ToastContext = createContext(null)
let _nextId = 1

function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD':    return [...state, action.toast]
    case 'REMOVE': return state.filter(t => t.id !== action.id)
    default:       return state
  }
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])

  const add = useCallback((message, type = 'info', duration = 3000) => {
    const id = _nextId++
    dispatch({ type: 'ADD', toast: { id, message, kind: type, duration } })
    if (duration > 0) setTimeout(() => dispatch({ type: 'REMOVE', id }), duration)
    return id
  }, [])

  const remove = useCallback((id) => dispatch({ type: 'REMOVE', id }), [])

  const toast = {
    success: (msg, dur) => add(msg, 'success', dur ?? 3000),
    error:   (msg, dur) => add(msg, 'error',   dur ?? 4000),
    warning: (msg, dur) => add(msg, 'warning', dur ?? 3500),
    info:    (msg, dur) => add(msg, 'info',    dur ?? 3000),
    remove,
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  success: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="9" fill="#10B981" fillOpacity=".15"/><path d="M5 9l3 3 5-5" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  error:   <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="9" fill="#EF4444" fillOpacity=".15"/><path d="M6 6l6 6M12 6l-6 6" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/></svg>,
  warning: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="9" fill="#F59E0B" fillOpacity=".15"/><path d="M9 5v5M9 12.5v.5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/></svg>,
  info:    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="9" fill="#6C63FF" fillOpacity=".15"/><path d="M9 8v5M9 5.5v.5" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round"/></svg>,
}

function ToastItem({ toast, onRemove }) {
  const barRef = useRef(null)

  useEffect(() => {
    if (!barRef.current || toast.duration <= 0) return
    barRef.current.style.transition = `width ${toast.duration}ms linear`
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (barRef.current) barRef.current.style.width = '0%'
    }))
  }, [toast.duration])

  return (
    <div className={`${styles.toast} ${styles[toast.kind]}`} role="alert">
      <span className={styles.icon}>{ICONS[toast.kind]}</span>
      <span className={styles.message}>{toast.message}</span>
      <button className={styles.close} onClick={() => onRemove(toast.id)} aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>
      {toast.duration > 0 && (
        <div className={styles.progressBar}>
          <div ref={barRef} className={`${styles.progressFill} ${styles[`fill_${toast.kind}`]}`} />
        </div>
      )}
    </div>
  )
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null
  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={onRemove} />)}
    </div>
  )
}
