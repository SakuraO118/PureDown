import type { WsMessage } from '@sakuradown/shared'

export function connectProgress(
  taskId: string,
  onMessage: (msg: WsMessage) => void
): () => void {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${protocol}//${location.host}/ws/progress/${taskId}`)

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as WsMessage
      onMessage(msg)
    } catch { /* ignore malformed messages */ }
  }

  ws.onerror = () => { /* silently retry/reconnect could be added here */ }

  return () => ws.close()
}
