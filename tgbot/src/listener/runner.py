from __future__ import annotations

import asyncio
from pathlib import Path

from loguru import logger
from playwright.async_api import Page, async_playwright

from src.config import settings


async def _try_click_join(page: Page) -> bool:
    """Перебирает возможные селекторы кнопки 'Войти'/'Присоединиться'."""
    candidates = [
        "button:has-text('Присоединиться')",
        "button:has-text('Войти')",
        "button:has-text('Войти как гость')",
        "button:has-text('Continue as guest')",
        "[data-testid='join-button']",
        "button[type='submit']",
    ]
    for sel in candidates:
        try:
            btn = page.locator(sel).first
            if await btn.is_visible(timeout=1500):
                await btn.click()
                logger.info(f"clicked join via: {sel}")
                return True
        except Exception:
            continue
    return False


async def _try_fill_name(page: Page, name: str) -> bool:
    candidates = [
        "input[placeholder*='мя' i]",
        "input[placeholder*='name' i]",
        "input[type='text']",
    ]
    for sel in candidates:
        try:
            inp = page.locator(sel).first
            if await inp.is_visible(timeout=1500):
                await inp.fill(name)
                logger.info(f"filled name via: {sel}")
                return True
        except Exception:
            continue
    return False


async def _is_call_active(page: Page) -> bool:
    """Эвристика: пока в DOM есть индикаторы звонка — считаем активным."""
    indicators = [
        "[aria-label*='микроф' i]",
        "[aria-label*='mic' i]",
        "[data-testid*='leave' i]",
        "button:has-text('Покинуть')",
        "button:has-text('Leave')",
    ]
    for sel in indicators:
        try:
            if await page.locator(sel).first.is_visible(timeout=500):
                return True
        except Exception:
            continue
    return False


async def join_and_watch(
    telemost_url: str,
    on_call_ended: asyncio.Event,
    headless: bool | None = None,
) -> None:
    """Открывает Telemost, заходит гостем, держит вкладку открытой пока идёт звонок."""
    headless = settings.headless if headless is None else headless
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless,
            args=[
                "--use-fake-ui-for-media-stream",  # авто-разрешения камера/мик
                "--auto-accept-camera-and-microphone-capture",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        context = await browser.new_context(
            permissions=["microphone", "camera"],
            locale="ru-RU",
        )
        page = await context.new_page()
        try:
            await page.goto(telemost_url, wait_until="domcontentloaded", timeout=60_000)
            await asyncio.sleep(2)

            await _try_fill_name(page, settings.listener_display_name)
            await asyncio.sleep(1)
            # обычно ещё одна кнопка
            await _try_click_join(page)
            await asyncio.sleep(2)
            await _try_click_join(page)

            # ждём пока звонок завершится или сработает hard cap
            empty_streak = 0
            hard_cap = settings.listener_hard_cap_minutes * 60
            idle_cap = settings.listener_idle_minutes * 60
            elapsed = 0
            while not on_call_ended.is_set():
                await asyncio.sleep(15)
                elapsed += 15
                active = await _is_call_active(page)
                empty_streak = 0 if active else empty_streak + 15
                if empty_streak >= idle_cap:
                    logger.info("listener: idle, exiting")
                    on_call_ended.set()
                    break
                if elapsed >= hard_cap:
                    logger.info("listener: hard cap reached")
                    on_call_ended.set()
                    break
        finally:
            try:
                await context.close()
                await browser.close()
            except Exception:
                pass


async def record_and_join(
    telemost_url: str, recording_path: Path,
) -> Path:
    """Открывает Telemost + параллельно пишет аудио. Возвращает путь к wav."""
    from src.listener.recorder import Recorder

    on_ended = asyncio.Event()
    rec = Recorder(recording_path)
    await rec.start()
    try:
        await join_and_watch(telemost_url, on_ended)
    finally:
        await rec.stop()
    return recording_path
