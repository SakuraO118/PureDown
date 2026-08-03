import { v4 as uuid } from 'uuid'
import type { DownloadTask, DownloadProgress } from '@sakuradown/shared'
import { download, type ProgressCallback } from './ytdlp.js'

const MAX_CONCURRENT = 2

class DownloadManager {
  private tasks = new Map<string, DownloadTask>()
  private queue: string[] = []
  private active = 0
  private outputDir = process.env.DOWNLOAD_DIR || `${process.env.HOME || '/tmp'}/Downloads/SakuraDown`

  // Called when progress updates; set by the WebSocket handler
  onProgress?: (taskId: string, progress: DownloadProgress) => void
  onComplete?: (taskId: string, filePath: string, filename: string) => void
  onError?: (taskId: string, error: string) => void

  setOutputDir(dir: string) {
    this.outputDir = dir
  }

  getOutputDir(): string {
    return this.outputDir
  }

  createTask(url: string, title: string, formatId: string, formatNote: string): DownloadTask {
    const task: DownloadTask = {
      id: uuid(),
      url,
      title,
      formatId,
      formatNote,
      status: 'pending',
      progress: null,
      outputPath: this.outputDir,
      createdAt: Date.now(),
    }
    this.tasks.set(task.id, task)
    this.queue.push(task.id)
    this.tryProcess()
    return task
  }

  getTask(id: string): DownloadTask | undefined {
    return this.tasks.get(id)
  }

  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  private tryProcess() {
    while (this.active < MAX_CONCURRENT && this.queue.length > 0) {
      const taskId = this.queue.shift()!
      this.active++
      this.downloadTask(taskId)
    }
  }

  private async downloadTask(taskId: string) {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.status = 'downloading'
    this.updateTask(task)

    const onProgress: ProgressCallback = (p) => {
      task.progress = { taskId, status: 'downloading', ...p }
      this.updateTask(task)
      this.onProgress?.(taskId, task.progress!)
    }

    try {
      const result = await download(task.url, task.formatId, this.outputDir, onProgress)
      task.status = 'completed'
      task.progress = { ...task.progress!, percent: 100, status: 'completed' }
      this.updateTask(task)
      this.onComplete?.(taskId, result.filePath, result.filename)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      task.status = 'failed'
      task.error = msg
      this.updateTask(task)
      this.onError?.(taskId, msg)
    } finally {
      this.active--
      this.tryProcess()
    }
  }

  private updateTask(task: DownloadTask) {
    this.tasks.set(task.id, { ...task })
  }
}

export const downloadManager = new DownloadManager()
