import { Info, Sparkles, Subtitles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

function SettingsSection({ title, icon: Icon, children }: {
  title: string
  icon: React.FC<{ size?: number; className?: string }>
  children: React.ReactNode
}) {
  return (
    <section className="bg-white/75 backdrop-blur-lg rounded-2xl border border-white/25 shadow-card">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/15">
        <Icon size={14} className="text-ink-500" />
        <h3 className="text-xs font-medium text-ink-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </section>
  )
}

export default function Settings() {
  const config = useQuery({ queryKey: ['config-status'], queryFn: api.getConfigStatus })
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-medium text-ink-800 mb-6">设置</h2>

      <div className="space-y-4">
        <SettingsSection title="AI 总结" icon={Sparkles}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">状态</span><span className={config.data?.llmConfigured ? 'text-green-600' : 'text-red-500'}>{config.data?.llmConfigured ? '已配置' : '未配置'}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">模型</span><span className="text-ink-700 font-mono text-xs">{config.data?.llmModel || '—'}</span></div>
            <p className="text-xs text-ink-400 pt-1">通过服务端 LLM_BASE_URL、LLM_API_KEY、LLM_MODEL 环境变量配置，密钥不会发送到浏览器。</p>
          </div>
        </SettingsSection>
        <SettingsSection title="语音转录" icon={Subtitles}>
          <div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-ink-500">Whisper 模式</span><span className="text-ink-700 font-mono text-xs">{config.data?.whisperMode || 'disabled'}</span></div><div className="flex justify-between"><span className="text-ink-500">本地组件</span><span className="text-ink-700">{config.data?.localWhisperAvailable ? '可用' : '未安装'}</span></div></div>
        </SettingsSection>
        {/* About */}
        <SettingsSection title="关于" icon={Info}>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">版本</span>
              <span className="text-ink-700 font-mono text-xs">v0.2.0</span>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}
