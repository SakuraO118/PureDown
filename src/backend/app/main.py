from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.analysis import analysis_websocket
from app.api.analysis import router as analysis_router
from app.api.legacy import router as legacy_router
from app.config import get_settings
from app.database import Database
from app.repositories import AnalysisRepository
from app.security import UnsafeUrlError
from app.services.extractor import VideoExtractor
from app.services.llm import LlmService
from app.services.task_manager import AnalysisHub, AnalysisTaskManager
from app.services.ytdlp import YtDlpService

settings = get_settings()
database = Database(settings.resolved_database_url)


class SpaStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


def run_migrations() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    config = AlembicConfig(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "migrations"))
    config.set_main_option("sqlalchemy.url", settings.resolved_database_url)
    tables = set(inspect(database.engine).get_table_names())
    if "analyses" in tables and "alembic_version" not in tables:
        command.stamp(config, "head")
        return
    command.upgrade(config, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.download_dir.mkdir(parents=True, exist_ok=True)
    run_migrations()
    repository = AnalysisRepository(database)
    repository.recover_interrupted()
    ytdlp = YtDlpService(settings)
    hub = AnalysisHub()
    tasks = AnalysisTaskManager(
        repository,
        VideoExtractor(settings, ytdlp),
        LlmService(settings),
        hub,
        settings.analysis_max_concurrency,
    )
    app.state.settings = settings
    app.state.ytdlp = ytdlp
    app.state.analysis_repository = repository
    app.state.analysis_hub = hub
    app.state.analysis_tasks = tasks
    app.state.download_tasks = {}
    for analysis_id in repository.queued_analysis_ids():
        tasks.enqueue(analysis_id)
    yield


app = FastAPI(title="PureDown API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(legacy_router)
app.include_router(analysis_router)


@app.websocket("/ws/analyses/{analysis_id}")
async def analysis_ws(websocket: WebSocket, analysis_id: str) -> None:
    await analysis_websocket(websocket, analysis_id)


def _download_message(task_id: str, task: dict | None) -> dict | None:
    if task is None:
        return {"type": "error", "data": {"taskId": task_id, "error": "Task not found"}}
    if task.get("status") == "completed":
        filename = str(task.get("filename") or task.get("title") or "")
        file_path = task.get("filePath") or str(Path(task.get("outputPath") or "") / filename)
        return {
            "type": "complete",
            "data": {"taskId": task_id, "filePath": file_path, "filename": filename},
        }
    if task.get("status") == "failed":
        return {
            "type": "error",
            "data": {"taskId": task_id, "error": str(task.get("error") or "Download failed")},
        }
    if task.get("progress"):
        return {"type": "progress", "data": task["progress"]}
    return None


@app.websocket("/ws/progress/{task_id}")
async def download_progress_ws(websocket: WebSocket, task_id: str) -> None:
    await websocket.accept()
    last_payload = ""
    try:
        while True:
            task = websocket.app.state.download_tasks.get(task_id)
            message = _download_message(task_id, task)
            if message is not None:
                payload = json.dumps(message, sort_keys=True)
                if payload != last_payload:
                    await websocket.send_json(message)
                    last_payload = payload
                if message["type"] in {"complete", "error"}:
                    await websocket.close()
                    return
            await asyncio.sleep(0.2)
    except WebSocketDisconnect:
        return


@app.exception_handler(UnsafeUrlError)
async def unsafe_url_handler(_, exc: UnsafeUrlError):
    return JSONResponse(status_code=400, content={"error": str(exc)})


web_dist = Path(__file__).resolve().parents[2] / "web" / "dist"
if web_dist.exists():
    app.mount("/", SpaStaticFiles(directory=web_dist, html=True), name="web")
