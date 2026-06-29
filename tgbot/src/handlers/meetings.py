from __future__ import annotations

import re
from datetime import datetime, timedelta

from aiogram import Router
from aiogram.filters import Command, CommandObject
from aiogram.types import Message

from src.config import settings
from src.db import repo
from src.handlers._common import ensure_user_chat
from src.handlers.todo import USERNAME_RE
from src.services.dates import split_text_and_due
from src.services.notifier import remind_meeting
from src.services.scheduler import schedule_at

router = Router()

TELEMOST_RE = re.compile(r"https?://telemost\.(?:yandex\.[a-z]+|360\.yandex\.[a-z]+)/\S+")


@router.message(Command("meet_link"))
async def cmd_meet_link(msg: Message, command: CommandObject) -> None:
    user, _ = await ensure_user_chat(msg)
    arg = (command.args or "").strip()
    m = TELEMOST_RE.search(arg)
    if not m:
        await msg.reply(
            "Пришлите вашу постоянную Telemost-ссылку:\n"
            "<code>/meet_link https://telemost.yandex.ru/j/XXXXX</code>",
            parse_mode="HTML",
        )
        return
    await repo.set_telemost_url(user.id, m.group(0))
    await msg.reply(f"🔗 Сохранил вашу ссылку: {m.group(0)}")


def _schedule_meeting_jobs(meeting_id: int, starts_at: datetime) -> None:
    from src.listener.controller import start_listener_for_meeting

    now = datetime.now()
    if starts_at - timedelta(minutes=10) > now:
        schedule_at(
            remind_meeting, starts_at - timedelta(minutes=10),
            job_id=f"meet:{meeting_id}:remind",
            args=(meeting_id,),
        )
    listener_at = max(starts_at - timedelta(minutes=1), now + timedelta(seconds=10))
    schedule_at(
        start_listener_for_meeting, listener_at,
        job_id=f"meet:{meeting_id}:listener",
        args=(meeting_id,),
    )


async def _create_meeting(msg: Message, raw: str, starts_at: datetime | None) -> None:
    user, chat = await ensure_user_chat(msg)

    # вытащить @host
    host_username = None
    m = USERNAME_RE.search(raw)
    if m:
        host_username = m.group(1)
        raw = (raw[: m.start()] + raw[m.end() :]).strip()

    if not starts_at:
        title, starts_at = split_text_and_due(raw)
    else:
        title = raw

    title = title.strip() or "Без названия"
    if not starts_at:
        await msg.reply("Не понял время. Пример: /meet созвон завтра 14:00")
        return

    host = None
    if host_username:
        host = await repo.get_user_by_username(host_username)
        if not host:
            await msg.reply(f"@{host_username} не писал боту — сделаю встречу на вас")
    if host is None:
        host = user

    telemost_url = host.telemost_url or settings.default_telemost_url
    if not telemost_url:
        await msg.reply(
            f"⚠️ У @{host.username or host.full_name} нет Telemost-ссылки. "
            f"Пусть пришлёт /meet_link <url> или задайте DEFAULT_TELEMOST_URL в .env",
        )
        return

    meeting = await repo.add_meeting(
        chat_id=chat.id, title=title, starts_at=starts_at,
        telemost_url=telemost_url, host_user_id=host.id, created_by_id=user.id,
    )
    _schedule_meeting_jobs(meeting.id, starts_at)
    await msg.reply(
        f"📅 <b>{title}</b>\n"
        f"⏰ {starts_at.strftime('%d.%m %H:%M')}\n"
        f"👤 хост: @{host.username or host.full_name}\n"
        f"🔗 {telemost_url}\n"
        f"<i>Бот зайдёт в звонок и пришлёт транскрипт после завершения.</i>",
        parse_mode="HTML",
    )


@router.message(Command("meet"))
async def cmd_meet(msg: Message, command: CommandObject) -> None:
    raw = (command.args or "").strip()
    if not raw:
        await msg.reply("Использование: /meet <название> завтра 14:00 [@host]")
        return
    await _create_meeting(msg, raw, starts_at=None)


@router.message(Command("meet_now"))
async def cmd_meet_now(msg: Message, command: CommandObject) -> None:
    raw = (command.args or "").strip() or "Срочный созвон"
    await _create_meeting(msg, raw, starts_at=datetime.now() + timedelta(seconds=30))


@router.message(Command("meetings"))
async def cmd_meetings(msg: Message) -> None:
    _, chat = await ensure_user_chat(msg)
    items = await repo.list_upcoming_meetings(chat.id)
    if not items:
        await msg.reply("Ближайших встреч нет")
        return
    lines = []
    for m in items:
        host = await repo.get_user(m.host_user_id)
        lines.append(
            f"<code>#{m.id}</code> {m.starts_at.strftime('%d.%m %H:%M')} "
            f"<b>{m.title}</b> — @{host.username if host else '?'}",
        )
    await msg.reply("\n".join(lines), parse_mode="HTML")
