CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id           INTEGER UNIQUE NOT NULL,
    username        TEXT,
    full_name       TEXT,
    telemost_url    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_chat_id      INTEGER UNIQUE NOT NULL,
    title           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS todos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id         INTEGER NOT NULL REFERENCES chats(id),
    text            TEXT NOT NULL,
    assignee_id     INTEGER REFERENCES users(id),
    due_at          TEXT,
    status          TEXT NOT NULL DEFAULT 'open',  -- open|done|cancelled
    created_by_id   INTEGER NOT NULL REFERENCES users(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_chat_status ON todos(chat_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_assignee_status ON todos(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_at) WHERE status='open';

CREATE TABLE IF NOT EXISTS meetings (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id             INTEGER NOT NULL REFERENCES chats(id),
    title               TEXT NOT NULL,
    starts_at           TEXT NOT NULL,
    telemost_url        TEXT NOT NULL,
    host_user_id        INTEGER NOT NULL REFERENCES users(id),
    listener_status     TEXT NOT NULL DEFAULT 'planned',
        -- planned|joining|recording|ended|failed|skipped
    recording_path      TEXT,
    transcript_path     TEXT,
    summary             TEXT,
    created_by_id       INTEGER NOT NULL REFERENCES users(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meetings_chat ON meetings(chat_id, starts_at);
