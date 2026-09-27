from fastapi.testclient import TestClient

from app.main import app


def test_health_and_config_do_not_expose_api_key() -> None:
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok", "backend": "python"}
        response = client.get("/api/config/status")
        assert response.status_code == 200
        assert "apiKey" not in response.text
        assert "llmConfigured" in response.json()


def test_analysis_creation_requires_server_side_llm_config() -> None:
    with TestClient(app) as client:
        response = client.post("/api/analyses", json={"url": "https://example.com/video"})
        assert response.status_code == 503
        assert "LLM_API_KEY" in response.json()["detail"]
