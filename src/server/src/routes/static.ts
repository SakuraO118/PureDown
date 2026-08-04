import type { FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import { resolve } from 'path'
import { existsSync } from 'fs'

const DIST_DIR = resolve(import.meta.dirname, '../../web/dist')

export async function staticRoutes(app: FastifyInstance) {
  // Only serve static files in production (when dist/ exists)
  if (!existsSync(DIST_DIR)) {
    app.log.info('No dist/ found, skipping static file serving (dev mode)')
    return
  }

  await app.register(fastifyStatic, {
    root: DIST_DIR,
    prefix: '/',
    wildcard: false,
  })

  // SPA fallback: serve index.html for all non-API, non-WS routes
  app.setNotFoundHandler((req, reply) => {
    const isApiOrWs = /^\/(api|ws)(\/|$)/.test(req.url)
    if (isApiOrWs) return reply.code(404).send({ error: 'Not found' })
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return reply.code(404).send({ error: 'Not found' })
    }
    return reply.type('text/html').sendFile('index.html')
  })

  app.log.info(`Serving static files from ${DIST_DIR}`)
}
