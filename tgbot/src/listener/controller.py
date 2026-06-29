from __future__ import annotations

import asyncio
import time
from pathlib import Path

from loguru import logger

from src.asr.whisper import transcribe_file
from src.config import settings
from src.db import repo
from src.listener.runner import record_and_join
from src.services.llm import summarize_transcript
from src.services.notifier import send_meeting_artifacts, send_text

_running: dict[int, asyncio.Task] = {}


async def _pipeline(meeting_id: int) -> None:
    m = await repo.get_meeting(meeting_id)
    if not m:
        logger.warning(f"meeting {meeting_id} not found")
        return
    try:
        await repo.update_meeting_status(meeting_id, "joining")
        await send_text(
            m.chat_id,
            f"🤖 Захожу в звонок «{m.title}»… (имя: {settings.listener_display_name})",
        )
        rec_path = settings.recordings_dir / f"meeting_{meeting_id}_{int(time.time())}.wav"
        await repo.set_meeting_artifacts(meeting_id, recording_path=str(rec_path))
        await repo.update_meeting_status(meeting_id, "recording")

        await record_and_join(m.telemost_url, rec_path)

        await repo.update_meeting_status(meeting_id, "ended")

        if not rec_path.exists() or rec_path.stat().st_size < 50_000:
            await send_text(m.chat_id, f"⚠️ Звонок «{m.title}»: запись пустая или слишком короткая")
            return

        await send_text(m.chat_id, f"🎧 Распознаю «{m.title}»…")
        transcript = await asyncio.to_thread(transcribe_file, rec_path)
        out = settings.transcripts_dir / f"meeting_{meeting_id}.md"
        out.write_text(transcript, encoding="utf-8")

        summary = ""
        try:
            summary = await summarize_transcript(transcript)
        except Exception as e:
            logger.exception(f"summary failed: {e}")

        await repo.set_meeting_artifacts(
            meeting_id, transcript_path=str(out), summary=summary,
        )
        await send_meeting_artifacts(meeting_id, out, summary)
    except Exception as e:
        logger.exception(f"listener pipeline failed: {e}")
        await repo.update_meeting_status(meeting_id, "failed")
        try:
            await send_text(m.chat_id, f"❌ Listener упал на «{m.title}»: {e}")
        except Exception:
            pass
    finally:
        _running.pop(meeting_id, None)


async def start_listener_for_meeting(meeting_id: int) -> None:
    if meeting_id in _running:
        logger.info(f"meeting {meeting_id}: already running")
        return
    task = asyncio.create_task(_pipeline(meeting_id))
    _running[meeting_id] = task
