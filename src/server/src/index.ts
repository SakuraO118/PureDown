import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { parseRoutes } from './routes/parse.js'
import { downloadRoutes } from './routes/download.js'
import { filesRoutes } from './routes/files.js'
import { bilibiliAuthRoutes } from './routes/bilibili-auth.js'
import { staticRoutes } from './routes/static.js'
import { setupWebSocket } from './ws/progress.js'

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOST = process.env.HOST || '0.0.0.0'

async function main() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })
  await app.register(websocket)

  await app.register(parseRoutes)
  await app.register(downloadRoutes)
  await app.register(filesRoutes)
  await app.register(bilibiliAuthRoutes)

  setupWebSocket(app)

  // Static file serving + SPA fallback (production only)
  await app.register(staticRoutes)

  try {
    await app.listen({ port: PORT, host: HOST })
    console.log(`Server running at http://localhost:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
