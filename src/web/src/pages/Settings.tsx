import { Info } from 'lucide-react'

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
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-medium text-ink-800 mb-6">设置</h2>

      <div className="space-y-4">
        {/* About */}
        <SettingsSection title="关于" icon={Info}>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">版本</span>
              <span className="text-ink-700 font-mono text-xs">v0.1.0</span>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}
