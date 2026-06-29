from __future__ import annotations

from datetime import datetime
from typing import Callable

from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.config import settings

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        jobstore = SQLAlchemyJobStore(url=f"sqlite:///{settings.db_path}")
        _scheduler = AsyncIOScheduler(
            jobstores={"default": jobstore},
            timezone="Europe/Moscow",
        )
    return _scheduler


def schedule_at(
    func: Callable,
    run_at: datetime,
    *,
    job_id: str,
    args: tuple = (),
    replace: bool = True,
) -> None:
    s = get_scheduler()
    s.add_job(
        func, "date", run_date=run_at, args=list(args),
        id=job_id, replace_existing=replace, misfire_grace_time=300,
    )


def cancel(job_id: str) -> None:
    s = get_scheduler()
    try:
        s.remove_job(job_id)
    except Exception:
        pass
