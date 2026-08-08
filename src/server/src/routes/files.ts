import type { FastifyInstance } from 'fastify'
import { readdir, stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { join } from 'path'
import { get as httpsGet } from 'https'
import { get as httpGet } from 'http'
import { downloadManager } from '../services/download-manager.js'

export async function filesRoutes(app: FastifyInstance) {
  // Proxy external images (bypass referrer/防盗链 check)
  app.get('/api/proxy-image', async (req, reply) => {
    const { url } = req.query as { url?: string }
    if (!url) return reply.status(400).send({ error: 'url required' })

    try {
      const parsed = new URL(url)
      const isBilibili = /hdslb\.com|bilibili\.com/i.test(parsed.hostname)
      const referer = isBilibili ? 'https://www.bilibili.com/' : parsed.origin
      const get = parsed.protocol === 'https:' ? httpsGet : httpGet
      const data = await new Promise<Buffer>((resolve, reject) => {
        get(url, { headers: { Referer: referer, 'User-Agent': 'Mozilla/5.0' } }, (res: any) => {
          if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`))
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
        }).on('error', reject)
      })
      const ext = parsed.pathname.split('.').pop()?.toLowerCase() || 'jpg'
      const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
      reply.header('Content-Type', mimeMap[ext] || 'image/jpeg')
      reply.header('Cache-Control', 'public, max-age=86400')
      return reply.send(data)
    } catch (err) {
      return reply.status(404).send({ error: 'Image not found' })
    }
  })
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

  // File download endpoint for remote deployment
  app.get('/api/files/:name/download', async (req, reply) => {
    const { name } = req.params as { name: string }
    const baseDir = downloadManager.getOutputDir()
    const filePath = join(baseDir, name)

    // Path traversal protection
    if (!filePath.startsWith(baseDir)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    try {
      const s = await stat(filePath)
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`)
      reply.header('Content-Length', s.size)
      reply.header('Content-Type', 'application/octet-stream')
      return reply.send(createReadStream(filePath))
    } catch {
      return reply.status(404).send({ error: 'File not found' })
    }
  })
}
