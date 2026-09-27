import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight, History, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

const statusText: Record<string, string> = { queued: '等待中', extracting: '提取中', transcribing: '转录中', summarizing: '总结中', completed: '已完成', partial: '部分完成', failed: '失败' }

export default function Analyses() {
  const query = useQuery({ queryKey: ['analyses'], queryFn: api.getAnalyses, refetchInterval: 5000 })
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-6"><History size={20} className="text-ocean-500" /><h1 className="text-xl font-medium text-ink-800">分析历史</h1></div>
      {query.isLoading && <Loader2 className="animate-spin text-ocean-500" />}
      <div className="space-y-3">{query.data?.map(analysis => <Link key={analysis.id} to={`/analyses/${analysis.id}`} className="flex items-center gap-4 p-4 bg-white/75 backdrop-blur-lg border border-white/25 rounded-2xl shadow-card hover:bg-white/85 transition-all">
        <div className="flex-1 min-w-0"><h2 className="text-sm font-medium text-ink-800 truncate">{analysis.title}</h2><p className="text-xs text-ink-500 mt-1">{analysis.items.length} 个视频 · {new Date(analysis.createdAt).toLocaleString()}</p></div>
        <span className={`text-xs px-2 py-1 rounded-lg ${analysis.status === 'failed' ? 'bg-red-50 text-red-500' : analysis.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-ocean-50 text-ocean-500'}`}>{statusText[analysis.status]}</span><ChevronRight size={16} className="text-ink-400" />
      </Link>)}</div>
      {!query.isLoading && !query.data?.length && <div className="text-center text-sm text-ink-500 py-20">还没有分析记录</div>}
    </div>
  )
}
