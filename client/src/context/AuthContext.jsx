import { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

const API = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'

const initialState = {
  user: null,
  access: null,
  refresh: null,
  loading: true, // true on mount while we check localStorage
}

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.user, access: action.access, refresh: action.refresh, loading: false }
    case 'CLEAR':
      return { ...initialState, loading: false }
    case 'DONE_LOADING':
      return { ...state, loading: false }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [auth, dispatch] = useReducer(authReducer, initialState)

  // On mount — restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('gamero_auth')
    if (!stored) return dispatch({ type: 'DONE_LOADING' })

    try {
      const { user, access, refresh } = JSON.parse(stored)
      if (user && access && refresh) {
        dispatch({ type: 'SET_USER', user, access, refresh })
      } else {
        dispatch({ type: 'DONE_LOADING' })
      }
    } catch {
      localStorage.removeItem('gamero_auth')
      dispatch({ type: 'DONE_LOADING' })
    }
  }, [])

  // Persist to localStorage whenever auth changes
  useEffect(() => {
    if (auth.loading) return
    if (auth.user) {
      localStorage.setItem('gamero_auth', JSON.stringify({
        user: auth.user, access: auth.access, refresh: auth.refresh
      }))
    } else {
      localStorage.removeItem('gamero_auth')
    }
  }, [auth.user, auth.access, auth.refresh, auth.loading])

  // Register
  const register = useCallback(async ({ username, email, password }) => {
    const res = await axios.post(`${API}/api/auth/register`, { username, email, password })
    dispatch({ type: 'SET_USER', user: res.data.user, access: res.data.access, refresh: res.data.refresh })
    return res.data
  }, [])

  // Login
  const login = useCallback(async ({ email, password }) => {
    const res = await axios.post(`${API}/api/auth/login`, { email, password })
    dispatch({ type: 'SET_USER', user: res.data.user, access: res.data.access, refresh: res.data.refresh })
    return res.data
  }, [])

  // Logout
  const logout = useCallback(() => {
    dispatch({ type: 'CLEAR' })
  }, [])

  // Refresh access token
  const refreshToken = useCallback(async () => {
    if (!auth.refresh) return null
    try {
      const res = await axios.post(`${API}/api/auth/refresh`, { refresh: auth.refresh })
      dispatch({ type: 'SET_USER', user: auth.user, access: res.data.access, refresh: res.data.refresh })
      return res.data.access
    } catch {
      dispatch({ type: 'CLEAR' })
      return null
    }
  }, [auth.refresh, auth.user])

  // Axios instance with auto token refresh
  const authAxios = useCallback(() => {
    const instance = axios.create({ baseURL: API })
    instance.interceptors.request.use((config) => {
      if (auth.access) config.headers.Authorization = `Bearer ${auth.access}`
      return config
    })
    instance.interceptors.response.use(
      r => r,
      async (error) => {
        if (error.response?.status === 401 && auth.refresh) {
          const newAccess = await refreshToken()
          if (newAccess) {
            error.config.headers.Authorization = `Bearer ${newAccess}`
            return axios(error.config)
          }
        }
        return Promise.reject(error)
      }
    )
    return instance
  }, [auth.access, auth.refresh, refreshToken])

  return (
    <AuthContext.Provider value={{ auth, register, login, logout, authAxios }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
