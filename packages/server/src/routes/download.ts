import type { FastifyInstance } from 'fastify'
import type { DownloadRequest, DownloadResponse } from '@sakuradown/shared'
import { downloadManager } from '../services/download-manager.js'
import { parseVideo } from '../services/ytdlp.js'

export async function downloadRoutes(app: FastifyInstance) {
  app.post<{ Body: DownloadRequest }>('/api/download', async (req, reply) => {
    const { url, formatId } = req.body

    if (!url || !formatId) {
      return reply.status(400).send({ error: 'url and formatId are required' })
    }

    try {
      // Parse video info first to get the title
      const video = await parseVideo(url)
      const format = video.formats.find(f => f.id === formatId)

      const task = downloadManager.createTask(
        url,
        video.title,
        formatId,
        format?.note || formatId
      )

      return reply.send({ taskId: task.id } satisfies DownloadResponse)
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
