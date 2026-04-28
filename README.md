# Gamero v2.0

Multiplayer game platform for friends. Private rooms, real-time gameplay, no account needed.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite → Vercel |
| Backend | Node + Express + Socket.IO → Render |
| Realtime | Socket.IO (WebSockets) |
| State | In-memory (rooms) |

## Games

- **Word Duel** — guess the hidden word from a hint
- **Trivia Blitz** — speed-based multiple choice trivia
- **Bluff Club** — two truths, one lie voting game

## Local Setup

### 1. Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Server runs on `http://localhost:5000`

### 2. Client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`

## Project Structure

```
gamero/
├── client/
│   ├── src/
│   │   ├── pages/          # Landing, Lobby, Game, Results, NotFound
│   │   ├── components/
│   │   │   └── game/       # WordDuel, TriviaBlitz, BluffClub, GameShell
│   │   ├── context/        # SocketContext, RoomContext
│   │   └── styles/         # globals.css
│   └── vite.config.js
└── server/
    ├── index.js            # Express + Socket.IO entry
    ├── socket/
    │   └── handlers.js     # All socket event handlers
    ├── rooms/
    │   └── roomManager.js  # In-memory room state
    └── games/
        ├── wordDuel.js
        ├── triviaBlitz.js
        └── bluffClub.js
```

## Adding a New Game

1. Create `server/games/yourGame.js` with `start` and `handleAction` exports
2. Register it in `server/socket/handlers.js` under `game:start` and `game:action`
3. Create `client/src/components/game/YourGame.jsx` using `<GameShell>` wrapper
4. Add it to the `GAME_MAP` in `client/src/pages/Game.jsx`
5. Add the card to the `GAMES` array in `client/src/pages/Lobby.jsx`

## Deploy

### Render (server)
- Root directory: `server`
- Build: `npm install`
- Start: `npm start`
- Env vars: `CLIENT_URL`, `NODE_ENV=production`, `PORT`

### Vercel (client)
- Root directory: `client`
- Build: `npm run build`
- Output: `dist`
- Env vars: `VITE_SERVER_URL`
