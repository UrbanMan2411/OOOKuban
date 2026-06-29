from __future__ import annotations

from openai import AsyncOpenAI

from src.config import settings

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
    return _client


SUMMARY_PROMPT = """Ты ассистент, который пишет краткое резюме рабочей встречи.

На входе — сырая расшифровка звонка на русском. Сделай:

1. **TL;DR** (2-3 предложения) — о чём встреча, что решили.
2. **Ключевые темы** (буллетами).
3. **Решения** — кто что решил.
4. **Задачи** — список action items в формате:
   - [ ] что сделать — ответственный (если упомянут) — дедлайн (если упомянут)

Отвечай Markdown, без воды и без приветствий. Если из транскрипта чего-то не следует — не выдумывай.
Длина: до 600 слов."""


async def summarize_transcript(transcript: str) -> str:
    client = _get_client()
    resp = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SUMMARY_PROMPT},
            {"role": "user", "content": transcript[:120_000]},
        ],
        temperature=0.2,
    )
    return resp.choices[0].message.content or ""
