from __future__ import annotations

from pathlib import Path

from aiogram import Bot
from aiogram.types import FSInputFile
from loguru import logger

from src.db import repo

# глобально устанавливается из main.py
_bot: Bot | None = None


def bind_bot(bot: Bot) -> None:
    global _bot
    _bot = bot


def _b() -> Bot:
    assert _bot is not None, "notifier.bind_bot не вызван"
    return _bot


async def remind_todo(todo_id: int, prefix: str = "⏰") -> None:
    todo = await repo.get_todo(todo_id)
    if not todo or todo.status != "open":
        return
    chat = await _b().get_chat(_tg_chat_id := await _resolve_tg_chat_id(todo.chat_id))  # noqa
    assignee_tag = ""
    if todo.assignee_id:
        u = await repo.get_user(todo.assignee_id)
        if u and u.username:
            assignee_tag = f" @{u.username}"
    due = todo.due_at.strftime("%d.%m %H:%M") if todo.due_at else "—"
    await _b().send_message(
        chat.id,
        f"{prefix} #{todo.id}{assignee_tag} дедлайн {due}\n{todo.text}",
    )


async def remind_meeting(meeting_id: int) -> None:
    m = await repo.get_meeting(meeting_id)
    if not m:
        return
    tg_chat_id = await _resolve_tg_chat_id(m.chat_id)
    await _b().send_message(
        tg_chat_id,
        f"🔔 Через 10 минут: <b>{m.title}</b>\n{m.telemost_url}",
        parse_mode="HTML",
    )


async def send_meeting_artifacts(
    meeting_id: int, transcript_path: Path, summary: str,
) -> None:
    m = await repo.get_meeting(meeting_id)
    if not m:
        return
    tg_chat_id = await _resolve_tg_chat_id(m.chat_id)
    await _b().send_message(
        tg_chat_id,
        f"📝 Транскрипт встречи <b>{m.title}</b>",
        parse_mode="HTML",
    )
    try:
        await _b().send_document(tg_chat_id, FSInputFile(transcript_path))
    except Exception as e:
        logger.exception(f"send transcript failed: {e}")
    if summary:
        await _b().send_message(tg_chat_id, summary[:3900])


async def send_text(chat_id: int, text: str, **kw) -> None:
    tg_chat_id = await _resolve_tg_chat_id(chat_id)
    await _b().send_message(tg_chat_id, text, **kw)


async def _resolve_tg_chat_id(chat_id: int) -> int:
    import aiosqlite

    from src.config import settings

    async with aiosqlite.connect(settings.db_path) as db:
        cur = await db.execute("SELECT tg_chat_id FROM chats WHERE id=?", (chat_id,))
        row = await cur.fetchone()
        assert row is not None
        return int(row[0])
