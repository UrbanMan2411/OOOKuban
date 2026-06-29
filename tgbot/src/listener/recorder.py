from __future__ import annotations

import asyncio
import shutil
import signal
from pathlib import Path

from loguru import logger

from src.config import settings


class Recorder:
    """Пишет аудио с macOS-устройства (BlackHole) в wav через ffmpeg avfoundation."""

    def __init__(self, out_path: Path):
        self.out_path = out_path
        self._proc: asyncio.subprocess.Process | None = None

    async def start(self) -> None:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise RuntimeError("ffmpeg не найден (brew install ffmpeg)")
        device = settings.audio_input_device
        # avfoundation формат: ":<audio_idx_or_name>"
        cmd = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "warning",
            "-f", "avfoundation",
            "-i", f":{device}",
            "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
            str(self.out_path),
        ]
        logger.info(f"recorder start: {' '.join(cmd)}")
        self._proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )

    async def stop(self) -> None:
        if not self._proc:
            return
        if self._proc.returncode is None:
            try:
                # graceful: ffmpeg ждёт 'q' на stdin
                if self._proc.stdin:
                    self._proc.stdin.write(b"q")
                    await self._proc.stdin.drain()
                await asyncio.wait_for(self._proc.wait(), timeout=10)
            except asyncio.TimeoutError:
                self._proc.send_signal(signal.SIGTERM)
                try:
                    await asyncio.wait_for(self._proc.wait(), timeout=5)
                except asyncio.TimeoutError:
                    self._proc.kill()
        rc = self._proc.returncode
        logger.info(f"recorder stopped rc={rc}, out={self.out_path}")
