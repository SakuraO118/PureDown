from app.database import Database
from app.repositories import AnalysisRepository
from app.schemas import AnalysisStatus, TranscriptSegment, VideoSummary


def test_interrupted_jobs_become_queued_for_recovery(tmp_path) -> None:
    database = Database(f"sqlite:///{tmp_path / 'test.db'}")
    database.create_all()
    repo = AnalysisRepository(database)
    job = repo.create_analysis(
        source_url="https://example.com/video",
        title="Video",
        items=[{"source_url": "https://example.com/video", "title": "Video", "position": 1}],
        generate_playlist_overview=False,
    )
    repo.update_item_status(job.items[0].id, AnalysisStatus.SUMMARIZING)
    recovered = repo.recover_interrupted()
    assert recovered == 1
    restored = repo.get_analysis(job.id)
    assert restored is not None
    assert restored.items[0].status == AnalysisStatus.QUEUED


def test_completed_result_is_reused_from_sqlite(tmp_path) -> None:
    database = Database(f"sqlite:///{tmp_path / 'cache.db'}")
    database.create_all()
    repo = AnalysisRepository(database)
    first = repo.create_analysis(
        source_url="https://example.com/video",
        title="Video",
        items=[{"source_url": "https://example.com/video", "title": "Video", "position": 1}],
        generate_playlist_overview=False,
    )
    repo.save_extraction(
        first.items[0].id,
        source="subtitle",
        segments=[TranscriptSegment(start_seconds=0, end_seconds=2, text="hello")],
        frames=[],
    )
    repo.save_summary(first.items[0].id, VideoSummary(overview="summary"))
    second = repo.create_analysis(
        source_url="https://example.com/video",
        title="Video",
        items=[{"source_url": "https://example.com/video", "title": "Video", "position": 1}],
        generate_playlist_overview=False,
    )
    assert repo.copy_cached_result(second.items[0].id, "https://example.com/video") is True
    restored = repo.get_analysis(second.id)
    assert restored is not None
    assert restored.status == AnalysisStatus.COMPLETED


def test_batch_keeps_partial_success(tmp_path) -> None:
    database = Database(f"sqlite:///{tmp_path / 'partial.db'}")
    database.create_all()
    repo = AnalysisRepository(database)
    job = repo.create_analysis(
        source_url="https://example.com/list",
        title="List",
        items=[
            {"source_url": "https://example.com/1", "title": "One", "position": 1},
            {"source_url": "https://example.com/2", "title": "Two", "position": 2},
        ],
        generate_playlist_overview=True,
    )
    repo.save_summary(job.items[0].id, VideoSummary(overview="done"))
    repo.update_item_status(job.items[1].id, AnalysisStatus.FAILED, progress=100, error="boom")
    restored = repo.get_analysis(job.id)
    assert restored is not None
    assert restored.status == AnalysisStatus.PARTIAL
