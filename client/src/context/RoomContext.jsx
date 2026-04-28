import { createContext, useContext, useReducer } from 'react'

const RoomContext = createContext(null)

const initialState = {
  roomCode: null,
  players: [],
  isHost: false,
  playerName: '',
  currentGame: null,
  gameState: null,
  scores: {},
  phase: 'lobby', // lobby | playing | results
}

function roomReducer(state, action) {
  switch (action.type) {
    case 'JOIN_ROOM':
      return { ...state, roomCode: action.roomCode, playerName: action.playerName, isHost: action.isHost }
    case 'SET_PLAYERS': {
      // FIX: re-derive isHost from updated players list (handles host transfer)
      const me = action.players.find(p => p.name === state.playerName)
      return { ...state, players: action.players, isHost: me?.isHost || state.isHost }
    }
    case 'SET_GAME':
      return { ...state, currentGame: action.game }
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.gameState }
    case 'SET_SCORES':
      return { ...state, scores: action.scores }
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'RESET_GAME':
      return { ...state, currentGame: null, gameState: null, scores: {}, phase: 'lobby' }
    case 'LEAVE_ROOM':
      return initialState
    default:
      return state
  }
}

export function RoomProvider({ children }) {
  const [room, dispatch] = useReducer(roomReducer, initialState)
  return (
    <RoomContext.Provider value={{ room, dispatch }}>
      {children}
    </RoomContext.Provider>
  )
}

export function useRoom() {
  return useContext(RoomContext)
}
