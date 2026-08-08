import { spawn, execSync } from 'child_process'
import { createRequire } from 'node:module'
import type { VideoInfo, FormatOption, PlaylistEntry } from '@puredown/shared'
import { existsSync, accessSync, constants } from 'fs'

const YT_DLP = 'yt-dlp'
const require = createRequire(import.meta.url)

// Cookie file support (for Bilibili anti-bot bypass on datacenter IPs)
const COOKIES_FILE = process.env.COOKIES_FILE
const cookieArgs = COOKIES_FILE && existsSync(COOKIES_FILE) ? ['--cookies', COOKIES_FILE] : []

// Proxy — only for sites that need it (YouTube etc.), not global
const PROXY_URL = process.env.PROXY_URL || ''
const NEEDS_PROXY = (url: string) => /youtube\.com|youtu\.be/i.test(url)

// Resolve ffmpeg path with fallback chain (fastest & most reliable first):
// 1. System PATH (`brew install ffmpeg` etc.) — fastest check
// 2. FFMPEG_PATH env var — explicit override
// 3. ffmpeg-static (bundled by npm) — zero system deps fallback (lazy-loaded)
function resolveFfmpeg(): string | null {
  // 1. System PATH first — instant, no network, no binary validation
  try { execSync('ffmpeg -version', { stdio: 'ignore', timeout: 3000 }); return 'ffmpeg' }
  catch { /* not in PATH */ }

  // 2. Env var override
  const envPath = process.env.FFMPEG_PATH
  if (envPath && existsSync(envPath)) return envPath

  // 3. ffmpeg-static — lazy-load to avoid blocking startup if not installed
  try {
    const ffmpegStatic = require('ffmpeg-static') as string | null
    if (ffmpegStatic && existsSync(ffmpegStatic)) {
      try { accessSync(ffmpegStatic, constants.X_OK); return ffmpegStatic }
      catch { /* not executable */ }
    }
  } catch { /* ffmpeg-static not installed (optional dep) */ }

  return null
}

const ffmpegPath = resolveFfmpeg()

function exec(args: string[], url?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Strip global proxy env vars — yt-dlp would inherit them and force proxy for ALL sites
    const cleanEnv = { ...process.env }
    delete cleanEnv.HTTP_PROXY
    delete cleanEnv.HTTPS_PROXY
    delete cleanEnv.http_proxy
    delete cleanEnv.https_proxy
    delete cleanEnv.NO_PROXY
    delete cleanEnv.no_proxy

    const proxyArgs = (PROXY_URL && url && NEEDS_PROXY(url)) ? ['--proxy', PROXY_URL] : []
    const proc = spawn(YT_DLP, [...proxyArgs, ...cookieArgs, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv,
    })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr || `yt-dlp exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

function detectSite(url: string): 'bilibili' | 'youtube' | 'unknown' {
  if (/bilibili\.com|b23\.tv/i.test(url)) return 'bilibili'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  return 'unknown'
}

function parseRawFormat(raw: Record<string, unknown>): FormatOption {
  const height = (raw.height as number) || 0
  const acodec = (raw.acodec as string) || 'none'
  const vcodec = (raw.vcodec as string) || 'none'
  const hasVideo = vcodec !== 'none'
  const hasAudio = acodec !== 'none'

  let type: FormatOption['type']
  if (hasVideo && hasAudio) type = 'video+audio'
  else if (hasVideo && !hasAudio) type = 'video-only'
  else type = 'audio-only'

  // Build a human-readable note
  let note = raw.format_note as string || ''
  if (!note && type === 'audio-only') note = 'audio only'
  if (!note && height > 0) note = `${height}p`

  return {
    id: raw.format_id as string,
    ext: (raw.ext as string) || 'unknown',
    resolution: `${raw.width || '?'}x${raw.height || '?'}`,
    height,
    filesize: (raw.filesize as number) || (raw.filesize_approx as number) || 0,
    vcodec,
    acodec,
    note,
    type,
  }
}

export async function parseVideo(url: string): Promise<VideoInfo> {
  const { stdout } = await exec(['--dump-json', '--no-playlist', url], url)
  const raw = JSON.parse(stdout)

  const formats: FormatOption[] = (raw.formats as Record<string, unknown>[] || [])
    .map(parseRawFormat)

  // Deduplicate by height for common formats, keep the best quality of each height
  const seenHeights = new Set<number>()
  const deduplicated: FormatOption[] = []
  for (const f of formats) {
    if (f.height > 0) {
      if (!seenHeights.has(f.height)) {
        seenHeights.add(f.height)
        deduplicated.push(f)
      }
    } else {
      deduplicated.push(f)
    }
  }

  return {
    id: raw.id as string || raw.display_id as string || '',
    title: (raw.title as string) || '',
    description: (raw.description as string) || '',
    thumbnail: (raw.thumbnail as string) || '',
    duration: (raw.duration as number) || 0,
    webpageUrl: (raw.webpage_url as string) || url,
    uploader: (raw.uploader as string) || (raw.channel as string) || '',
    isPlaylist: false,
    entries: [],
    formats: deduplicated,
    site: detectSite(url),
  }
}

export async function parsePlaylist(url: string): Promise<VideoInfo> {
  const { stdout } = await exec(['--dump-json', '--flat-playlist', url], url)
  const lines = stdout.trim().split('\n')

  if (lines.length === 0) {
    // Fallback: try as single video
    return parseVideo(url)
  }

  const entries: PlaylistEntry[] = lines.map((line, i) => {
    const raw = JSON.parse(line)
    return {
      id: raw.id as string || '',
      title: (raw.title as string) || `Part ${i + 1}`,
      duration: (raw.duration as number) || 0,
      index: i + 1,
      url: (raw.url as string) || (raw.webpage_url as string) || '',
    }
  })

  // Get playlist metadata from first entry or use defaults
  const first = JSON.parse(lines[0])
  const firstInfo = await parseVideo(entries[0].url || url)

  return {
    ...firstInfo,
    isPlaylist: true,
    playlistTitle: (first.playlist_title as string) || (first.title as string) || '',
    entries,
  }
}

export interface ProgressCallback {
  (progress: { percent: number; speed: string; eta: string; downloaded: string; totalSize: string }): void
}

export function download(
  url: string,
  formatId: string,
  outputDir: string,
  onProgress: ProgressCallback
): Promise<{ filePath: string; filename: string }> {
  return new Promise((resolve, reject) => {
    const outputTemplate = `${outputDir}/%(title)s.%(ext)s`
    const isMerging = formatId.includes('+')
    if (isMerging && !ffmpegPath) {
      reject(new Error('FFmpeg 未找到。请安装: brew install ffmpeg'))
      return
    }
    // Only pass --ffmpeg-location for custom paths; yt-dlp finds system ffmpeg on PATH automatically
    const ffmpegArgs = isMerging
      ? (ffmpegPath && ffmpegPath !== 'ffmpeg'
          ? ['--ffmpeg-location', ffmpegPath, '--merge-output-format', 'mp4']
          : ['--merge-output-format', 'mp4'])
      : []
    const args = [
      ...cookieArgs,
      '-f', formatId,
      '--progress', '--newline',
      '--no-playlist',
      ...ffmpegArgs,
      '-o', outputTemplate,
      url,
    ]

    // Strip global proxy env vars
    const cleanEnv = { ...process.env }
    delete cleanEnv.HTTP_PROXY
    delete cleanEnv.HTTPS_PROXY
    delete cleanEnv.http_proxy
    delete cleanEnv.https_proxy
    delete cleanEnv.NO_PROXY
    delete cleanEnv.no_proxy

    const proxyArgs = (PROXY_URL && NEEDS_PROXY(url)) ? ['--proxy', PROXY_URL] : []
    const finalArgs = [...proxyArgs, ...args]

    const proc = spawn(YT_DLP, finalArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv,
    })

    let stderr = ''
    let filename = ''

    proc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()

      // Parse progress line: [download] XX.X% of XX at XX/s ETA XX:XX
      const progressMatch = text.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/)
      if (progressMatch) {
        onProgress({
          percent: parseFloat(progressMatch[1]),
          downloaded: progressMatch[2],
          speed: progressMatch[3],
          eta: progressMatch[4],
          totalSize: '', // Not in the same line
        })
        return
      }

      // Parse destination line: [download] Destination: /path/to/file.mp4
      const destMatch = text.match(/\[download\]\s+Destination:\s+(.+)/)
      if (destMatch) {
        filename = destMatch[1].trim()
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ filePath: filename, filename: filename.split('/').pop() || '' })
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`))
      }
    })

    proc.on('error', reject)
  })
}

// Stream download: yt-dlp outputs to stdout, piped directly to HTTP response
export function downloadStream(
  url: string,
  formatId: string,
): { proc: ReturnType<typeof spawn>; filename: string } {
  const isMerging = formatId.includes('+')
  if (isMerging && !ffmpegPath) {
    throw new Error('FFmpeg 未找到。请安装: brew install ffmpeg')
  }
  const ffmpegArgs = isMerging
    ? (ffmpegPath && ffmpegPath !== 'ffmpeg'
        ? ['--ffmpeg-location', ffmpegPath, '--merge-output-format', 'mp4']
        : ['--merge-output-format', 'mp4'])
    : []

  const args = [
    ...cookieArgs,
    '-f', formatId,
    '--no-playlist',
    ...ffmpegArgs,
    '-o', '-',  // output to stdout
    url,
  ]

  // Strip global proxy env vars
  const cleanEnv = { ...process.env }
  delete cleanEnv.HTTP_PROXY
  delete cleanEnv.HTTPS_PROXY
  delete cleanEnv.http_proxy
  delete cleanEnv.https_proxy
  delete cleanEnv.NO_PROXY
  delete cleanEnv.no_proxy

  const proxyArgs = (PROXY_URL && NEEDS_PROXY(url)) ? ['--proxy', PROXY_URL] : []
  const finalArgs = [...proxyArgs, ...args]

  const proc = spawn(YT_DLP, finalArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],  // stdout=video data, stderr=progress
    env: cleanEnv,
  })

  // Build a fallback filename from URL
  const filename = `video_${Date.now()}.mp4`

  return { proc, filename }
}
