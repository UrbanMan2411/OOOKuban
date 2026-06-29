from datetime import datetime

import dateparser

_SETTINGS = {
    "TIMEZONE": "Europe/Moscow",
    "RETURN_AS_TIMEZONE_AWARE": False,
    "PREFER_DATES_FROM": "future",
    "DATE_ORDER": "DMY",
}


def parse_when(text: str) -> datetime | None:
    """Парсит русские/английские датовые выражения.
    «завтра 15:00», «через час», «пт 12:00», «18.05 14:00», «2026-05-18 14:00».
    """
    text = text.strip()
    if not text:
        return None
    return dateparser.parse(text, languages=["ru", "en"], settings=_SETTINGS)


def split_text_and_due(raw: str) -> tuple[str, datetime | None]:
    """Из 'позвонить в лабораторию до пятницы 12:00' вытаскивает (text, due_at).
    Стратегия: ищет ключи «до», «к», «на», «завтра», «сегодня», «через»
    и пытается распарсить хвост.
    """
    raw = raw.strip()
    markers = [" до ", " к ", " на ", " завтра", " сегодня", " через ",
               " послезавтра", " в "]
    best: tuple[str, datetime] | None = None
    for m in markers:
        idx = raw.lower().rfind(m)
        if idx == -1:
            continue
        tail = raw[idx:].strip(" ,")
        # пробуем целиком хвост, а потом без маркера
        for candidate in (tail, tail.split(" ", 1)[-1] if " " in tail else tail):
            dt = parse_when(candidate)
            if dt and dt > datetime.now():
                head = raw[:idx].strip(" ,")
                if head and (best is None or len(head) < len(best[0])):
                    best = (head, dt)
                break
    if best:
        return best
    return raw, None
