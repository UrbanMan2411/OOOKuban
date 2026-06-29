from __future__ import annotations

import re
from datetime import timedelta

from aiogram import Router
from aiogram.filters import Command, CommandObject
from aiogram.types import Message

from src.db import repo
from src.db.models import Todo
from src.handlers._common import ensure_user_chat
from src.services.dates import parse_when, split_text_and_due
from src.services.notifier import remind_todo
from src.services.scheduler import cancel, schedule_at

router = Router()

USERNAME_RE = re.compile(r"@(\w{3,32})")


def _extract_assignee(text: str) -> tuple[str, str | None]:
    """Достаёт первый @username из текста и возвращает (текст_без_него, username)."""
    m = USERNAME_RE.search(text)
    if not m:
        return text, None
    username = m.group(1)
    cleaned = (text[: m.start()] + text[m.end() :]).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned, username


def _format_todo(t: Todo, assignee_name: str | None) -> str:
    due = t.due_at.strftime("%d.%m %H:%M") if t.due_at else "—"
    who = f" → @{assignee_name}" if assignee_name else ""
    return f"<code>#{t.id}</code> {t.text}{who} <i>(до {due})</i>"


async def _format_list(todos: list[Todo]) -> str:
    if not todos:
        return "Список пуст ✨"
    lines = []
    for t in todos:
        u = await repo.get_user(t.assignee_id) if t.assignee_id else None
        lines.append(_format_todo(t, u.username if u else None))
    return "\n".join(lines)


def _schedule_reminders(todo_id: int, due_at) -> None:
    if not due_at:
        return
    from datetime import datetime
    if due_at > datetime.now() + timedelta(hours=1):
        schedule_at(
            remind_todo, due_at - timedelta(hours=1),
            job_id=f"todo:{todo_id}:h-1", args=(todo_id, "⏰ через час"),
        )
    if due_at > datetime.now():
        schedule_at(
            remind_todo, due_at,
            job_id=f"todo:{todo_id}:due", args=(todo_id, "🔥 дедлайн"),
        )


@router.message(Command("add"))
async def cmd_add(msg: Message, command: CommandObject) -> None:
    user, chat = await ensure_user_chat(msg)
    raw = (command.args or "").strip()
    if not raw:
        await msg.reply("Использование: /add <текст> [@user] [до пт 15:00]")
        return
    text, assignee_username = _extract_assignee(raw)
    text, due_at = split_text_and_due(text)
    assignee_id = None
    if assignee_username:
        u = await repo.get_user_by_username(assignee_username)
        if u:
            assignee_id = u.id
        else:
            await msg.reply(
                f"⚠️ @{assignee_username} не писал боту — добавил без назначения. "
                "Пусть напишет /start и повторите /assign.",
            )
    todo = await repo.add_todo(
        chat_id=chat.id, text=text, assignee_id=assignee_id,
        due_at=due_at, created_by_id=user.id,
    )
    _schedule_reminders(todo.id, due_at)
    u_name = (await repo.get_user(assignee_id)).username if assignee_id else None  # type: ignore[union-attr]
    await msg.reply(_format_todo(todo, u_name), parse_mode="HTML")


@router.message(Command("list"))
async def cmd_list(msg: Message) -> None:
    _, chat = await ensure_user_chat(msg)
    todos = await repo.list_todos(chat.id, status="open")
    await msg.reply(await _format_list(todos), parse_mode="HTML")


@router.message(Command("my"))
async def cmd_my(msg: Message) -> None:
    user, chat = await ensure_user_chat(msg)
    todos = await repo.list_my_todos(chat.id, user.id)
    await msg.reply(await _format_list(todos), parse_mode="HTML")


@router.message(Command("today"))
async def cmd_today(msg: Message) -> None:
    _, chat = await ensure_user_chat(msg)
    todos = await repo.list_today_todos(chat.id)
    await msg.reply(await _format_list(todos), parse_mode="HTML")


async def _set_status(msg: Message, args: str | None, status: str, label: str) -> None:
    await ensure_user_chat(msg)
    try:
        todo_id = int((args or "").strip())
    except ValueError:
        await msg.reply(f"Использование: /{label} <id>")
        return
    todo = await repo.get_todo(todo_id)
    if not todo:
        await msg.reply(f"#{todo_id} не найдено")
        return
    await repo.update_todo_status(todo_id, status)
    cancel(f"todo:{todo_id}:h-1")
    cancel(f"todo:{todo_id}:due")
    icon = "✅" if status == "done" else "🚫"
    await msg.reply(f"{icon} #{todo_id}: {todo.text}")


@router.message(Command("done"))
async def cmd_done(msg: Message, command: CommandObject) -> None:
    await _set_status(msg, command.args, "done", "done")


@router.message(Command("cancel"))
async def cmd_cancel(msg: Message, command: CommandObject) -> None:
    await _set_status(msg, command.args, "cancelled", "cancel")


@router.message(Command("edit"))
async def cmd_edit(msg: Message, command: CommandObject) -> None:
    await ensure_user_chat(msg)
    parts = (command.args or "").strip().split(maxsplit=1)
    if len(parts) != 2 or not parts[0].isdigit():
        await msg.reply("Использование: /edit <id> новый текст")
        return
    todo_id = int(parts[0])
    await repo.update_todo_text(todo_id, parts[1])
    await msg.reply(f"✏️ #{todo_id}: {parts[1]}")


@router.message(Command("assign"))
async def cmd_assign(msg: Message, command: CommandObject) -> None:
    await ensure_user_chat(msg)
    parts = (command.args or "").strip().split()
    if len(parts) != 2 or not parts[0].isdigit():
        await msg.reply("Использование: /assign <id> @user")
        return
    todo_id = int(parts[0])
    username = parts[1].lstrip("@")
    u = await repo.get_user_by_username(username)
    if not u:
        await msg.reply(f"@{username} не писал боту")
        return
    await repo.update_todo_assignee(todo_id, u.id)
    await msg.reply(f"👤 #{todo_id} → @{username}")


@router.message(Command("due"))
async def cmd_due(msg: Message, command: CommandObject) -> None:
    await ensure_user_chat(msg)
    parts = (command.args or "").strip().split(maxsplit=1)
    if len(parts) != 2 or not parts[0].isdigit():
        await msg.reply("Использование: /due <id> завтра 15:00")
        return
    todo_id = int(parts[0])
    due_at = parse_when(parts[1])
    if not due_at:
        await msg.reply("Не понял дату")
        return
    await repo.update_todo_due(todo_id, due_at)
    cancel(f"todo:{todo_id}:h-1")
    cancel(f"todo:{todo_id}:due")
    _schedule_reminders(todo_id, due_at)
    await msg.reply(f"📅 #{todo_id} дедлайн → {due_at.strftime('%d.%m %H:%M')}")
