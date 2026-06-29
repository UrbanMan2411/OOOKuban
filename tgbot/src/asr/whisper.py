from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from threading import Lock

from loguru import logger

from src.config import settings

_model = None
_lock = Lock()


def _get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                from faster_whisper import WhisperModel  # тяжёлый импорт
                logger.info(
                    f"whisper load: model={settings.whisper_model} "
                    f"device={settings.whisper_device} ct={settings.whisper_compute_type}",
                )
                _model = WhisperModel(
                    settings.whisper_model,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type,
                )
    return _model


def _fmt_ts(seconds: float) -> str:
    return str(timedelta(seconds=int(seconds)))


def transcribe_file(path: Path) -> str:
    """Синхронный transcribe — вызывать через asyncio.to_thread."""
    model = _get_model()
    segments, info = model.transcribe(
        str(path),
        language=settings.whisper_language,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        beam_size=5,
    )
    logger.info(f"whisper: lang={info.language} duration={info.duration:.1f}s")
    lines = [f"# Транскрипт {path.name}", ""]
    for s in segments:
        lines.append(f"[{_fmt_ts(s.start)}] {s.text.strip()}")
    return "\n".join(lines) + "\n"
