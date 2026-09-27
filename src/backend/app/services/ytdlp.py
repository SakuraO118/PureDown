from __future__ import annotations

import os
import re
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
import yt_dlp
from yt_dlp.networking.impersonate import ImpersonateTarget

from app.config import Settings


def detect_site(url: str) -> str:
    if re.search(r"bilibili\.com|b23\.tv", url, re.I):
        return "bilibili"
    if re.search(r"youtube\.com|youtu\.be", url, re.I):
        return "youtube"
    if re.search(r"douyin\.com", url, re.I):
        return "douyin"
    if re.search(r"xiaohongshu\.com|xhslink\.com", url, re.I):
        return "xiaohongshu"
    if re.search(r"tiktok\.com", url, re.I):
        return "tiktok"
    return "unknown"


class YtDlpService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _base_options(self, url: str) -> dict[str, Any]:
        options: dict[str, Any] = {"quiet": True, "no_warnings": True}
        if self.settings.cookies_file and self.settings.cookies_file.exists():
            options["cookiefile"] = str(self.settings.cookies_file)
        if self.settings.proxy_url and detect_site(url) == "youtube":
            options["proxy"] = self.settings.proxy_url
        if detect_site(url) == "bilibili" and self.settings.ytdlp_impersonate:
            options["impersonate"] = ImpersonateTarget.from_str(
                self.settings.ytdlp_impersonate
            )
        return options

    def extract_info(self, url: str, *, flat_playlist: bool = False) -> dict[str, Any]:
        options = self._base_options(url)
        options.update(
            {
                "skip_download": True,
                "extract_flat": "in_playlist" if flat_playlist else False,
                "noplaylist": not flat_playlist,
            }
        )
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)
        if not isinstance(info, dict):
            raise ValueError("无法解析视频信息")
        return info

    def preview(self, url: str) -> dict[str, Any]:
        if detect_site(url) == "bilibili" and re.search(r"BV[a-zA-Z0-9]{10}", url):
            return self._bilibili_public_preview(url)
        try:
            info = self.extract_info(url, flat_playlist=True)
        except yt_dlp.utils.DownloadError:
            if detect_site(url) != "bilibili":
                raise
            return self._bilibili_public_preview(url)
        raw_entries = [entry for entry in (info.get("entries") or []) if isinstance(entry, dict)]
        entries = []
        for index, entry in enumerate(raw_entries, start=1):
            entry_url = entry.get("webpage_url") or entry.get("url") or ""
            if entry_url and not str(entry_url).startswith("http"):
                if detect_site(url) == "youtube":
                    entry_url = f"https://www.youtube.com/watch?v={entry_url}"
                elif detect_site(url) == "bilibili" and str(entry.get("id", "")).startswith("BV"):
                    entry_url = f"https://www.bilibili.com/video/{entry['id']}"
            entries.append(
                {
                    "id": str(entry.get("id") or index),
                    "title": entry.get("title") or f"第 {index} 集",
                    "url": entry_url or url,
                    "duration": int(entry.get("duration") or 0),
                    "position": index,
                }
            )
        return {
            "url": info.get("webpage_url") or url,
            "title": info.get("title") or info.get("playlist_title") or "未命名视频",
            "duration": int(info.get("duration") or 0),
            "entries": entries,
            "raw": info,
        }

    def _bilibili_public_preview(self, url: str) -> dict[str, Any]:
        if "b23.tv" in url:
            response = httpx.get(url, follow_redirects=True, timeout=15)
            response.raise_for_status()
            url = str(response.url)
        match = re.search(r"(BV[a-zA-Z0-9]{10})", url)
        if not match:
            raise ValueError("无法从 Bilibili 地址识别 BV 号")
        bvid = match.group(1)
        response = httpx.get(
            "https://api.bilibili.com/x/web-interface/view",
            params={"bvid": bvid},
            headers={
                "User-Agent": "Mozilla/5.0 Chrome/125 Safari/537.36",
                "Referer": "https://www.bilibili.com/",
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("code") != 0:
            raise ValueError(payload.get("message") or "Bilibili 视频不存在")
        video = payload["data"]
        pages = video.get("pages") or []
        entries = []
        if len(pages) > 1:
            for index, page in enumerate(pages, start=1):
                page_number = int(page.get("page") or index)
                page_query = urlencode({"p": page_number})
                entries.append(
                    {
                        "id": f"{bvid}-p{page_number}",
                        "title": page.get("part") or f"P{page_number}",
                        "url": f"https://www.bilibili.com/video/{bvid}?{page_query}",
                        "duration": int(page.get("duration") or 0),
                        "position": index,
                    }
                )
        return {
            "url": f"https://www.bilibili.com/video/{bvid}",
            "title": video.get("title") or "未命名视频",
            "duration": int(video.get("duration") or 0),
            "entries": entries,
            "raw": video,
        }

    def parse_video(self, url: str) -> dict[str, Any]:
        info = self.extract_info(url)
        formats = []
        seen_heights: set[int] = set()
        for raw in info.get("formats") or []:
            height = int(raw.get("height") or 0)
            acodec = raw.get("acodec") or "none"
            vcodec = raw.get("vcodec") or "none"
            has_video = vcodec != "none"
            has_audio = acodec != "none"
            item_type = (
                "video+audio"
                if has_video and has_audio
                else "video-only"
                if has_video
                else "audio-only"
            )
            if height and height in seen_heights:
                continue
            if height:
                seen_heights.add(height)
            formats.append(
                {
                    "id": str(raw.get("format_id") or ""),
                    "ext": raw.get("ext") or "unknown",
                    "resolution": f"{raw.get('width') or '?'}x{raw.get('height') or '?'}",
                    "height": height,
                    "filesize": int(raw.get("filesize") or raw.get("filesize_approx") or 0),
                    "vcodec": vcodec,
                    "acodec": acodec,
                    "asr": int(raw.get("asr") or 0),
                    "abr": int(raw.get("abr") or 0),
                    "note": raw.get("format_note")
                    or ("audio only" if item_type == "audio-only" else f"{height}p"),
                    "type": item_type,
                }
            )
        return {
            "id": str(info.get("id") or info.get("display_id") or ""),
            "title": info.get("title") or "",
            "description": info.get("description") or "",
            "thumbnail": info.get("thumbnail") or "",
            "duration": int(info.get("duration") or 0),
            "webpageUrl": info.get("webpage_url") or url,
            "uploader": info.get("uploader") or info.get("channel") or "",
            "isPlaylist": False,
            "entries": [],
            "formats": formats,
            "site": detect_site(url) if detect_site(url) in {"bilibili", "youtube"} else "unknown",
        }

    def download_file(
        self,
        url: str,
        format_id: str,
        output_dir: Path,
        progress: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, str]:
        output_dir.mkdir(parents=True, exist_ok=True)
        options = self._base_options(url)
        options.update(
            {
                "format": format_id,
                "outtmpl": str(output_dir / "%(title)s.%(ext)s"),
                "merge_output_format": "mp4" if "+" in format_id else None,
                "progress_hooks": [progress] if progress else [],
            }
        )
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
            path = ydl.prepare_filename(info)
        return {"filePath": path, "filename": Path(path).name}

    def stream_process(self, url: str, format_id: str) -> subprocess.Popen[bytes]:
        command = [shutil.which("yt-dlp") or "yt-dlp"]
        if self.settings.cookies_file and self.settings.cookies_file.exists():
            command += ["--cookies", str(self.settings.cookies_file)]
        if self.settings.proxy_url and detect_site(url) == "youtube":
            command += ["--proxy", self.settings.proxy_url]
        if detect_site(url) == "bilibili" and self.settings.ytdlp_impersonate:
            command += ["--impersonate", self.settings.ytdlp_impersonate]
        command += ["-f", format_id, "--no-playlist"]
        if "+" in format_id:
            command += ["--merge-output-format", "mp4"]
        command += ["-o", "-", url]
        environment = os.environ.copy()
        for key in (
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "http_proxy",
            "https_proxy",
            "NO_PROXY",
            "no_proxy",
        ):
            environment.pop(key, None)
        return subprocess.Popen(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment
        )
