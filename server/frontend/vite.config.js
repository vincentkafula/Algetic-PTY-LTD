import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Output straight into server/public (frontend/ now lives inside
    // server/, so that's one level up, not two — see the git history
    // for why: frontend/ originally sat as a sibling of server/, but
    // Railway's rootDirectory=server build context never included that
    // sibling directory at all, which broke the very first deploy of
    // this integration). server/public is already what server.js
    // serves via express.static — same single-service Railway
    // deployment, no new hosting/CORS setup needed. emptyOutDir clears
    // server/public first, replacing whatever was built there before.
    outDir: resolve(__dirname, '../public'),
    emptyOutDir: true
  }
})
