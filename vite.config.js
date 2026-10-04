import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // In development, forward /api/* to the local backend so the app talks to
  // "its own address" exactly like it does in production (see vercel.json).
  server: {
    proxy: {
      '/api': { target: process.env.VITE_DEV_API || 'http://localhost:5000', changeOrigin: true },
    },
  },
})
