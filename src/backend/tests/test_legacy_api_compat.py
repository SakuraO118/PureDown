from __future__ import annotations

from http.cookiejar import Cookie
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api import legacy
from app.main import app


class FakeYtDlp:
    def preview(self, url: str) -> dict[str, Any]:
        return {"title": "Example", "entries": []}

    def parse_video(self, url: str) -> dict[str, Any]:
        return {
            "id": "example-id",
            "title": "Example video",
            "description": "",
            "thumbnail": "https://cdn.example.com/cover.jpg",
            "duration": 60,
            "webpageUrl": url,
            "uploader": "Uploader",
            "isPlaylist": False,
            "entries": [],
            "formats": [
                {
                    "id": "best",
                    "ext": "mp4",
                    "resolution": "1920x1080",
                    "height": 1080,
                    "filesize": 1024,
                    "vcodec": "h264",
                    "acodec": "aac",
                    "asr": 44100,
                    "abr": 128,
                    "note": "1080p",
                    "type": "video+audio",
                }
            ],
            "site": "youtube",
        }

    def download_file(self, url: str, format_id: str, output_dir: Path, progress) -> dict[str, str]:
        progress(
            {
                "downloaded_bytes": 512,
                "total_bytes": 1024,
                "_speed_str": "1MiB/s",
                "_eta_str": "00:01",
                "_downloaded_bytes_str": "512B",
                "_total_bytes_str": "1KiB",
            }
        )
        path = output_dir / "example.mp4"
        return {"filePath": str(path), "filename": path.name}


@pytest.fixture
def public_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.security.socket.getaddrinfo",
        lambda *_, **__: [(None, None, None, None, ("8.8.8.8", 0))],
    )


def test_parse_and_background_download_remain_frontend_compatible(public_dns: None) -> None:
    with TestClient(app) as client:
        app.state.ytdlp = FakeYtDlp()
        parsed = client.post("/api/parse", json={"url": "https://example.com/video"})
        assert parsed.status_code == 200
        assert parsed.json()["video"]["formats"][0]["id"] == "best"

        created = client.post(
            "/api/download", json={"url": "https://example.com/video", "formatId": "best"}
        )
        assert created.status_code == 200
        task_id = created.json()["taskId"]

        with client.websocket_connect(f"/ws/progress/{task_id}") as websocket:
            message = websocket.receive_json()
        assert message == {
            "type": "complete",
            "data": {
                "taskId": task_id,
                "filePath": str(app.state.settings.download_dir / "example.mp4"),
                "filename": "example.mp4",
            },
        }
        task = client.get(f"/api/download/{task_id}").json()
        assert task["status"] == "completed"
        assert task["progress"]["percent"] == 100


class FakeResponse:
    def __init__(self, payload: dict[str, Any] | None = None, cookies: list[Cookie] | None = None):
        self._payload = payload or {}
        self.cookies = type("Cookies", (), {"jar": cookies or []})()

    def json(self) -> dict[str, Any]:
        return self._payload


class FakeBilibiliClient:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    async def get(self, url: str, **_: object) -> FakeResponse:
        if url.endswith("/poll"):
            return FakeResponse({"data": {"code": 0, "url": "https://login.example/callback"}})
        cookie = Cookie(
            version=0,
            name="SESSDATA",
            value="test-session",
            port=None,
            port_specified=False,
            domain=".bilibili.com",
            domain_specified=True,
            domain_initial_dot=True,
            path="/",
            path_specified=True,
            secure=True,
            expires=None,
            discard=True,
            comment=None,
            comment_url=None,
            rest={},
            rfc2109=False,
        )
        return FakeResponse(cookies=[cookie])


def test_bilibili_qrcode_login_persists_cookie(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(legacy.httpx, "AsyncClient", lambda **_: FakeBilibiliClient())
    cookie_path = tmp_path / "bilibili-cookies.txt"

    with TestClient(app) as client:
        original_cookie_path = app.state.settings.cookies_file
        app.state.settings.cookies_file = cookie_path
        try:
            response = client.get("/api/bilibili/qrcode/check", params={"key": "test-key"})
            assert response.status_code == 200
            assert response.json()["status"] == "success"
            assert "SESSDATA\ttest-session" in cookie_path.read_text(encoding="utf-8")
            assert client.get("/api/bilibili/status").json()["loggedIn"] is True
        finally:
            app.state.settings.cookies_file = original_cookie_path
