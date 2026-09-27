import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Clock, ListVideo, Loader2, Sparkles } from 'lucide-react'
import type { AnalysisPreview } from '@puredown/shared'
import { api } from '@/lib/api'

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`
}

export default function Summarize() {
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<AnalysisPreview | null>(null)
  const [overview, setOverview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const inspect = async () => {
    setBusy(true); setError('')
    try { setPreview(await api.previewAnalysis(url.trim())) } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const start = async () => {
    setBusy(true); setError('')
    try { const analysis = await api.createAnalysis(url.trim(), overview); navigate(`/analyses/${analysis.id}`) }
    catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="max-w-3xl mx-auto p-6 pt-16">
      <div className="text-center mb-8"><Sparkles className="mx-auto text-ocean-500 mb-3" /><h1 className="font-display text-4xl font-light text-ink-900 mb-2">视频总结</h1><p className="text-sm text-ink-500">生成带时间点、关键帧和亮点的结构化笔记</p></div>
      <div className="flex gap-2"><input value={url} onChange={event => { setUrl(event.target.value); setPreview(null) }} onKeyDown={event => event.key === 'Enter' && inspect()} placeholder="粘贴单个视频或播放列表链接…" className="flex-1 h-12 px-4 bg-white/75 backdrop-blur-md border border-white/30 rounded-xl text-sm focus:outline-none focus:border-ocean-400" /><button onClick={inspect} disabled={busy || !url.trim()} className="h-12 px-6 rounded-xl bg-ocean-400 text-white disabled:opacity-50">{busy && !preview ? '解析中…' : '预览'}</button></div>
      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      {preview && <section className="mt-6 bg-white/75 backdrop-blur-lg border border-white/25 rounded-2xl shadow-card p-5">
        <h2 className="text-lg font-medium text-ink-800 mb-3">{preview.title}</h2>
        <div className="flex gap-4 text-sm text-ink-500 mb-4"><span className="flex items-center gap-1"><ListVideo size={15} />{preview.entries.length} 个视频</span><span className="flex items-center gap-1"><Clock size={15} />{duration(preview.totalDuration)}</span></div>
        {preview.kind === 'playlist' && <label className="flex items-start gap-3 p-3 rounded-xl bg-white/50 mb-4"><input type="checkbox" checked={overview} onChange={event => setOverview(event.target.checked)} className="mt-1" /><span><span className="block text-sm text-ink-700">生成合集总览</span><span className="text-xs text-ink-500">在逐集总结完成后，再提炼整个系列的主题与内容脉络</span></span></label>}
        {preview.overLimit ? <p className="text-sm text-red-500">该列表超过 {preview.maxItems} 集上限，未截断也不会启动。请调整服务端配置后重试。</p> : <button onClick={start} disabled={busy} className="w-full h-11 rounded-xl bg-ocean-400 hover:bg-ocean-500 text-white flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}开始分析</button>}
      </section>}
    </div>
  )
}
