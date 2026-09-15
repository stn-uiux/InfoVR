import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { publicAssetsPlugin } from './vite-plugin-materials'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), publicAssetsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './arcVRoom/src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        arcVRoom: path.resolve(__dirname, 'arcVRoom/index.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
          vendor: ['react', 'react-dom', 'zustand'],
        }
      }
    }
  }
})
