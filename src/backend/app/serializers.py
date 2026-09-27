import json

from app.models import Analysis, AnalysisItem
from app.schemas import (
    AnalysisItemResponse,
    AnalysisResponse,
    AnalysisStatus,
    FrameInfo,
    PlaylistOverview,
    TranscriptSegment,
    VideoSummary,
)


def item_response(item: AnalysisItem) -> AnalysisItemResponse:
    summary = VideoSummary.model_validate_json(item.summary_json) if item.summary_json else None
    raw_frames = json.loads(item.frames_json) if item.frames_json else []
    frames = [
        FrameInfo(
            id=frame["id"],
            timestamp=float(frame["timestamp"]),
            url=f"/api/analyses/{item.analysis_id}/frames/{frame['id']}",
        )
        for frame in raw_frames
    ]
    return AnalysisItemResponse(
        id=item.id,
        source_url=item.source_url,
        title=item.title,
        position=item.position,
        status=AnalysisStatus(item.status),
        progress=item.progress,
        source=item.source,
        error=item.error,
        summary=summary,
        frames=frames,
    )


def analysis_response(analysis: Analysis) -> AnalysisResponse:
    overview = (
        PlaylistOverview.model_validate_json(analysis.playlist_overview_json)
        if analysis.playlist_overview_json
        else None
    )
    return AnalysisResponse(
        id=analysis.id,
        source_url=analysis.source_url,
        title=analysis.title,
        kind=analysis.kind,
        status=AnalysisStatus(analysis.status),
        progress=analysis.progress,
        generate_playlist_overview=analysis.generate_playlist_overview,
        playlist_overview=overview,
        items=[item_response(item) for item in analysis.items],
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
    )


def transcript_segments(item: AnalysisItem) -> list[TranscriptSegment]:
    if not item.transcript_json:
        return []
    return [TranscriptSegment.model_validate(value) for value in json.loads(item.transcript_json)]
