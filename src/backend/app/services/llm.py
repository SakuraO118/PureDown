from __future__ import annotations

import json
import re

from openai import AsyncOpenAI
from pydantic import ValidationError

from app.config import Settings
from app.schemas import PlaylistOverview, TranscriptSegment, VideoSummary


class LlmNotConfiguredError(RuntimeError):
    pass


class LlmService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = (
            AsyncOpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)
            if settings.llm_configured
            else None
        )

    async def summarize(self, title: str, segments: list[TranscriptSegment]) -> VideoSummary:
        if not self.client:
            raise LlmNotConfiguredError("未配置 LLM_API_KEY 和 LLM_MODEL")
        chunks = self._chunks(segments)
        if len(chunks) == 1:
            source = chunks[0]
        else:
            partials = []
            for chunk in chunks:
                partials.append(await self._text_completion(self._chunk_prompt(title, chunk)))
            source = "\n\n".join(
                f"分段摘要 {index + 1}:\n{text}" for index, text in enumerate(partials)
            )
        prompt = self._summary_prompt(title, source)
        return await self._validated_completion(prompt, VideoSummary)

    async def playlist_overview(
        self, title: str, summaries: list[tuple[str, VideoSummary]], omitted: list[str]
    ) -> PlaylistOverview:
        source = "\n".join(
            f"- {item_title}: {summary.overview}" for item_title, summary in summaries
        )
        omitted_json = json.dumps(omitted, ensure_ascii=False)
        prompt = f"""你是视频系列编辑。根据逐集摘要生成合集总览。合集：{title}
逐集摘要：
{source}
输出严格 JSON，字段为 overview、themes、sequence、omittedItems。
omittedItems 必须原样使用：{omitted_json}
不要输出 Markdown。"""
        return await self._validated_completion(prompt, PlaylistOverview)

    def _chunks(self, segments: list[TranscriptSegment]) -> list[str]:
        max_chars = max(4_000, self.settings.llm_max_input_tokens * 2)
        chunks: list[str] = []
        current: list[str] = []
        size = 0
        for segment in segments:
            line = f"[{self._time(segment.start_seconds)}] {segment.text}"
            if current and size + len(line) > max_chars:
                chunks.append("\n".join(current))
                current = current[-3:]
                size = sum(len(value) for value in current)
            current.append(line)
            size += len(line)
        if current:
            chunks.append("\n".join(current))
        return chunks

    async def _validated_completion(self, prompt: str, model_type):
        last_error: Exception | None = None
        content = ""
        for attempt in range(2):
            repair = "\n上次输出无法通过 JSON 校验，请只返回符合结构的 JSON。" if attempt else ""
            content = await self._text_completion(prompt + repair)
            try:
                return model_type.model_validate(json.loads(self._extract_json(content)))
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
        raise RuntimeError(f"模型返回无法解析的结构化结果: {last_error}")

    async def _text_completion(self, prompt: str) -> str:
        assert self.client is not None
        response = await self.client.chat.completions.create(
            model=self.settings.llm_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        return response.choices[0].message.content or ""

    @staticmethod
    def _extract_json(content: str) -> str:
        match = re.search(r"\{.*\}", content, re.S)
        return match.group(0) if match else content

    @staticmethod
    def _time(seconds: float) -> str:
        return f"{int(seconds) // 60:02d}:{int(seconds) % 60:02d}"

    @staticmethod
    def _chunk_prompt(title: str, transcript: str) -> str:
        instruction = "保留事实、例子和时间点，不添加原文没有的信息"
        return f"请压缩以下《{title}》字幕，{instruction}：\n{transcript}"

    @staticmethod
    def _summary_prompt(title: str, transcript: str) -> str:
        return f"""你是严谨的视频内容编辑。依据字幕生成结构化总结，不得编造。
视频标题：{title}
字幕或分段摘要：
{transcript}

输出严格 JSON，不要 Markdown，结构为：
{{
  "language":"zh",
  "overview":"完整但精炼的总览",
  "chapters":[{{"title":"章节名","startSeconds":0,"summary":"章节摘要","keyPoints":["要点"],"frameId":null}}],
  "highlights":[{{"text":"亮点","tags":["标签"]}}],
  "questions":["延伸问题"]
}}
startSeconds 必须来自字幕时间点；使用字幕原语言。"""
