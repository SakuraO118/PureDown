import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { writeFileSync } from 'fs'

/**
 * Dev-only middleware that lets the in-app Visual Editor persist style
 * overrides to a real CSS file (src/dev-overrides.css). Vite HMR then
 * applies the change, so "drag on page" becomes "real code change".
 */
function visualEditorOverrides(): Plugin {
  return {
    name: 'puredown-visual-editor-overrides',
    configureServer(server) {
      server.middlewares.use('/__dev/overrides', (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          try {
            const { css } = JSON.parse(body)
            const file = resolve(__dirname, 'src', 'dev-overrides.css')
            writeFileSync(file, typeof css === 'string' ? css : '')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), react(), visualEditorOverrides()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
})
