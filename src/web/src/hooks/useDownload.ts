import { useState, useEffect, useCallback } from 'react'
import type { DownloadProgress } from '@puredown/shared'
import { api } from '@/lib/api'
import { connectProgress } from '@/lib/ws'

export function useDownload() {
  const [activeProgress, setActiveProgress] = useState<Map<string, DownloadProgress>>(new Map())

  const startDownload = useCallback(async (url: string, formatId: string) => {
    const { taskId } = await api.download(url, formatId)
    return taskId
  }, [])

  const trackProgress = useCallback((taskId: string) => {
    const cleanup = connectProgress(taskId, (msg) => {
      setActiveProgress((prev) => {
        const next = new Map(prev)
        if (msg.type === 'progress') {
          next.set(taskId, msg.data)
        } else if (msg.type === 'complete') {
          next.set(taskId, {
            taskId,
            status: 'completed',
            percent: 100,
            speed: '',
            eta: '',
            downloaded: '',
            totalSize: '',
          })
        } else if (msg.type === 'error') {
          next.delete(taskId)
        }
        return next
      })
    })
    return cleanup
  }, [])

  return { activeProgress, startDownload, trackProgress }
}
