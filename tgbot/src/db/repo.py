from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import aiosqlite

from src.config import settings
from src.db.models import Chat, Meeting, Todo, User


def _dt(v: str | None) -> datetime | None:
    return datetime.fromisoformat(v) if v else None


def _iso(v: datetime | None) -> str | None:
    return v.isoformat() if v else None


async def init_db() -> None:
    sql = Path(__file__).parent.joinpath("migrations.sql").read_text()
    async with aiosqlite.connect(settings.db_path) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.executescript(sql)
        await db.commit()


def _row_to_user(r: aiosqlite.Row) -> User:
    return User(
        id=r["id"], tg_id=r["tg_id"], username=r["username"],
        full_name=r["full_name"], telemost_url=r["telemost_url"],
    )


def _row_to_chat(r: aiosqlite.Row) -> Chat:
    return Chat(id=r["id"], tg_chat_id=r["tg_chat_id"], title=r["title"])


def _row_to_todo(r: aiosqlite.Row) -> Todo:
    return Todo(
        id=r["id"], chat_id=r["chat_id"], text=r["text"],
        assignee_id=r["assignee_id"], due_at=_dt(r["due_at"]),
        status=r["status"], created_by_id=r["created_by_id"],
        created_at=_dt(r["created_at"]),  # type: ignore[arg-type]
        completed_at=_dt(r["completed_at"]),
    )


def _row_to_meeting(r: aiosqlite.Row) -> Meeting:
    return Meeting(
        id=r["id"], chat_id=r["chat_id"], title=r["title"],
        starts_at=_dt(r["starts_at"]),  # type: ignore[arg-type]
        telemost_url=r["telemost_url"], host_user_id=r["host_user_id"],
        listener_status=r["listener_status"],
        recording_path=r["recording_path"], transcript_path=r["transcript_path"],
        summary=r["summary"], created_by_id=r["created_by_id"],
        created_at=_dt(r["created_at"]),  # type: ignore[arg-type]
    )


class _Conn:
    """Контекстный wrapper: row_factory + auto-commit."""

    async def __aenter__(self) -> aiosqlite.Connection:
        self._db = await aiosqlite.connect(settings.db_path)
        self._db.row_factory = aiosqlite.Row
        return self._db

    async def __aexit__(self, *exc: Any) -> None:
        await self._db.commit()
        await self._db.close()


# ---------- users ----------

async def upsert_user(tg_id: int, username: str | None, full_name: str | None) -> User:
    async with _Conn() as db:
        await db.execute(
            """INSERT INTO users(tg_id, username, full_name) VALUES (?,?,?)
               ON CONFLICT(tg_id) DO UPDATE SET username=excluded.username,
                                                full_name=excluded.full_name""",
            (tg_id, username, full_name),
        )
        cur = await db.execute("SELECT * FROM users WHERE tg_id=?", (tg_id,))
        row = await cur.fetchone()
        assert row is not None
        return _row_to_user(row)


async def get_user_by_tg(tg_id: int) -> User | None:
    async with _Conn() as db:
        cur = await db.execute("SELECT * FROM users WHERE tg_id=?", (tg_id,))
        row = await cur.fetchone()
        return _row_to_user(row) if row else None


async def get_user_by_username(username: str) -> User | None:
    username = username.lstrip("@")
    async with _Conn() as db:
        cur = await db.execute("SELECT * FROM users WHERE username=? COLLATE NOCASE", (username,))
        row = await cur.fetchone()
        return _row_to_user(row) if row else None


async def get_user(user_id: int) -> User | None:
    async with _Conn() as db:
        cur = await db.execute("SELECT * FROM users WHERE id=?", (user_id,))
        row = await cur.fetchone()
        return _row_to_user(row) if row else None


async def set_telemost_url(user_id: int, url: str) -> None:
    async with _Conn() as db:
        await db.execute("UPDATE users SET telemost_url=? WHERE id=?", (url, user_id))


# ---------- chats ----------

async def upsert_chat(tg_chat_id: int, title: str | None) -> Chat:
    async with _Conn() as db:
        await db.execute(
            """INSERT INTO chats(tg_chat_id, title) VALUES (?,?)
               ON CONFLICT(tg_chat_id) DO UPDATE SET title=excluded.title""",
            (tg_chat_id, title),
        )
        cur = await db.execute("SELECT * FROM chats WHERE tg_chat_id=?", (tg_chat_id,))
        row = await cur.fetchone()
        assert row is not None
        return _row_to_chat(row)


# ---------- todos ----------

async def add_todo(
    chat_id: int, text: str, assignee_id: int | None,
    due_at: datetime | None, created_by_id: int,
) -> Todo:
    async with _Conn() as db:
        cur = await db.execute(
            """INSERT INTO todos(chat_id, text, assignee_id, due_at, created_by_id)
               VALUES (?,?,?,?,?)""",
            (chat_id, text, assignee_id, _iso(due_at), created_by_id),
        )
        cur2 = await db.execute("SELECT * FROM todos WHERE id=?", (cur.lastrowid,))
        row = await cur2.fetchone()
        assert row is not None
        return _row_to_todo(row)


async def get_todo(todo_id: int) -> Todo | None:
    async with _Conn() as db:
        cur = await db.execute("SELECT * FROM todos WHERE id=?", (todo_id,))
        row = await cur.fetchone()
        return _row_to_todo(row) if row else None


async def list_todos(chat_id: int, status: str = "open") -> list[Todo]:
    async with _Conn() as db:
        cur = await db.execute(
            "SELECT * FROM todos WHERE chat_id=? AND status=? ORDER BY due_at IS NULL, due_at, id",
            (chat_id, status),
        )
        return [_row_to_todo(r) for r in await cur.fetchall()]


async def list_my_todos(chat_id: int, assignee_id: int) -> list[Todo]:
    async with _Conn() as db:
        cur = await db.execute(
            """SELECT * FROM todos WHERE chat_id=? AND assignee_id=? AND status='open'
               ORDER BY due_at IS NULL, due_at, id""",
            (chat_id, assignee_id),
        )
        return [_row_to_todo(r) for r in await cur.fetchall()]


async def list_today_todos(chat_id: int) -> list[Todo]:
    async with _Conn() as db:
        cur = await db.execute(
            """SELECT * FROM todos WHERE chat_id=? AND status='open'
               AND date(due_at)=date('now','localtime')
               ORDER BY due_at""",
            (chat_id,),
        )
        return [_row_to_todo(r) for r in await cur.fetchall()]


async def update_todo_status(todo_id: int, status: str) -> None:
    async with _Conn() as db:
        completed = _iso(datetime.now()) if status == "done" else None
        await db.execute(
            "UPDATE todos SET status=?, completed_at=? WHERE id=?",
            (status, completed, todo_id),
        )


async def update_todo_text(todo_id: int, text: str) -> None:
    async with _Conn() as db:
        await db.execute("UPDATE todos SET text=? WHERE id=?", (text, todo_id))


async def update_todo_assignee(todo_id: int, assignee_id: int) -> None:
    async with _Conn() as db:
        await db.execute("UPDATE todos SET assignee_id=? WHERE id=?", (assignee_id, todo_id))


async def update_todo_due(todo_id: int, due_at: datetime | None) -> None:
    async with _Conn() as db:
        await db.execute("UPDATE todos SET due_at=? WHERE id=?", (_iso(due_at), todo_id))


# ---------- meetings ----------

async def add_meeting(
    chat_id: int, title: str, starts_at: datetime, telemost_url: str,
    host_user_id: int, created_by_id: int,
) -> Meeting:
    async with _Conn() as db:
        cur = await db.execute(
            """INSERT INTO meetings(chat_id, title, starts_at, telemost_url,
                                    host_user_id, created_by_id)
               VALUES (?,?,?,?,?,?)""",
            (chat_id, title, _iso(starts_at), telemost_url, host_user_id, created_by_id),
        )
        cur2 = await db.execute("SELECT * FROM meetings WHERE id=?", (cur.lastrowid,))
        row = await cur2.fetchone()
        assert row is not None
        return _row_to_meeting(row)


async def get_meeting(meeting_id: int) -> Meeting | None:
    async with _Conn() as db:
        cur = await db.execute("SELECT * FROM meetings WHERE id=?", (meeting_id,))
        row = await cur.fetchone()
        return _row_to_meeting(row) if row else None


async def list_upcoming_meetings(chat_id: int) -> list[Meeting]:
    async with _Conn() as db:
        cur = await db.execute(
            """SELECT * FROM meetings WHERE chat_id=? AND starts_at>=datetime('now')
               ORDER BY starts_at LIMIT 20""",
            (chat_id,),
        )
        return [_row_to_meeting(r) for r in await cur.fetchall()]


async def update_meeting_status(meeting_id: int, status: str) -> None:
    async with _Conn() as db:
        await db.execute(
            "UPDATE meetings SET listener_status=? WHERE id=?", (status, meeting_id),
        )


async def set_meeting_artifacts(
    meeting_id: int,
    recording_path: str | None = None,
    transcript_path: str | None = None,
    summary: str | None = None,
) -> None:
    fields, values = [], []
    if recording_path is not None:
        fields.append("recording_path=?")
        values.append(recording_path)
    if transcript_path is not None:
        fields.append("transcript_path=?")
        values.append(transcript_path)
    if summary is not None:
        fields.append("summary=?")
        values.append(summary)
    if not fields:
        return
    values.append(meeting_id)
    async with _Conn() as db:
        await db.execute(f"UPDATE meetings SET {', '.join(fields)} WHERE id=?", values)
