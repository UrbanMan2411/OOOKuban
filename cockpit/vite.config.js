import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      // Two entries: the password-gated dashboard (index.html) and the public
      // Telegram storefront (shop.html). They share /api and the Blob store.
      input: {
        main: resolve(__dirname, 'index.html'),
        shop: resolve(__dirname, 'shop.html'),
      },
      output: {
        manualChunks: {
          pdf: ['pdf-lib', '@pdf-lib/fontkit'],
          xlsx: ['xlsx', 'jszip'],
          dnd: ['@hello-pangea/dnd'],
          router: ['react-router-dom'],
        },
      },
    },
  },
})
