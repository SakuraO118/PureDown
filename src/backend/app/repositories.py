from __future__ import annotations

import json
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import Database
from app.models import Analysis, AnalysisItem
from app.schemas import AnalysisStatus, TranscriptSegment, VideoSummary

ACTIVE_STATUSES = {
    AnalysisStatus.EXTRACTING.value,
    AnalysisStatus.TRANSCRIBING.value,
    AnalysisStatus.SUMMARIZING.value,
}


class AnalysisRepository:
    def __init__(self, database: Database):
        self.database = database

    def create_analysis(
        self,
        *,
        source_url: str,
        title: str,
        items: Iterable[dict],
        generate_playlist_overview: bool,
        kind: str | None = None,
    ) -> Analysis:
        with self.database.session() as session:
            values = list(items)
            analysis = Analysis(
                source_url=source_url,
                title=title,
                kind=kind or ("playlist" if len(values) > 1 else "single"),
                generate_playlist_overview=generate_playlist_overview,
            )
            analysis.items = [AnalysisItem(**value) for value in values]
            session.add(analysis)
            session.commit()
            return self.get_analysis(analysis.id)  # type: ignore[return-value]

    def get_analysis(self, analysis_id: str) -> Analysis | None:
        with self.database.session() as session:
            return session.scalar(
                select(Analysis)
                .where(Analysis.id == analysis_id)
                .options(selectinload(Analysis.items))
            )

    def list_analyses(self, limit: int = 50, offset: int = 0) -> list[Analysis]:
        with self.database.session() as session:
            return list(
                session.scalars(
                    select(Analysis)
                    .options(selectinload(Analysis.items))
                    .order_by(Analysis.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                )
            )

    def update_item_status(
        self,
        item_id: str,
        status: AnalysisStatus,
        *,
        progress: int | None = None,
        error: str | None = None,
    ) -> None:
        with self.database.session() as session:
            item = session.get(AnalysisItem, item_id)
            if not item:
                return
            item.status = status.value
            if progress is not None:
                item.progress = progress
            item.error = error
            session.commit()
            self._refresh_parent(item.analysis_id)

    def save_extraction(
        self,
        item_id: str,
        *,
        source: str,
        segments: list[TranscriptSegment],
        frames: list[dict],
    ) -> None:
        with self.database.session() as session:
            item = session.get(AnalysisItem, item_id)
            if not item:
                return
            item.source = source
            item.transcript_json = json.dumps(
                [segment.model_dump(by_alias=True) for segment in segments], ensure_ascii=False
            )
            item.frames_json = json.dumps(frames, ensure_ascii=False)
            session.commit()

    def save_summary(self, item_id: str, summary: VideoSummary) -> None:
        with self.database.session() as session:
            item = session.get(AnalysisItem, item_id)
            if not item:
                return
            item.summary_json = summary.model_dump_json(by_alias=True)
            item.status = AnalysisStatus.COMPLETED.value
            item.progress = 100
            item.error = None
            session.commit()
            self._refresh_parent(item.analysis_id)

    def save_playlist_overview(self, analysis_id: str, overview_json: str) -> None:
        with self.database.session() as session:
            analysis = session.get(Analysis, analysis_id)
            if analysis:
                analysis.playlist_overview_json = overview_json
                session.commit()

    def get_item(self, item_id: str) -> AnalysisItem | None:
        with self.database.session() as session:
            return session.get(AnalysisItem, item_id)

    def copy_cached_result(self, item_id: str, source_url: str) -> bool:
        with self.database.session() as session:
            cached = session.scalar(
                select(AnalysisItem)
                .where(
                    AnalysisItem.source_url == source_url,
                    AnalysisItem.status == AnalysisStatus.COMPLETED.value,
                    AnalysisItem.id != item_id,
                )
                .order_by(AnalysisItem.updated_at.desc())
            )
            target = session.get(AnalysisItem, item_id)
            if not cached or not target or not cached.transcript_json or not cached.summary_json:
                return False
            target.source = cached.source
            target.transcript_json = cached.transcript_json
            target.summary_json = cached.summary_json
            target.frames_json = cached.frames_json
            target.status = AnalysisStatus.COMPLETED.value
            target.progress = 100
            target.error = None
            analysis_id = target.analysis_id
            session.commit()
            self._refresh_parent(analysis_id)
            return True

    def retry_item(self, item_id: str) -> str | None:
        with self.database.session() as session:
            item = session.get(AnalysisItem, item_id)
            if not item or item.status != AnalysisStatus.FAILED.value:
                return None
            item.status = AnalysisStatus.QUEUED.value
            item.progress = 0
            item.error = None
            analysis_id = item.analysis_id
            session.commit()
            self._refresh_parent(analysis_id)
            return analysis_id

    def recover_interrupted(self) -> int:
        with self.database.session() as session:
            items = list(
                session.scalars(
                    select(AnalysisItem).where(AnalysisItem.status.in_(ACTIVE_STATUSES))
                )
            )
            for item in items:
                item.status = AnalysisStatus.QUEUED.value
                item.progress = 0
                item.error = "服务重启，任务已重新排队"
            if items:
                session.commit()
                for analysis_id in {item.analysis_id for item in items}:
                    self._refresh_parent(analysis_id)
            return len(items)

    def queued_analysis_ids(self) -> list[str]:
        with self.database.session() as session:
            return list(
                session.scalars(
                    select(AnalysisItem.analysis_id)
                    .where(AnalysisItem.status == AnalysisStatus.QUEUED.value)
                    .distinct()
                )
            )

    def _refresh_parent(self, analysis_id: str) -> None:
        with self.database.session() as session:
            analysis = session.scalar(
                select(Analysis)
                .where(Analysis.id == analysis_id)
                .options(selectinload(Analysis.items))
            )
            if not analysis or not analysis.items:
                return
            statuses = [item.status for item in analysis.items]
            analysis.progress = round(
                sum(item.progress for item in analysis.items) / len(analysis.items)
            )
            if all(status == AnalysisStatus.COMPLETED.value for status in statuses):
                analysis.status = AnalysisStatus.COMPLETED.value
            elif all(status == AnalysisStatus.FAILED.value for status in statuses):
                analysis.status = AnalysisStatus.FAILED.value
            elif all(
                status in {AnalysisStatus.COMPLETED.value, AnalysisStatus.FAILED.value}
                for status in statuses
            ):
                analysis.status = AnalysisStatus.PARTIAL.value
            elif any(status != AnalysisStatus.QUEUED.value for status in statuses):
                analysis.status = next(
                    (status for status in statuses if status in ACTIVE_STATUSES),
                    AnalysisStatus.QUEUED.value,
                )
            else:
                analysis.status = AnalysisStatus.QUEUED.value
            session.commit()
