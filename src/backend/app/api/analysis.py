from __future__ import annotations

import asyncio
import importlib.util
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from app.schemas import (
    AnalysisPreview,
    AnalysisPreviewRequest,
    AnalysisResponse,
    ConfigStatus,
    CreateAnalysisRequest,
    PreviewEntry,
    TranscriptSegment,
)
from app.security import UnsafeUrlError, validate_public_video_url
from app.serializers import analysis_response, transcript_segments

router = APIRouter()


@router.post("/api/analysis/preview", response_model=AnalysisPreview)
async def preview_analysis(body: AnalysisPreviewRequest, request: Request) -> AnalysisPreview:
    try:
        validate_public_video_url(body.url)
    except UnsafeUrlError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        preview = await asyncio.to_thread(request.app.state.ytdlp.preview, body.url)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    entries = [PreviewEntry(**entry) for entry in preview["entries"]]
    kind = "playlist" if entries else "single"
    if not entries:
        entries = [
            PreviewEntry(
                id="single",
                title=preview["title"],
                url=preview["url"],
                duration=preview["duration"],
                position=1,
            )
        ]
    settings = request.app.state.settings
    return AnalysisPreview(
        url=preview["url"],
        title=preview["title"],
        kind=kind,
        duration=preview["duration"],
        entries=entries,
        total_duration=sum(entry.duration for entry in entries),
        over_limit=len(entries) > settings.playlist_max_items,
        max_items=settings.playlist_max_items,
    )


@router.post("/api/analyses", response_model=AnalysisResponse, status_code=202)
async def create_analysis(body: CreateAnalysisRequest, request: Request) -> AnalysisResponse:
    if not request.app.state.settings.llm_configured:
        raise HTTPException(
            status_code=503,
            detail="视频总结尚未配置，请设置 LLM_API_KEY 和 LLM_MODEL",
        )
    preview = await preview_analysis(AnalysisPreviewRequest(url=body.url), request)
    if preview.over_limit:
        raise HTTPException(
            status_code=400,
            detail=f"播放列表包含 {len(preview.entries)} 项，超过上限 {preview.max_items}",
        )
    repository = request.app.state.analysis_repository
    analysis = repository.create_analysis(
        source_url=preview.url,
        title=preview.title,
        kind=preview.kind,
        items=[
            {"source_url": entry.url, "title": entry.title, "position": entry.position}
            for entry in preview.entries
        ],
        generate_playlist_overview=body.generate_playlist_overview,
    )
    request.app.state.analysis_tasks.enqueue(analysis.id)
    return analysis_response(analysis)


@router.get("/api/analyses", response_model=list[AnalysisResponse])
async def list_analyses(
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[AnalysisResponse]:
    return [
        analysis_response(value)
        for value in request.app.state.analysis_repository.list_analyses(limit, offset)
    ]


@router.get("/api/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: str, request: Request) -> AnalysisResponse:
    analysis = request.app.state.analysis_repository.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="分析任务不存在")
    return analysis_response(analysis)


@router.get(
    "/api/analyses/{analysis_id}/items/{item_id}/transcript",
    response_model=list[TranscriptSegment],
)
async def get_transcript(
    analysis_id: str, item_id: str, request: Request
) -> list[TranscriptSegment]:
    item = request.app.state.analysis_repository.get_item(item_id)
    if not item or item.analysis_id != analysis_id:
        raise HTTPException(status_code=404, detail="分析条目不存在")
    return transcript_segments(item)


@router.post("/api/analyses/{analysis_id}/items/{item_id}/retry", response_model=AnalysisResponse)
async def retry_item(analysis_id: str, item_id: str, request: Request) -> AnalysisResponse:
    recovered_analysis_id = request.app.state.analysis_repository.retry_item(item_id)
    if recovered_analysis_id != analysis_id:
        raise HTTPException(status_code=409, detail="仅失败条目可以重试")
    request.app.state.analysis_tasks.enqueue(analysis_id)
    return await get_analysis(analysis_id, request)


@router.get("/api/analyses/{analysis_id}/frames/{frame_id}")
async def get_frame(analysis_id: str, frame_id: str, request: Request) -> FileResponse:
    analysis = request.app.state.analysis_repository.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="分析任务不存在")
    frames_root = (request.app.state.settings.data_dir / "frames").resolve()
    for item in analysis.items:
        for frame in json.loads(item.frames_json or "[]"):
            if frame.get("id") != frame_id:
                continue
            path = Path(frame.get("path", "")).resolve()
            if not path.is_relative_to(frames_root) or not path.is_file():
                raise HTTPException(status_code=404, detail="关键帧不存在")
            return FileResponse(path, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="关键帧不存在")


@router.get("/api/config/status", response_model=ConfigStatus)
async def config_status(request: Request) -> ConfigStatus:
    settings = request.app.state.settings
    return ConfigStatus(
        llm_configured=settings.llm_configured,
        llm_model=settings.llm_model,
        whisper_mode=settings.whisper_mode,
        local_whisper_available=importlib.util.find_spec("faster_whisper") is not None,
    )


async def analysis_websocket(websocket: WebSocket, analysis_id: str) -> None:
    repository = websocket.app.state.analysis_repository
    analysis = repository.get_analysis(analysis_id)
    if not analysis:
        await websocket.close(code=4404)
        return
    hub = websocket.app.state.analysis_hub
    await hub.connect(analysis_id, websocket)
    await websocket.send_json(
        {
            "type": "analysis",
            "data": analysis_response(analysis).model_dump(by_alias=True, mode="json"),
        }
    )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(analysis_id, websocket)
