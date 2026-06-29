from __future__ import annotations

import asyncio
import time
from pathlib import Path

from aiogram import Bot, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import FSInputFile, Message

from src.asr.whisper import transcribe_file
from src.config import settings
from src.db import repo
from src.handlers._common import ensure_user_chat
from src.services.llm import summarize_transcript

router = Router()


@router.message(Command("transcribe"))
async def cmd_transcribe(msg: Message, bot: Bot) -> None:
    await ensure_user_chat(msg)
    reply = msg.reply_to_message
    if reply is None:
        await msg.reply("Сделайте reply на аудио/видео/голосовое и напишите /transcribe")
        return
    media = (
        reply.voice or reply.audio or reply.video_note or reply.video or reply.document
    )
    if media is None:
        await msg.reply("В replied-сообщении нет аудио/видео")
        return

    file_id = media.file_id
    file_info = await bot.get_file(file_id)
    src_path = settings.recordings_dir / f"upload_{int(time.time())}_{Path(file_info.file_path or 'media').name}"
    await bot.download_file(file_info.file_path, destination=src_path)

    status = await msg.reply("🎧 Распознаю…")
    transcript = await asyncio.to_thread(transcribe_file, src_path)

    out = settings.transcripts_dir / f"{src_path.stem}.md"
    out.write_text(transcript, encoding="utf-8")
    await status.edit_text(f"✅ Готово, символов: {len(transcript)}")
    await msg.reply_document(FSInputFile(out))

    try:
        summary = await summarize_transcript(transcript)
        if summary:
            await msg.reply(summary[:3900])
    except Exception as e:
        await msg.reply(f"⚠️ Саммари не удалось: {e}")


@router.message(Command("transcript"))
async def cmd_transcript(msg: Message, command: CommandObject) -> None:
    await ensure_user_chat(msg)
    try:
        mid = int((command.args or "").strip())
    except ValueError:
        await msg.reply("Использование: /transcript <meeting_id>")
        return
    m = await repo.get_meeting(mid)
    if not m:
        await msg.reply(f"Встреча #{mid} не найдена")
        return
    if m.transcript_path and Path(m.transcript_path).exists():
        await msg.reply_document(FSInputFile(m.transcript_path))
        if m.summary:
            await msg.reply(m.summary[:3900])
        return
    if not m.recording_path or not Path(m.recording_path).exists():
        await msg.reply(f"Записи #{mid} нет")
        return
    status = await msg.reply("🎧 Распознаю запись…")
    transcript = await asyncio.to_thread(transcribe_file, Path(m.recording_path))
    out = settings.transcripts_dir / f"meeting_{mid}.md"
    out.write_text(transcript, encoding="utf-8")
    summary = ""
    try:
        summary = await summarize_transcript(transcript)
    except Exception as e:
        await msg.reply(f"⚠️ Саммари не удалось: {e}")
    await repo.set_meeting_artifacts(mid, transcript_path=str(out), summary=summary)
    await status.edit_text("✅ Готово")
    await msg.reply_document(FSInputFile(out))
    if summary:
        await msg.reply(summary[:3900])
