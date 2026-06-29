from __future__ import annotations

from aiogram.types import Message

from src.db import repo
from src.db.models import Chat, User


async def ensure_user_chat(msg: Message) -> tuple[User, Chat]:
    assert msg.from_user is not None
    user = await repo.upsert_user(
        tg_id=msg.from_user.id,
        username=msg.from_user.username,
        full_name=msg.from_user.full_name,
    )
    chat = await repo.upsert_chat(tg_chat_id=msg.chat.id, title=msg.chat.title)
    return user, chat
