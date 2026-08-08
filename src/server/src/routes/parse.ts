import type { FastifyInstance } from 'fastify'
import type { ParseRequest, ParseResponse } from '@puredown/shared'
import { parseVideo, parsePlaylist } from '../services/ytdlp.js'

export async function parseRoutes(app: FastifyInstance) {
  app.post<{ Body: ParseRequest }>('/api/parse', async (req, reply) => {
    const { url } = req.body

    if (!url || typeof url !== 'string') {
      return reply.status(400).send({ error: 'URL is required' })
    }

    try {
      // First try as playlist (handles Bilibili collections, YouTube playlists)
      const video = await parsePlaylist(url)
      return reply.send({ video } satisfies ParseResponse)
    } catch (err) {
      // Fallback: try as single video
      try {
        const video = await parseVideo(url)
        return reply.send({ video } satisfies ParseResponse)
      } catch (err2) {
        const msg = err instanceof Error ? err.message : 'Parse failed'
        return reply.status(400).send({ error: msg })
      }
    }
  })
}
