from __future__ import annotations

import asyncio
import json
from collections import defaultdict

from fastapi import WebSocket

from app.repositories import AnalysisRepository
from app.schemas import AnalysisStatus, VideoSummary
from app.serializers import analysis_response
from app.services.extractor import VideoExtractor
from app.services.llm import LlmService


class AnalysisHub:
    def __init__(self):
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, analysis_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[analysis_id].add(websocket)

    def disconnect(self, analysis_id: str, websocket: WebSocket) -> None:
        self.connections[analysis_id].discard(websocket)

    async def broadcast(self, analysis_id: str, data: dict) -> None:
        stale: list[WebSocket] = []
        for connection in self.connections.get(analysis_id, set()):
            try:
                await connection.send_json(data)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(analysis_id, connection)


class AnalysisTaskManager:
    def __init__(
        self,
        repository: AnalysisRepository,
        extractor: VideoExtractor,
        llm: LlmService,
        hub: AnalysisHub,
        concurrency: int,
    ):
        self.repository = repository
        self.extractor = extractor
        self.llm = llm
        self.hub = hub
        self.semaphore = asyncio.Semaphore(concurrency)
        self.running: set[str] = set()

    def enqueue(self, analysis_id: str) -> None:
        if analysis_id in self.running:
            return
        self.running.add(analysis_id)
        asyncio.create_task(self._run_analysis(analysis_id))

    async def _run_analysis(self, analysis_id: str) -> None:
        try:
            analysis = self.repository.get_analysis(analysis_id)
            if not analysis:
                return
            pending = [
                item for item in analysis.items if item.status == AnalysisStatus.QUEUED.value
            ]
            await asyncio.gather(*(self._run_item(analysis_id, item.id) for item in pending))
            analysis = self.repository.get_analysis(analysis_id)
            if analysis and analysis.generate_playlist_overview:
                completed = [item for item in analysis.items if item.summary_json]
                omitted = [item.title for item in analysis.items if not item.summary_json]
                if completed:
                    summaries = [
                        (item.title, VideoSummary.model_validate_json(item.summary_json))
                        for item in completed
                        if item.summary_json
                    ]
                    try:
                        overview = await self.llm.playlist_overview(
                            analysis.title, summaries, omitted
                        )
                        self.repository.save_playlist_overview(
                            analysis_id, overview.model_dump_json(by_alias=True)
                        )
                    except Exception as exc:
                        fallback = {
                            "overview": f"合集总览生成失败：{exc}",
                            "themes": [],
                            "sequence": [],
                            "omittedItems": omitted,
                        }
                        self.repository.save_playlist_overview(
                            analysis_id, json.dumps(fallback, ensure_ascii=False)
                        )
            await self._broadcast_state(analysis_id)
        finally:
            self.running.discard(analysis_id)

    async def _run_item(self, analysis_id: str, item_id: str) -> None:
        async with self.semaphore:
            item = self.repository.get_item(item_id)
            if not item:
                return
            try:
                if self.repository.copy_cached_result(item_id, item.source_url):
                    await self._broadcast_state(analysis_id)
                    return
                self.repository.update_item_status(item_id, AnalysisStatus.EXTRACTING, progress=10)
                await self._broadcast_state(analysis_id)
                extraction = await asyncio.to_thread(
                    self.extractor.extract,
                    item.source_url,
                    item.id,
                    lambda _stage: self.repository.update_item_status(
                        item_id, AnalysisStatus.TRANSCRIBING, progress=35
                    ),
                )
                self.repository.save_extraction(
                    item_id,
                    source=extraction.source,
                    segments=extraction.segments,
                    frames=extraction.frames,
                )
                self.repository.update_item_status(item_id, AnalysisStatus.SUMMARIZING, progress=65)
                await self._broadcast_state(analysis_id)
                summary = await self.llm.summarize(item.title, extraction.segments)
                if extraction.frames:
                    for chapter in summary.chapters:
                        nearest = min(
                            extraction.frames,
                            key=lambda frame: abs(frame["timestamp"] - chapter.start_seconds),
                        )
                        chapter.frame_id = nearest["id"]
                self.repository.save_summary(item_id, summary)
            except Exception as exc:
                self.repository.update_item_status(
                    item_id, AnalysisStatus.FAILED, progress=100, error=str(exc)
                )
            await self._broadcast_state(analysis_id)

    async def _broadcast_state(self, analysis_id: str) -> None:
        analysis = self.repository.get_analysis(analysis_id)
        if analysis:
            await self.hub.broadcast(
                analysis_id,
                {
                    "type": "analysis",
                    "data": analysis_response(analysis).model_dump(by_alias=True, mode="json"),
                },
            )
