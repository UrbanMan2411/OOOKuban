from __future__ import annotations

import asyncio
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from loguru import logger

from src.config import settings
from src.db.repo import init_db
from src.handlers import setup_router
from src.services import notifier
from src.services.scheduler import get_scheduler


async def main() -> None:
    logger.remove()
    logger.add(sys.stderr, level=settings.log_level)

    await init_db()

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    notifier.bind_bot(bot)

    scheduler = get_scheduler()
    scheduler.start()

    dp = Dispatcher()
    dp.include_router(setup_router())

    logger.info("bot starting…")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        scheduler.shutdown(wait=False)
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
