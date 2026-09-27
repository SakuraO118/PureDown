from __future__ import annotations

import asyncio
import base64
import io
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import uuid4

import httpx
import qrcode
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.security import UnsafeUrlError, validate_public_video_url

router = APIRouter()


class ParseBody(BaseModel):
    url: str


class DownloadBody(BaseModel):
    url: str
    formatId: str


def _safe_url(url: str) -> None:
    try:
        validate_public_video_url(url)
    except UnsafeUrlError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "backend": "python"}


@router.post("/api/parse")
async def parse_video(body: ParseBody, request: Request) -> dict[str, Any]:
    _safe_url(body.url)
    try:
        preview = await asyncio.to_thread(request.app.state.ytdlp.preview, body.url)
        if preview["entries"]:
            first = await asyncio.to_thread(
                request.app.state.ytdlp.parse_video, preview["entries"][0]["url"]
            )
            legacy_entries = [
                {
                    "id": entry["id"],
                    "title": entry["title"],
                    "url": entry["url"],
                    "duration": entry["duration"],
                    "index": entry["position"],
                }
                for entry in preview["entries"]
            ]
            first.update(
                {
                    "isPlaylist": True,
                    "playlistTitle": preview["title"],
                    "entries": legacy_entries,
                }
            )
            return {"video": first}
        return {"video": await asyncio.to_thread(request.app.state.ytdlp.parse_video, body.url)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/download/stream")
async def download_stream(url: str, formatId: str, request: Request) -> StreamingResponse:
    _safe_url(url)
    try:
        video = await asyncio.to_thread(request.app.state.ytdlp.parse_video, url)
        process = request.app.state.ytdlp.stream_process(url, formatId)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    safe_title = "".join("_" if char in '/\\:*?"<>|' else char for char in video["title"])[:100]
    selected = next((item for item in video["formats"] if item["id"] == formatId), None)
    extension = (selected or {}).get("ext", "mp4")

    def iterator():
        assert process.stdout is not None
        try:
            while chunk := process.stdout.read(64 * 1024):
                yield chunk
        finally:
            if process.poll() is None:
                process.terminate()

    return StreamingResponse(
        iterator(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": (
                f"attachment; filename*=UTF-8''{quote(f'{safe_title}.{extension}')}"
            ),
        },
    )


@router.post("/api/download")
async def create_download(body: DownloadBody, request: Request) -> dict[str, str]:
    _safe_url(body.url)
    task_id = str(uuid4())
    video = await asyncio.to_thread(request.app.state.ytdlp.parse_video, body.url)
    task = {
        "id": task_id,
        "url": body.url,
        "title": video["title"],
        "formatId": body.formatId,
        "formatNote": body.formatId,
        "status": "pending",
        "progress": None,
        "outputPath": str(request.app.state.settings.download_dir),
        "createdAt": int(time.time() * 1000),
    }
    request.app.state.download_tasks[task_id] = task

    async def run() -> None:
        task["status"] = "downloading"

        def progress(data: dict) -> None:
            downloaded = int(data.get("downloaded_bytes") or 0)
            total = int(data.get("total_bytes") or data.get("total_bytes_estimate") or 0)
            percent = downloaded / total * 100 if total else 0
            task["progress"] = {
                "taskId": task_id,
                "status": "downloading",
                "percent": percent,
                "speed": str(data.get("_speed_str") or ""),
                "eta": str(data.get("_eta_str") or ""),
                "downloaded": str(data.get("_downloaded_bytes_str") or ""),
                "totalSize": str(data.get("_total_bytes_str") or ""),
            }

        try:
            result = await asyncio.to_thread(
                request.app.state.ytdlp.download_file,
                body.url,
                body.formatId,
                request.app.state.settings.download_dir,
                progress,
            )
            task.update(
                {
                    "status": "completed",
                    "progress": {**(task["progress"] or {}), "percent": 100},
                    "filePath": result["filePath"],
                    "filename": result["filename"],
                }
            )
        except Exception as exc:
            task.update({"status": "failed", "error": str(exc)})

    asyncio.create_task(run())
    return {"taskId": task_id}


@router.get("/api/downloads")
async def downloads(request: Request) -> list[dict]:
    return sorted(
        request.app.state.download_tasks.values(), key=lambda task: task["createdAt"], reverse=True
    )


@router.get("/api/download/{task_id}")
async def download_task(task_id: str, request: Request) -> dict:
    task = request.app.state.download_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/api/files")
async def files(request: Request) -> list[dict]:
    directory = request.app.state.settings.download_dir
    directory.mkdir(parents=True, exist_ok=True)
    result = []
    for path in directory.iterdir():
        if path.is_file():
            stat = path.stat()
            result.append(
                {
                    "name": path.name,
                    "path": str(path),
                    "size": stat.st_size,
                    "modifiedAt": int(stat.st_mtime * 1000),
                }
            )
    return sorted(result, key=lambda item: item["modifiedAt"], reverse=True)


@router.get("/api/files/{filename}/download")
async def download_file(filename: str, request: Request):
    from fastapi.responses import FileResponse

    root = request.app.state.settings.download_dir.resolve()
    path = (root / filename).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=path.name)


@router.get("/api/proxy-image")
async def proxy_image(url: str) -> Response:
    _safe_url(url)
    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        response = await client.get(url)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="封面获取失败")
    return Response(response.content, media_type=response.headers.get("content-type", "image/jpeg"))


def _cookie_path(request: Request) -> Path:
    return (
        request.app.state.settings.cookies_file
        or request.app.state.settings.data_dir / "bilibili-cookies.txt"
    )


@router.get("/api/bilibili/status")
async def bilibili_status(request: Request) -> dict:
    path = _cookie_path(request)
    return {"loggedIn": path.exists(), "cookiePath": str(path)}


@router.post("/api/bilibili/logout")
async def bilibili_logout(request: Request) -> dict[str, bool]:
    path = _cookie_path(request)
    if path.exists():
        path.unlink()
    return {"loggedIn": False}


@router.post("/api/bilibili/qrcode")
async def bilibili_qrcode() -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            "https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
            headers={"User-Agent": "PureDown/1.0", "Referer": "https://www.bilibili.com/"},
        )
        data = response.json()
    if data.get("code") != 0:
        raise HTTPException(status_code=502, detail=data.get("message") or "生成二维码失败")
    image = qrcode.make(data["data"]["url"])
    output = io.BytesIO()
    image.save(output, format="PNG")
    encoded = base64.b64encode(output.getvalue()).decode()
    return {**data["data"], "qrcode": f"data:image/png;base64,{encoded}"}


@router.get("/api/bilibili/qrcode/check")
async def bilibili_qrcode_check(key: str, request: Request) -> dict:
    async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
        response = await client.get(
            "https://passport.bilibili.com/x/passport-login/web/qrcode/poll",
            params={"qrcode_key": key},
            headers={"User-Agent": "PureDown/1.0", "Referer": "https://www.bilibili.com/"},
        )
        data = response.json()
        code = data.get("data", {}).get("code")
        if code == 0 and data["data"].get("url"):
            token = await client.get(data["data"]["url"])
            cookies = token.cookies.jar
            path = _cookie_path(request)
            path.parent.mkdir(parents=True, exist_ok=True)
            lines = ["# Netscape HTTP Cookie File", "# Generated by PureDown", ""]
            for cookie in cookies:
                lines.append(
                    "\t".join(
                        [
                            cookie.domain or ".bilibili.com",
                            "TRUE",
                            cookie.path or "/",
                            "FALSE",
                            str(cookie.expires or 0),
                            cookie.name,
                            cookie.value or "",
                        ]
                    )
                )
            path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return {"status": "success", "cookiePath": str(path), "message": "登录成功"}
    statuses = {
        86101: ("waiting", "等待扫码"),
        86090: ("scanned", "已扫码，请确认"),
        86038: ("expired", "二维码已过期"),
    }
    status, message = statuses.get(code, ("unknown", "未知状态"))
    return {"status": status, "message": message, "code": code}
