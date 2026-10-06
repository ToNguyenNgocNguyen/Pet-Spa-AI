import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev: proxy /api và /media sang Django để không cần cấu hình CORS
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
    },
  },
})
