import pytest

from app.security import UnsafeUrlError, validate_public_video_url


@pytest.mark.parametrize(
    "url",
    [
        "file:///tmp/video.mp4",
        "http://127.0.0.1/video",
        "http://localhost/video",
        "http://10.0.0.8/video",
        "ftp://example.com/video",
    ],
)
def test_rejects_non_public_video_urls(url: str) -> None:
    with pytest.raises(UnsafeUrlError):
        validate_public_video_url(url)


def test_accepts_public_https_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.security.socket.getaddrinfo",
        lambda *_, **__: [(None, None, None, None, ("8.8.8.8", 0))],
    )
    assert (
        validate_public_video_url("https://www.youtube.com/watch?v=abc")
        == "https://www.youtube.com/watch?v=abc"
    )
