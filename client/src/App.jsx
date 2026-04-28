import { Routes, Route, Navigate } from 'react-router-dom'
import { SocketProvider } from './context/SocketContext'
import { RoomProvider } from './context/RoomContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import AppLoader from './components/ui/AppLoader'
import ScrollToTop from './components/ui/ScrollToTop'
import AutoRejoin from './components/ui/AutoRejoin'

import Landing  from './pages/Landing'
import Auth     from './pages/Auth'
import Profile  from './pages/Profile'
import Lobby    from './pages/Lobby'
import Game     from './pages/Game'
import Results  from './pages/Results'
import NotFound from './pages/NotFound'

function AppRoutes() {
  const { auth } = useAuth()

  // Show loading skeleton while auth resolves (prevents flash)
  if (auth.loading) return <AppLoader />

  return (
    <>
      <ScrollToTop />
      <AutoRejoin />
      <Routes>
        <Route path="/"                    element={<Landing />} />
        <Route path="/auth"                element={<Auth />} />
        <Route path="/profile"             element={<Profile />} />
        <Route path="/room/:code"          element={<Lobby />} />
        <Route path="/room/:code/game"     element={<Game />} />
        <Route path="/room/:code/results"  element={<Results />} />
        <Route path="/404"                 element={<NotFound />} />
        <Route path="*"                    element={<Navigate to="/404" />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <RoomProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </RoomProvider>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
