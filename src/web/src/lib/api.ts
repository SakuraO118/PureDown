import type { Analysis, AnalysisConfigStatus, AnalysisPreview, DownloadResponse, DownloadTask, ParseResponse, TranscriptSegment } from '@puredown/shared'

const BASE = '/api'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.detail || 'Request failed')
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  parse: (url: string) => post<ParseResponse>('/parse', { url }),
  download: (url: string, formatId: string) =>
    post<DownloadResponse>('/download', { url, formatId }),
  getTask: (id: string) => get<DownloadTask>(`/download/${id}`),
  getDownloads: () => get<DownloadTask[]>('/downloads'),
  getFiles: () => get<{ name: string; path: string; size: number }[]>('/files'),
  getDownloadUrl: (filename: string) => `/api/files/${encodeURIComponent(filename)}/download`,
  getStreamUrl: (url: string, formatId: string) =>
    `/api/download/stream?url=${encodeURIComponent(url)}&formatId=${encodeURIComponent(formatId)}`,
  proxyImage: (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`,
  getBilibiliStatus: () => get<{ loggedIn: boolean; cookiePath: string }>('/bilibili/status'),
  bilibiliLogout: () => post<{ loggedIn: boolean }>('/bilibili/logout', {}),
  previewAnalysis: (url: string) => post<AnalysisPreview>('/analysis/preview', { url }),
  createAnalysis: (url: string, generatePlaylistOverview: boolean) =>
    post<Analysis>('/analyses', { url, generatePlaylistOverview }),
  getAnalyses: () => get<Analysis[]>('/analyses'),
  getAnalysis: (id: string) => get<Analysis>(`/analyses/${id}`),
  getTranscript: (analysisId: string, itemId: string) =>
    get<TranscriptSegment[]>(`/analyses/${analysisId}/items/${itemId}/transcript`),
  retryAnalysisItem: (analysisId: string, itemId: string) =>
    post<Analysis>(`/analyses/${analysisId}/items/${itemId}/retry`, {}),
  getConfigStatus: () => get<AnalysisConfigStatus>('/config/status'),
  analysisWebSocketUrl: (id: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws/analyses/${id}`
  },
}
