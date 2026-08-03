import { spawn } from 'child_process'
import type { VideoInfo, FormatOption, PlaylistEntry } from '@sakuradown/shared'

const YT_DLP = 'yt-dlp'

function exec(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
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
  const { stdout } = await exec(['--dump-json', '--no-playlist', url])
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
  const { stdout } = await exec(['--dump-json', '--flat-playlist', url])
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
    const args = [
      '-f', formatId,
      '--progress', '--newline',
      '--no-playlist',
      ...(isMerging ? ['--merge-output-format', 'mp4'] : []),
      '-o', outputTemplate,
      url,
    ]

    const proc = spawn(YT_DLP, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
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
