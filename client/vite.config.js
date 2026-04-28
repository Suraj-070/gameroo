import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:5000' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          socket:  ['socket.io-client'],
          games:   [
            './src/components/game/WordWordle',
            './src/components/game/NumberWordle',
            './src/components/game/NumberGuessing',
            './src/components/game/TriviaBlitz',
            './src/components/game/WordDuel',
            './src/components/game/BluffClub',
          ],
        }
      }
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false,
  }
})
