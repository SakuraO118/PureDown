import { useDownloads } from '@/hooks/useDownloads'
import { useDownload } from '@/hooks/useDownload'
import { DownloadCloud, FolderOpen } from 'lucide-react'
import { useEffect } from 'react'

export default function Downloads() {
  const { data: tasks } = useDownloads()
  const { activeProgress } = useDownload()

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-lg font-semibold mb-4">下载管理</h2>

      {(!tasks || tasks.length === 0) && (
        <div className="text-center py-20 text-neutral-600">
          <DownloadCloud size={48} className="mx-auto mb-3 opacity-30" />
          <p>暂无下载任务</p>
        </div>
      )}

      <div className="space-y-2">
        {tasks?.map((task) => {
          const progress = activeProgress.get(task.id) || task.progress
          return (
            <div
              key={task.id}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{task.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {task.formatNote} · {task.status === 'downloading' ? '下载中' :
                      task.status === 'completed' ? '已完成' :
                      task.status === 'failed' ? '失败' : '等待中'}
                  </p>
                  {task.error && (
                    <p className="text-xs text-red-400 mt-0.5">{task.error}</p>
                  )}
                </div>

                {task.status === 'completed' && (
                  <button
                    onClick={() => {
                      // Open folder in Finder
                      const dir = task.outputPath
                      window.open(`file://${dir}`, '_blank')
                    }}
                    className="shrink-0 p-1.5 text-neutral-500 hover:text-neutral-300 transition-colors"
                    title="打开文件夹"
                  >
                    <FolderOpen size={16} />
                  </button>
                )}
              </div>

              {progress && task.status === 'downloading' && (
                <div className="mt-3">
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sakura-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-neutral-500">
                    <span>{progress.percent.toFixed(1)}%</span>
                    <span>{progress.speed}</span>
                    <span>ETA {progress.eta}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
