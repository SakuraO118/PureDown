import type { FastifyInstance } from 'fastify'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { downloadManager } from '../services/download-manager.js'

export async function filesRoutes(app: FastifyInstance) {
  app.get('/api/files', async (_req, reply) => {
    const dir = downloadManager.getOutputDir()
    try {
      const entries = await readdir(dir)
      const files = await Promise.all(
        entries.map(async (name) => {
          const fullPath = join(dir, name)
          try {
            const s = await stat(fullPath)
            return {
              name,
              path: fullPath,
              size: s.size,
              modifiedAt: s.mtimeMs,
            }
          } catch {
            return null
          }
        })
      )
      return reply.send(files.filter(Boolean).sort((a, b) => (b?.modifiedAt || 0) - (a?.modifiedAt || 0)))
    } catch {
      return reply.send([])
    }
  })

  app.get('/api/settings', async (_req, reply) => {
    return reply.send({
      downloadDir: downloadManager.getOutputDir(),
    })
  })

  app.post('/api/settings', async (req, reply) => {
    const { downloadDir } = req.body as { downloadDir?: string }
    if (downloadDir) {
      downloadManager.setOutputDir(downloadDir)
    }
    return reply.send({
      downloadDir: downloadManager.getOutputDir(),
    })
  })
}
