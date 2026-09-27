from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AnalysisStatus(StrEnum):
    QUEUED = "queued"
    EXTRACTING = "extracting"
    TRANSCRIBING = "transcribing"
    SUMMARIZING = "summarizing"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"


class TranscriptSegment(BaseModel):
    start_seconds: float = Field(alias="startSeconds")
    end_seconds: float = Field(alias="endSeconds")
    text: str

    model_config = ConfigDict(populate_by_name=True)


class FrameInfo(BaseModel):
    id: str
    timestamp: float
    url: str


class SummaryChapter(BaseModel):
    title: str
    start_seconds: float = Field(default=0, alias="startSeconds")
    summary: str
    key_points: list[str] = Field(default_factory=list, alias="keyPoints")
    frame_id: str | None = Field(default=None, alias="frameId")

    model_config = ConfigDict(populate_by_name=True)


class SummaryHighlight(BaseModel):
    text: str
    tags: list[str] = Field(default_factory=list)


class VideoSummary(BaseModel):
    language: str = "zh"
    overview: str
    chapters: list[SummaryChapter] = Field(default_factory=list)
    highlights: list[SummaryHighlight] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)


class PlaylistOverview(BaseModel):
    overview: str
    themes: list[str] = Field(default_factory=list)
    sequence: list[str] = Field(default_factory=list)
    omitted_items: list[str] = Field(default_factory=list, alias="omittedItems")

    model_config = ConfigDict(populate_by_name=True)


class PreviewEntry(BaseModel):
    id: str
    title: str
    url: str
    duration: int = 0
    position: int


class AnalysisPreviewRequest(BaseModel):
    url: str


class AnalysisPreview(BaseModel):
    url: str
    title: str
    kind: str
    duration: int = 0
    entries: list[PreviewEntry] = Field(default_factory=list)
    total_duration: int = Field(default=0, alias="totalDuration")
    over_limit: bool = Field(default=False, alias="overLimit")
    max_items: int = Field(alias="maxItems")

    model_config = ConfigDict(populate_by_name=True)


class CreateAnalysisRequest(BaseModel):
    url: str
    generate_playlist_overview: bool = Field(default=False, alias="generatePlaylistOverview")

    model_config = ConfigDict(populate_by_name=True)


class AnalysisItemResponse(BaseModel):
    id: str
    source_url: str = Field(alias="sourceUrl")
    title: str
    position: int
    status: AnalysisStatus
    progress: int
    source: str | None = None
    error: str | None = None
    summary: VideoSummary | None = None
    frames: list[FrameInfo] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class AnalysisResponse(BaseModel):
    id: str
    source_url: str = Field(alias="sourceUrl")
    title: str
    kind: str
    status: AnalysisStatus
    progress: int
    generate_playlist_overview: bool = Field(alias="generatePlaylistOverview")
    playlist_overview: PlaylistOverview | None = Field(default=None, alias="playlistOverview")
    items: list[AnalysisItemResponse] = Field(default_factory=list)
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ConfigStatus(BaseModel):
    llm_configured: bool = Field(alias="llmConfigured")
    llm_model: str = Field(alias="llmModel")
    whisper_mode: str = Field(alias="whisperMode")
    local_whisper_available: bool = Field(alias="localWhisperAvailable")

    model_config = ConfigDict(populate_by_name=True)


JsonDict = dict[str, Any]
