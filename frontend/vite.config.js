import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Output straight into server/public, which server.js already serves
    // via express.static — same single-service Railway deployment, no
    // new hosting/CORS setup needed. emptyOutDir clears server/public
    // first, replacing the old vanilla-JS files with this build.
    outDir: resolve(__dirname, '../server/public'),
    emptyOutDir: true
  }
})
