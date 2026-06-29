from aiogram import Router

from . import meetings, start, todo, transcribe


def setup_router() -> Router:
    r = Router()
    r.include_router(start.router)
    r.include_router(todo.router)
    r.include_router(meetings.router)
    r.include_router(transcribe.router)
    return r
