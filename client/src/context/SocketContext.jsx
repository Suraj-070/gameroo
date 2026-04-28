import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const SocketContext = createContext(null)
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'

export function SocketProvider({ children }) {
  const [socket, setSocket]       = useState(null)
  const [connected, setConnected] = useState(false)
  const [wasConnected, setWasConnected] = useState(false)
  const [wasDisconnected, setWasDisconnected] = useState(false)

  useEffect(() => {
    const s = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,  // keep trying forever
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    s.on('connect',    () => { setConnected(true); setWasConnected(true) })
    s.on('disconnect', () => { setConnected(false); setWasDisconnected(true) })

    setSocket(s)
    return () => s.disconnect()
  }, [])

  return (
    <SocketContext.Provider value={{ socket, connected, wasConnected, wasDisconnected, setWasDisconnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
