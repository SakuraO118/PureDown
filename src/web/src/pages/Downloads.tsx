import { useDownloads } from '@/hooks/useDownloads'
import { useDownload } from '@/hooks/useDownload'
import { DownloadCloud, FolderOpen, Film, Loader2, Check, AlertCircle, Clock, Download } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ProgressBar } from '@/components/ProgressBar'
import { api } from '@/lib/api'
import type { DownloadTask } from '@sakuradown/shared'

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const statusConfig = {
  downloading: { icon: Loader2, label: '下载中', iconClass: 'animate-spin text-caramel-500' },
  pending: { icon: Clock, label: '等待中', iconClass: 'text-warm-400' },
  completed: { icon: Check, label: '已完成', iconClass: 'text-warm-400' },
  failed: { icon: AlertCircle, label: '失败', iconClass: 'text-red-400' },
} as const

function groupByStatus(tasks: DownloadTask[]) {
  const order: DownloadTask['status'][] = ['downloading', 'pending', 'completed', 'failed']
  return order
    .map(status => ({ status, tasks: tasks.filter(t => t.status === status) }))
    .filter(g => g.tasks.length > 0)
}

export default function Downloads() {
  const { data: tasks, isLoading } = useDownloads()
  const { activeProgress } = useDownload()

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-lg font-medium text-warm-800 mb-6">下载管理</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-md border border-warm-200 p-4 animate-pulse">
              <div className="h-4 bg-warm-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-warm-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-lg font-medium text-warm-800 mb-6">下载管理</h2>
        <EmptyState
          icon={DownloadCloud}
          title="暂无下载任务"
          description="解析视频并选择格式后，下载任务将出现在这里"
        />
      </div>
    )
  }

  const groups = groupByStatus(tasks)

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-warm-800">下载管理</h2>
        {tasks.some(t => t.status === 'completed') && (
          <span className="text-xs text-warm-400">
            {tasks.filter(t => t.status === 'completed').length} 个已完成
          </span>
        )}
      </div>

      <div className="space-y-5">
        {groups.map(({ status, tasks: groupTasks }) => {
          const cfg = statusConfig[status]
          const Icon = cfg.icon
          return (
            <section key={status}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={cfg.iconClass} />
                <span className="text-xs font-medium text-warm-500 uppercase tracking-wide">
                  {cfg.label}
                  <span className="text-warm-400 font-normal ml-1">({groupTasks.length})</span>
                </span>
              </div>

              <div className="space-y-2">
                {groupTasks.map((task) => {
                  const progress = activeProgress.get(task.id) || task.progress
                  return (
                    <div
                      key={task.id}
                      className="bg-white rounded-md border border-warm-200 shadow-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <div className="flex items-center gap-2">
                            <Film size={14} className="text-warm-400 shrink-0" />
                            <p className="font-medium text-sm text-warm-700 truncate">
                              {task.title || '未知视频'}
                            </p>
                          </div>

                          {/* Format & status */}
                          <p className="text-xs text-warm-500 mt-1 ml-6">
                            {task.formatNote || '—'}
                            {task.status === 'completed' && task.outputPath && (
                              <span className="text-warm-400"> · 已保存</span>
                            )}
                          </p>

                          {/* Error */}
                          {task.error && (
                            <p className="text-xs text-red-500 mt-1 ml-6">{task.error}</p>
                          )}
                        </div>

                        {/* Actions */}
                        {task.status === 'completed' && task.outputPath && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {/* Download button (always available) */}
                            {task.filename && (
                              <a
                                href={api.getDownloadUrl(task.filename)}
                                download
                                className="shrink-0 p-1.5 text-caramel-500 hover:text-caramel-600 transition-colors rounded hover:bg-warm-100"
                                title="下载文件"
                              >
                                <Download size={15} />
                              </a>
                            )}
                            {/* Open folder (localhost only) */}
                            {isLocalhost && (
                              <button
                                onClick={() => window.open(`file://${task.outputPath}`, '_blank')}
                                className="shrink-0 p-1.5 text-warm-400 hover:text-warm-600 transition-colors rounded hover:bg-warm-100"
                                title="打开文件夹"
                              >
                                <FolderOpen size={15} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Progress bar for downloading tasks */}
                      {progress && task.status === 'downloading' && (
                        <div className="mt-3 ml-6">
                          <ProgressBar percent={progress.percent} />
                          <div className="flex gap-4 mt-1 text-xs font-mono text-warm-500">
                            <span>{progress.speed || '—'}</span>
                            <span>ETA {progress.eta || '—'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
