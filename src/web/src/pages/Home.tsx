import { ArrowRight, Download, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

const tools = [
  { to: '/download', icon: Download, title: '视频下载', description: '解析视频链接，选择画质并保存到本地。' },
  { to: '/summarize', icon: Sparkles, title: '视频总结', description: '提取时间轴字幕与关键帧，生成结构化 AI 笔记。' },
]

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <div className="text-center mb-12">
        <h1 className="font-display text-5xl font-light text-ink-900 tracking-wide mb-3">PureDown</h1>
        <p className="text-ink-500">你的视频工具箱</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {tools.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to} className="group p-6 bg-white/75 backdrop-blur-lg border border-white/25 rounded-2xl shadow-card hover:bg-white/85 hover:shadow-elevated transition-all">
            <div className="w-11 h-11 rounded-xl bg-ocean-50/80 text-ocean-500 flex items-center justify-center mb-5"><Icon size={22} /></div>
            <h2 className="text-xl font-medium text-ink-800 mb-2">{title}</h2>
            <p className="text-sm leading-6 text-ink-500 min-h-12">{description}</p>
            <span className="mt-6 inline-flex items-center gap-1 text-sm text-ocean-500">打开工具 <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" /></span>
          </Link>
        ))}
      </div>
    </div>
  )
}
