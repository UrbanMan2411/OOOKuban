from dataclasses import dataclass
from datetime import datetime


@dataclass
class User:
    id: int
    tg_id: int
    username: str | None
    full_name: str | None
    telemost_url: str | None


@dataclass
class Chat:
    id: int
    tg_chat_id: int
    title: str | None


@dataclass
class Todo:
    id: int
    chat_id: int
    text: str
    assignee_id: int | None
    due_at: datetime | None
    status: str  # open|done|cancelled
    created_by_id: int
    created_at: datetime
    completed_at: datetime | None


@dataclass
class Meeting:
    id: int
    chat_id: int
    title: str
    starts_at: datetime
    telemost_url: str
    host_user_id: int
    listener_status: str
    recording_path: str | None
    transcript_path: str | None
    summary: str | None
    created_by_id: int
    created_at: datetime
