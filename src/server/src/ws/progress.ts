import type { FastifyInstance } from 'fastify'
import type { WsMessage } from '@puredown/shared'
import { downloadManager } from '../services/download-manager.js'

export function setupWebSocket(app: FastifyInstance) {
  // Store connections by taskId
  const connections = new Map<string, Set<WebSocket>>()

  app.get('/ws/progress/:taskId', { websocket: true }, (socket, req) => {
    const { taskId } = req.params as { taskId: string }

    if (!connections.has(taskId)) {
      connections.set(taskId, new Set())
    }
    connections.get(taskId)!.add(socket)

    // Send current progress immediately
    const task = downloadManager.getTask(taskId)
    if (task?.progress) {
      socket.send(JSON.stringify({ type: 'progress', data: task.progress } satisfies WsMessage))
    } else if (task?.status === 'completed') {
      socket.send(JSON.stringify({
        type: 'complete',
        data: { taskId, filePath: task.outputPath, filename: task.title },
      } satisfies WsMessage))
    }

    socket.on('close', () => {
      connections.get(taskId)?.delete(socket)
      if (connections.get(taskId)?.size === 0) {
        connections.delete(taskId)
      }
    })
  })

  // Hook into download manager events
  downloadManager.onProgress = (taskId, progress) => {
    broadcast(taskId, { type: 'progress', data: progress })
  }

  downloadManager.onComplete = (taskId, filePath, filename) => {
    broadcast(taskId, { type: 'complete', data: { taskId, filePath, filename } })
  }

  downloadManager.onError = (taskId, error) => {
    broadcast(taskId, { type: 'error', data: { taskId, error } })
  }

  function broadcast(taskId: string, msg: WsMessage) {
    const sockets = connections.get(taskId)
    if (!sockets) return
    const payload = JSON.stringify(msg)
    for (const ws of sockets) {
      try { ws.send(payload) } catch { /* ignore */ }
    }
  }
}
