from __future__ import annotations

import shutil
import subprocess
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import httpx

from app.config import Settings
from app.schemas import TranscriptSegment
from app.services.subtitles import parse_subtitle
from app.services.ytdlp import YtDlpService, detect_site


class ExtractionError(RuntimeError):
    pass


@dataclass
class ExtractionResult:
    source: str
    segments: list[TranscriptSegment]
    frames: list[dict]


class VideoExtractor:
    def __init__(self, settings: Settings, ytdlp: YtDlpService):
        self.settings = settings
        self.ytdlp = ytdlp

    def extract(
        self, url: str, item_id: str, stage_callback: Callable[[str], None] | None = None
    ) -> ExtractionResult:
        info = self.ytdlp.extract_info(url)
        segments, source = self._platform_transcript(url)
        if not segments:
            segments = self._download_subtitles(info)
            source = "yt_dlp_subs" if segments else ""
        if not segments and self.settings.whisper_mode == "local":
            if stage_callback:
                stage_callback("transcribing")
            segments = self._local_whisper(url)
            source = "whisper_local" if segments else ""
        if not segments:
            hint = (
                "；可设置 WHISPER_MODE=local 启用本地转录"
                if self.settings.whisper_mode != "local"
                else ""
            )
            raise ExtractionError(f"没有找到可用字幕或转录{hint}")
        frames = self._extract_frames(url, item_id, int(info.get("duration") or 0))
        return ExtractionResult(source=source, segments=segments, frames=frames)

    def _platform_transcript(self, url: str) -> tuple[list[TranscriptSegment], str]:
        if detect_site(url) == "bilibili":
            segments = self._bilibili_transcript(url)
            return (segments, "subtitle") if segments else ([], "")
        if detect_site(url) == "youtube":
            segments = self._youtube_transcript(url)
            return (segments, "transcript_api") if segments else ([], "")
        return [], ""

    def _youtube_transcript(self, url: str) -> list[TranscriptSegment]:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            video_id = self._youtube_id(url)
            if not video_id:
                return []
            transcript_list = YouTubeTranscriptApi().list(video_id)
            transcript = None
            for language in ("zh-Hans", "zh-CN", "zh", "en"):
                try:
                    transcript = transcript_list.find_transcript([language])
                    break
                except Exception:
                    continue
            if transcript is None:
                available = list(transcript_list)
                transcript = available[0] if available else None
            if transcript is None:
                return []
            result = []
            for entry in transcript.fetch():
                start = float(getattr(entry, "start", 0))
                duration = float(getattr(entry, "duration", 0))
                text = str(getattr(entry, "text", "")).strip()
                if text:
                    result.append(
                        TranscriptSegment(
                            start_seconds=start, end_seconds=start + duration, text=text
                        )
                    )
            return result
        except Exception:
            return []

    def _bilibili_transcript(self, url: str) -> list[TranscriptSegment]:
        import re
        from urllib.parse import parse_qs, urlparse

        try:
            if "b23.tv" in url:
                url = str(httpx.get(url, follow_redirects=True, timeout=15).url)
            match = re.search(r"(BV[a-zA-Z0-9]{10})", url)
            if not match:
                return []
            bvid = match.group(1)
            headers = {
                "User-Agent": "Mozilla/5.0 Chrome/125 Safari/537.36",
                "Referer": "https://www.bilibili.com/",
            }
            view = httpx.get(
                "https://api.bilibili.com/x/web-interface/view",
                params={"bvid": bvid},
                headers=headers,
                timeout=15,
            ).json()
            video = view.get("data") or {}
            page_number = int(parse_qs(urlparse(url).query).get("p", [1])[0])
            pages = video.get("pages") or []
            page = pages[page_number - 1] if 0 < page_number <= len(pages) else {}
            cid = page.get("cid") or video.get("cid")
            if not cid:
                return []
            player = httpx.get(
                "https://api.bilibili.com/x/player/v2",
                params={"bvid": bvid, "cid": cid},
                headers=headers,
                timeout=15,
            ).json()
            subtitles = (player.get("data") or {}).get("subtitle", {}).get("subtitles", [])
            if not subtitles:
                subtitles = (video.get("subtitle") or {}).get("list", [])
            preferred = sorted(
                subtitles,
                key=lambda value: 0
                if any(lang in value.get("lan", "") for lang in ("zh-CN", "zh-Hans", "ai-zh"))
                else 1,
            )
            for subtitle in preferred:
                subtitle_url = subtitle.get("subtitle_url") or ""
                if subtitle_url.startswith("//"):
                    subtitle_url = "https:" + subtitle_url
                if not subtitle_url:
                    continue
                body = httpx.get(subtitle_url, headers=headers, timeout=15).json().get("body", [])
                segments = [
                    TranscriptSegment(
                        start_seconds=float(value.get("from") or 0),
                        end_seconds=float(value.get("to") or value.get("from") or 0),
                        text=str(value.get("content") or "").strip(),
                    )
                    for value in body
                    if str(value.get("content") or "").strip()
                ]
                if segments:
                    return segments
        except (httpx.HTTPError, ValueError, KeyError):
            return []
        return []

    @staticmethod
    def _youtube_id(url: str) -> str | None:
        from urllib.parse import parse_qs, urlparse

        parsed = urlparse(url)
        if parsed.hostname == "youtu.be":
            return parsed.path.strip("/").split("/")[0]
        if "youtube.com" in (parsed.hostname or ""):
            if parsed.path.startswith("/shorts/") or parsed.path.startswith("/live/"):
                return parsed.path.split("/")[2]
            return parse_qs(parsed.query).get("v", [None])[0]
        return None

    def _download_subtitles(self, info: dict) -> list[TranscriptSegment]:
        sources = {**(info.get("automatic_captions") or {}), **(info.get("subtitles") or {})}
        preferred = ("zh-Hans", "zh-CN", "zh", "en", "zh-Hant")
        tracks = next(
            (sources.get(language) for language in preferred if sources.get(language)), None
        )
        if not tracks and sources:
            tracks = next(iter(sources.values()))
        if not tracks:
            return []
        candidates = sorted(tracks, key=lambda track: 0 if track.get("ext") == "json3" else 1)
        for track in candidates:
            try:
                response = httpx.get(track["url"], timeout=20, follow_redirects=True)
                response.raise_for_status()
                segments = parse_subtitle(response.text, f".{track.get('ext', 'vtt')}")
                if segments:
                    return segments
            except Exception:
                continue
        return []

    def _local_whisper(self, url: str) -> list[TranscriptSegment]:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise ExtractionError("已启用本地 Whisper，但未安装 whisper extra") from exc
        with tempfile.TemporaryDirectory(prefix="puredown-whisper-") as directory:
            output = Path(directory) / "audio.%(ext)s"
            options = self.ytdlp._base_options(url)
            options.update(
                {"format": "bestaudio/best", "outtmpl": str(output), "postprocessors": []}
            )
            import yt_dlp

            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(url, download=True)
                audio_path = Path(ydl.prepare_filename(info))
            model = WhisperModel(self.settings.whisper_model, device="auto", compute_type="auto")
            raw_segments, _ = model.transcribe(
                str(audio_path), language=self.settings.whisper_language or None
            )
            return [
                TranscriptSegment(
                    start_seconds=float(segment.start),
                    end_seconds=float(segment.end),
                    text=segment.text.strip(),
                )
                for segment in raw_segments
                if segment.text.strip()
            ]

    def _extract_frames(self, url: str, item_id: str, duration: int) -> list[dict]:
        if self.settings.frames_per_video <= 0 or not shutil.which("ffmpeg"):
            return []
        target = self.settings.data_dir / "frames" / item_id
        target.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="puredown-frames-") as directory:
            output = Path(directory) / "video.%(ext)s"
            options = self.ytdlp._base_options(url)
            options.update({"format": "worst[height>=360]/worst", "outtmpl": str(output)})
            import yt_dlp

            try:
                with yt_dlp.YoutubeDL(options) as ydl:
                    info = ydl.extract_info(url, download=True)
                    video_path = Path(ydl.prepare_filename(info))
                duration = duration or int(info.get("duration") or 0)
            except Exception:
                return []
            if duration <= 0:
                return []
            frames = []
            for index in range(self.settings.frames_per_video):
                timestamp = duration * (index + 0.5) / self.settings.frames_per_video
                frame_id = str(uuid4())
                path = target / f"{frame_id}.jpg"
                result = subprocess.run(
                    [
                        "ffmpeg",
                        "-ss",
                        f"{timestamp:.2f}",
                        "-i",
                        str(video_path),
                        "-frames:v",
                        "1",
                        "-q:v",
                        "3",
                        "-vf",
                        "scale='min(960,iw)':-1",
                        "-y",
                        str(path),
                    ],
                    capture_output=True,
                    timeout=30,
                )
                if result.returncode == 0 and path.exists():
                    frames.append({"id": frame_id, "timestamp": timestamp, "path": str(path)})
            return frames
