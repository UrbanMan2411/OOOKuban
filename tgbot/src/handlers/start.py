from aiogram import Router
from aiogram.filters import CommandStart, Command
from aiogram.types import Message

from src.handlers._common import ensure_user_chat

router = Router()

HELP = """<b>GreenPanda бот</b> — todo, встречи, транскрипты.

<b>Todo</b>
/add <i>текст</i> [@user] [до пт 15:00] — добавить
/list — все открытые
/my — мои
/today — на сегодня
/done <i>id</i>, /cancel <i>id</i>
/assign <i>id</i> @user
/due <i>id</i> завтра 15:00
/edit <i>id</i> новый текст

<b>Встречи</b>
/meet_link <i>https://telemost.ya/…</i> — привязать свою ссылку (в ЛС)
/meet <i>название</i> завтра 14:00 [@host] — назначить
/meet_now <i>название</i> — сейчас
/meetings — ближайшие

<b>Транскрипты</b>
Reply на аудио/видео + /transcribe — распознать
/transcript <i>meeting_id</i> — перезапросить"""


@router.message(CommandStart())
async def cmd_start(msg: Message) -> None:
    await ensure_user_chat(msg)
    await msg.answer(HELP, parse_mode="HTML")


@router.message(Command("help"))
async def cmd_help(msg: Message) -> None:
    await ensure_user_chat(msg)
    await msg.answer(HELP, parse_mode="HTML")
