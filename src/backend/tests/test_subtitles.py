from app.services.subtitles import parse_json3, parse_srt_or_vtt


def test_parse_json3_preserves_timestamps() -> None:
    content = (
        '{"events":[{"tStartMs":1250,"dDurationMs":2000,'
        '"segs":[{"utf8":"hello "},{"utf8":"world"}]}]}'
    )
    segments = parse_json3(content)
    assert segments[0].start_seconds == 1.25
    assert segments[0].end_seconds == 3.25
    assert segments[0].text == "hello world"


def test_parse_vtt_deduplicates_and_preserves_timestamps() -> None:
    content = """WEBVTT

00:00:01.000 --> 00:00:03.500
First line

00:00:03.500 --> 00:00:05.000
First line

00:00:05.000 --> 00:00:08.000
Second <b>line</b>
"""
    segments = parse_srt_or_vtt(content)
    assert [(s.start_seconds, s.end_seconds, s.text) for s in segments] == [
        (1.0, 3.5, "First line"),
        (5.0, 8.0, "Second line"),
    ]
