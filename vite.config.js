import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// CAP_BUILD=1 → Capacitor 네이티브 빌드 (상대 경로), 기본은 GitHub Pages 경로
export default defineConfig({
  base: process.env.CAP_BUILD ? './' : '/personal-fitness-app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'WORK OUT!',
        short_name: 'WORK OUT!',
        description: 'Personal Training & Running App',
        theme_color: '#0f1117',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
