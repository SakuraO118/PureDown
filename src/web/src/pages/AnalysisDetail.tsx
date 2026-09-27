import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Check, Clipboard, Clock, Loader2, RefreshCw, Subtitles } from 'lucide-react'
import type { Analysis, AnalysisItem, TranscriptSegment } from '@puredown/shared'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const statusText: Record<string, string> = { queued: '等待处理', extracting: '提取字幕与关键帧', transcribing: '语音转录', summarizing: 'AI 总结', completed: '分析完成', partial: '部分完成', failed: '分析失败' }
const time = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`

function markdown(item: AnalysisItem) {
  const summary = item.summary
  if (!summary) return ''
  return [`# ${item.title}`, '', summary.overview, '', ...summary.chapters.flatMap(chapter => [`## ${time(chapter.startSeconds)} ${chapter.title}`, chapter.summary, ...chapter.keyPoints.map(point => `- ${point}`), '']), '## 亮点', ...summary.highlights.map(value => `- ${value.text} ${value.tags.map(tag => `#${tag}`).join(' ')}`), '', '## 延伸问题', ...summary.questions.map(value => `- ${value}`)].join('\n')
}

export default function AnalysisDetail() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['analysis', id], queryFn: () => api.getAnalysis(id), refetchInterval: data => ['completed', 'partial', 'failed'].includes(data.state.data?.status || '') ? false : 3000 })
  const [selectedId, setSelectedId] = useState('')
  const [transcript, setTranscript] = useState<TranscriptSegment[] | null>(null)
  const analysis = query.data
  const selected = useMemo(() => analysis?.items.find(item => item.id === selectedId) || analysis?.items[0], [analysis, selectedId])
  useEffect(() => {
    if (!id) return
    const socket = new WebSocket(api.analysisWebSocketUrl(id))
    socket.onmessage = event => {
      const message = JSON.parse(event.data) as { type: string; data: Analysis }
      if (message.type === 'analysis') client.setQueryData(['analysis', id], message.data)
    }
    return () => socket.close()
  }, [client, id])
  const showTranscript = async () => {
    if (!selected) return
    try { setTranscript(await api.getTranscript(id, selected.id)) } catch (cause) { toast.error((cause as Error).message) }
  }
  const retry = async (item: AnalysisItem) => {
    try { await api.retryAnalysisItem(id, item.id); await query.refetch() } catch (cause) { toast.error((cause as Error).message) }
  }
  if (query.isLoading || !analysis) return <div className="p-10"><Loader2 className="animate-spin text-ocean-500" /></div>
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6"><h1 className="font-display text-2xl text-ink-800">{analysis.title}</h1><div className="flex items-center gap-3 mt-2 text-sm text-ink-500"><span>{statusText[analysis.status]}</span><span>{analysis.progress}%</span></div><div className="h-1.5 bg-white/40 rounded-full mt-3 overflow-hidden"><div className="h-full bg-ocean-400 transition-all" style={{ width: `${analysis.progress}%` }} /></div></div>
      {analysis.playlistOverview && <section className="mb-5 p-5 bg-white/75 backdrop-blur-lg rounded-2xl border border-white/25"><h2 className="text-lg font-medium text-ink-800 mb-2">合集总览</h2><p className="text-sm leading-7 text-ink-700">{analysis.playlistOverview.overview}</p><div className="flex flex-wrap gap-2 mt-3">{analysis.playlistOverview.themes.map(theme => <span key={theme} className="px-2 py-1 bg-ocean-50 text-ocean-500 rounded-lg text-xs">{theme}</span>)}</div></section>}
      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        <aside className="space-y-2">{analysis.items.map(item => <button key={item.id} onClick={() => { setSelectedId(item.id); setTranscript(null) }} className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.id === item.id ? 'bg-ocean-50/90 border-ocean-300' : 'bg-white/60 border-white/25'}`}><span className="block text-sm text-ink-800 truncate">{item.position}. {item.title}</span><span className={`text-xs ${item.status === 'failed' ? 'text-red-500' : 'text-ink-500'}`}>{statusText[item.status]}</span></button>)}</aside>
        <main>{selected && <section className="bg-white/75 backdrop-blur-lg rounded-2xl border border-white/25 p-6">
          <div className="flex items-start justify-between gap-4 mb-5"><h2 className="text-xl font-medium text-ink-800">{selected.title}</h2><div className="flex gap-2">{selected.summary && <button onClick={() => { navigator.clipboard.writeText(markdown(selected)); toast.success('Markdown 已复制') }} className="p-2 rounded-lg bg-white/60 text-ink-500" title="复制 Markdown"><Clipboard size={16} /></button>}<button onClick={showTranscript} className="p-2 rounded-lg bg-white/60 text-ink-500" title="查看字幕"><Subtitles size={16} /></button></div></div>
          {selected.status === 'failed' && <div className="p-4 bg-red-50/80 rounded-xl text-sm text-red-600"><p>{selected.error}</p><button onClick={() => retry(selected)} className="mt-3 inline-flex items-center gap-1"><RefreshCw size={14} />重试</button></div>}
          {!selected.summary && selected.status !== 'failed' && <div className="py-16 text-center text-ink-500"><Loader2 className="animate-spin mx-auto mb-3 text-ocean-500" />{statusText[selected.status]}</div>}
          {selected.summary && <div className="space-y-7"><p className="text-base leading-8 text-ink-700">{selected.summary.overview}</p>{selected.summary.chapters.map((chapter, index) => { const frame = selected.frames.find(value => value.id === chapter.frameId) || selected.frames[index % Math.max(selected.frames.length, 1)]; return <article key={`${chapter.startSeconds}-${chapter.title}`}><h3 className="flex items-center gap-2 text-lg font-medium text-ink-800 mb-3"><Clock size={16} className="text-ocean-500" />{time(chapter.startSeconds)} · {chapter.title}</h3>{frame && <img src={frame.url} alt={chapter.title} className="w-full max-h-96 object-contain rounded-xl bg-white/30 mb-3" />}<p className="text-sm leading-7 text-ink-700">{chapter.summary}</p><ul className="mt-2 space-y-1">{chapter.keyPoints.map(point => <li key={point} className="text-sm text-ink-600 flex gap-2"><Check size={14} className="text-ocean-500 mt-1 shrink-0" />{point}</li>)}</ul></article>})}<div><h3 className="text-lg font-medium text-ink-800 mb-3">亮点</h3>{selected.summary.highlights.map(value => <div key={value.text} className="mb-3"><p className="text-sm text-ink-700">{value.text}</p><p className="text-xs text-ocean-500 mt-1">{value.tags.map(tag => `#${tag}`).join(' ')}</p></div>)}</div><div><h3 className="text-lg font-medium text-ink-800 mb-3">延伸问题</h3><ul className="space-y-2">{selected.summary.questions.map(value => <li key={value} className="text-sm text-ink-700">• {value}</li>)}</ul></div></div>}
          {transcript && <div className="mt-8 pt-6 border-t border-white/30"><h3 className="text-lg font-medium text-ink-800 mb-4">原字幕</h3><div className="max-h-96 overflow-y-auto space-y-2">{transcript.map((segment, index) => <p key={`${segment.startSeconds}-${index}`} className="text-sm text-ink-700"><span className="font-mono text-xs text-ocean-500 mr-2">{time(segment.startSeconds)}</span>{segment.text}</p>)}</div></div>}
        </section>}</main>
      </div>
    </div>
  )
}
