import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// En Docker, VITE_PROXY_TARGET = http://app:3002 (nombre del servicio interno)
// En local,  VITE_PROXY_TARGET no se define → usa localhost:3002
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3002'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    host: '0.0.0.0', // Necesario para ser accesible desde fuera del contenedor Docker
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      }
    }
  }
})
