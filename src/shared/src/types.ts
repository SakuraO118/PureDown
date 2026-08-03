// ---- Video Info (from yt-dlp --dump-json) ----

export interface FormatOption {
  id: string           // format code, e.g. "137+140"
  ext: string          // file extension, e.g. "mp4"
  resolution: string   // e.g. "1920x1080"
  height: number       // e.g. 1080
  filesize: number     // bytes, 0 if unknown
  vcodec: string       // e.g. "avc1.640028"
  acodec: string       // e.g. "mp4a.40.2"
  note: string         // e.g. "1080p" or "audio only"
  type: 'video+audio' | 'video-only' | 'audio-only'
}

export interface PlaylistEntry {
  id: string
  title: string
  duration: number     // seconds
  index: number        // 1-based
  url: string
}

export interface VideoInfo {
  id: string
  title: string
  description: string
  thumbnail: string
  duration: number     // seconds
  webpageUrl: string
  uploader: string
  isPlaylist: boolean
  playlistTitle?: string
  entries: PlaylistEntry[]
  formats: FormatOption[]
  site: 'bilibili' | 'youtube' | 'unknown'
}

// ---- Download Task ----

export type TaskStatus = 'pending' | 'downloading' | 'completed' | 'failed'

export interface DownloadProgress {
  taskId: string
  status: TaskStatus
  percent: number      // 0-100
  speed: string        // e.g. "5.2MiB/s"
  eta: string          // e.g. "00:30"
  downloaded: string   // e.g. "50.3MiB"
  totalSize: string    // e.g. "200.0MiB"
}

export interface DownloadTask {
  id: string
  url: string
  title: string
  formatId: string
  formatNote: string
  status: TaskStatus
  progress: DownloadProgress | null
  outputPath: string
  error?: string
  createdAt: number
}

// ---- API Request/Response ----

export interface ParseRequest {
  url: string
}

export interface ParseResponse {
  video: VideoInfo
}

export interface DownloadRequest {
  url: string
  formatId: string
  playlistItems?: number[]  // 1-based indices for specific entries
}

export interface DownloadResponse {
  taskId: string
}

// ---- WebSocket Messages ----

export type WsMessage =
  | { type: 'progress'; data: DownloadProgress }
  | { type: 'complete'; data: { taskId: string; filePath: string; filename: string } }
  | { type: 'error'; data: { taskId: string; error: string } }
