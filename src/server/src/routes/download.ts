import type { FastifyInstance } from 'fastify'
import type { DownloadRequest, DownloadResponse } from '@puredown/shared'
import { downloadManager } from '../services/download-manager.js'
import { parseVideo, downloadStream } from '../services/ytdlp.js'

export async function downloadRoutes(app: FastifyInstance) {
  // Server-side download (existing, with progress via WebSocket)
  app.post<{ Body: DownloadRequest }>('/api/download', async (req, reply) => {
    const { url, formatId } = req.body

    if (!url || !formatId) {
      return reply.status(400).send({ error: 'url and formatId are required' })
    }

    try {
      // Parse video info first to get the title
      const video = await parseVideo(url)

      const task = downloadManager.createTask(
        url,
        video.title,
        formatId,
        video.formats.find(f => f.id === formatId)?.note || formatId
      )

      return reply.send({ taskId: task.id } satisfies DownloadResponse)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start download'
      return reply.status(400).send({ error: msg })
    }
  })

  // Direct streaming download: yt-dlp stdout → browser (no server storage)
  app.get('/api/download/stream', async (req, reply) => {
    const { url, formatId } = req.query as { url?: string; formatId?: string }

    if (!url || !formatId) {
      return reply.status(400).send({ error: 'url and formatId are required' })
    }

    try {
      // Parse first to get the title for filename
      const video = await parseVideo(url)
      const ext = video.formats.find(f => f.id === formatId)?.ext || 'mp4'
      const safeTitle = video.title.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 100)
      const filename = `${safeTitle}.${ext}`

      const { proc } = downloadStream(url, formatId)

      reply.raw.on('close', () => {
        proc.kill('SIGTERM')  // stop yt-dlp if browser disconnects
      })

      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      reply.header('Content-Type', 'application/octet-stream')

      // Handle yt-dlp errors from stderr
      let stderr = ''
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
      proc.on('close', (code) => {
        if (code !== 0 && !reply.raw.headersSent) {
          reply.raw.statusCode = 500
        }
      })

      return reply.send(proc.stdout)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start download'
      return reply.status(400).send({ error: msg })
    }
  })

  app.get('/api/download/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const task = downloadManager.getTask(id)

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' })
    }

    return reply.send(task)
  })

  app.get('/api/downloads', async (_req, reply) => {
    return reply.send(downloadManager.getAllTasks())
  })
}
