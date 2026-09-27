import html
import json
import re

from app.schemas import TranscriptSegment

TIMING_RE = re.compile(
    r"(?P<start>\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})\s*-->\s*"
    r"(?P<end>\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})"
)


def _seconds(value: str) -> float:
    parts = value.replace(",", ".").split(":")
    if len(parts) == 2:
        minutes, seconds = parts
        return int(minutes) * 60 + float(seconds)
    hours, minutes, seconds = parts
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def _clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def parse_json3(content: str) -> list[TranscriptSegment]:
    data = json.loads(content)
    segments: list[TranscriptSegment] = []
    for event in data.get("events", []):
        text = _clean_text("".join(segment.get("utf8", "") for segment in event.get("segs", [])))
        if not text:
            continue
        start = float(event.get("tStartMs", 0)) / 1000
        duration = float(event.get("dDurationMs", 0)) / 1000
        segments.append(
            TranscriptSegment(start_seconds=start, end_seconds=start + duration, text=text)
        )
    return segments


def parse_srt_or_vtt(content: str) -> list[TranscriptSegment]:
    lines = content.replace("\r\n", "\n").split("\n")
    segments: list[TranscriptSegment] = []
    seen: set[str] = set()
    index = 0
    while index < len(lines):
        match = TIMING_RE.search(lines[index])
        if not match:
            index += 1
            continue
        start = _seconds(match.group("start"))
        end = _seconds(match.group("end"))
        index += 1
        text_lines: list[str] = []
        while index < len(lines) and lines[index].strip():
            text_lines.append(lines[index])
            index += 1
        text = _clean_text(" ".join(text_lines))
        if text and text not in seen:
            seen.add(text)
            segments.append(TranscriptSegment(start_seconds=start, end_seconds=end, text=text))
        index += 1
    return segments


def parse_subtitle(content: str, extension: str) -> list[TranscriptSegment]:
    return parse_json3(content) if extension.lower() == ".json3" else parse_srt_or_vtt(content)
