import { useState, useEffect, useCallback } from 'react'
import { QrCode, Loader2, Check, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export function BilibiliLogin({ open, onClose }: Props) {
  const [step, setStep] = useState<'loading' | 'qrcode' | 'scanned' | 'success' | 'expired' | 'error'>('loading')
  const [qrcodeKey, setQrcodeKey] = useState('')
  const [qrcodeUrl, setQrcodeUrl] = useState('')
  const [message, setMessage] = useState('')

  const startLogin = useCallback(async () => {
    setStep('loading')
    try {
      const res = await fetch('/api/bilibili/qrcode', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQrcodeKey(data.qrcode_key)
      setQrcodeUrl(data.url)
      setStep('qrcode')
    } catch (err) {
      setMessage((err as Error).message || '生成二维码失败')
      setStep('error')
    }
  }, [])

  // Poll login status
  useEffect(() => {
    if (!qrcodeKey) return
    if (step !== 'qrcode' && step !== 'scanned') return

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/bilibili/qrcode/check?key=${qrcodeKey}`)
        const data = await res.json()
        if (data.status === 'success') {
          setStep('success')
          setMessage(data.message || '登录成功')
          clearInterval(timer)
        } else if (data.status === 'scanned') {
          setStep('scanned')
          setMessage('已扫码，请在手机上确认')
        } else if (data.status === 'expired') {
          setStep('expired')
          setMessage('二维码已过期')
          clearInterval(timer)
        }
      } catch { /* ignore poll errors */ }
    }, 2000)

    return () => clearInterval(timer)
  }, [qrcodeKey, step])

  useEffect(() => { if (open) startLogin() }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl p-6 w-80 max-w-[90vw]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-white/50 transition-colors"
        >
          <X size={18} />
        </button>

        <h3 className="text-sm font-medium text-ink-800 mb-4 text-center">Bilibili 扫码登录</h3>

        <div className="flex flex-col items-center gap-4">
          {/* Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={32} className="animate-spin text-ocean-500" />
              <p className="text-xs text-ink-500">正在生成二维码…</p>
            </div>
          )}

          {/* QR Code */}
          {(step === 'qrcode' || step === 'scanned') && (
            <>
              <div className="relative">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrcodeUrl)}`}
                  alt="Bilibili 登录二维码"
                  className="w-48 h-48 rounded-xl"
                />
                {step === 'scanned' && (
                  <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <Check size={32} className="text-green-400" />
                      <span className="text-white text-xs">已扫码</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-ink-500 text-center">
                {step === 'scanned' ? '请在手机上确认登录' : '请使用 Bilibili App 扫码'}
              </p>
            </>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Check size={32} className="text-green-500" />
              <p className="text-xs text-green-600 font-medium">{message}</p>
              <p className="text-[11px] text-ink-400">Cookie 已保存，可以下载高清视频了</p>
            </div>
          )}

          {/* Expired */}
          {step === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-xs text-ink-500">{message}</p>
              <button
                onClick={startLogin}
                className="px-4 py-2 text-sm rounded-xl bg-ocean-400 hover:bg-ocean-500 text-white transition-colors"
              >
                重新生成
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-xs text-red-500">{message}</p>
              <button
                onClick={startLogin}
                className="px-4 py-2 text-sm rounded-xl bg-ocean-400 hover:bg-ocean-500 text-white transition-colors"
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
