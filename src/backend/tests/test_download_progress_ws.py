from fastapi.testclient import TestClient

from app.main import app


def test_download_progress_websocket_sends_current_progress() -> None:
    task_id = "download-in-progress"
    progress = {
        "taskId": task_id,
        "status": "downloading",
        "percent": 42.5,
        "speed": "2.5MiB/s",
        "eta": "00:12",
        "downloaded": "42.5MiB",
        "totalSize": "100MiB",
    }

    with TestClient(app) as client:
        app.state.download_tasks[task_id] = {
            "id": task_id,
            "status": "downloading",
            "progress": progress,
        }

        with client.websocket_connect(f"/ws/progress/{task_id}") as websocket:
            assert websocket.receive_json() == {"type": "progress", "data": progress}


def test_download_progress_websocket_sends_completed_task() -> None:
    task_id = "download-completed"

    with TestClient(app) as client:
        app.state.download_tasks[task_id] = {
            "id": task_id,
            "title": "Example video",
            "status": "completed",
            "outputPath": "/tmp/downloads",
            "filename": "example.mp4",
            "progress": None,
        }

        with client.websocket_connect(f"/ws/progress/{task_id}") as websocket:
            assert websocket.receive_json() == {
                "type": "complete",
                "data": {
                    "taskId": task_id,
                    "filePath": "/tmp/downloads/example.mp4",
                    "filename": "example.mp4",
                },
            }


def test_download_progress_websocket_rejects_unknown_task() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws/progress/missing") as websocket:
            assert websocket.receive_json() == {
                "type": "error",
                "data": {"taskId": "missing", "error": "Task not found"},
            }
