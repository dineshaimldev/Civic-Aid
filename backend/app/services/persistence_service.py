"""Small durable repository boundary for sensitive CivicAid records.

SQLite is supported for local development and tests. Production must use a
managed database URL; the service deliberately refuses unsupported URLs
instead of silently falling back to process memory.
"""
import json
import logging
import sqlite3
from pathlib import Path
from threading import RLock
from typing import Optional
from urllib.parse import urlparse

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
_lock = RLock()


def _sqlite_path() -> str:
    parsed = urlparse(settings.database_url)
    if parsed.scheme != "sqlite":
        raise RuntimeError("The local persistence repository requires a sqlite DATABASE_URL.")
    raw = parsed.path
    if raw.startswith("/"):
        raw = raw[1:]
    path = Path(raw or "./data/civicaid.db")
    if not path.is_absolute():
        path = Path.cwd() / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


class PersistenceService:
    def __init__(self) -> None:
        self._path = _sqlite_path()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._path, timeout=10)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with _lock, self._connect() as connection:
            connection.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS vault_documents (
                    id TEXT PRIMARY KEY,
                    phone_hash TEXT NOT NULL,
                    title TEXT NOT NULL,
                    doc_type TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    uploaded_at TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    encrypted_data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_vault_phone
                    ON vault_documents(phone_hash, uploaded_at DESC);
                CREATE TABLE IF NOT EXISTS civic_records (
                    namespace TEXT NOT NULL,
                    record_id TEXT NOT NULL,
                    owner_hash TEXT,
                    created_at TEXT NOT NULL,
                    expires_at TEXT,
                    payload TEXT NOT NULL,
                    PRIMARY KEY (namespace, record_id)
                );
                CREATE INDEX IF NOT EXISTS idx_civic_records_owner
                    ON civic_records(namespace, owner_hash, created_at DESC);
                """
            )

    def save_record(
        self,
        namespace: str,
        record_id: str,
        payload: dict,
        created_at: str,
        owner_hash: Optional[str] = None,
        expires_at: Optional[str] = None,
    ) -> None:
        with _lock, self._connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO civic_records
                (namespace, record_id, owner_hash, created_at, expires_at, payload)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (namespace, record_id, owner_hash, created_at, expires_at, json.dumps(payload)),
            )

    def get_record(self, namespace: str, record_id: str) -> Optional[dict]:
        with _lock, self._connect() as connection:
            row = connection.execute(
                "SELECT payload FROM civic_records WHERE namespace = ? AND record_id = ?",
                (namespace, record_id),
            ).fetchone()
        return json.loads(row["payload"]) if row else None

    def list_records(self, namespace: str, owner_hash: Optional[str] = None) -> list[dict]:
        query = "SELECT payload FROM civic_records WHERE namespace = ?"
        parameters: list[str] = [namespace]
        if owner_hash is not None:
            query += " AND owner_hash = ?"
            parameters.append(owner_hash)
        query += " ORDER BY created_at DESC"
        with _lock, self._connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [json.loads(row["payload"]) for row in rows]

    def save_vault_document(self, document: dict, encrypted_data: str) -> None:
        with _lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO vault_documents
                (id, phone_hash, title, doc_type, content_type, uploaded_at, size_bytes, encrypted_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    document["id"],
                    document["phone_hash"],
                    document["title"],
                    document["doc_type"],
                    document["content_type"],
                    document["uploaded_at"],
                    document["size_bytes"],
                    encrypted_data,
                ),
            )

    def list_vault_documents(self, phone_hash: str) -> list[dict]:
        with _lock, self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, title, doc_type, content_type, uploaded_at, size_bytes
                FROM vault_documents
                WHERE phone_hash = ?
                ORDER BY uploaded_at DESC
                """,
                (phone_hash,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_vault_document(self, phone_hash: str, document_id: str) -> Optional[dict]:
        with _lock, self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, title, doc_type, content_type, uploaded_at, size_bytes, encrypted_data
                FROM vault_documents
                WHERE phone_hash = ? AND id = ?
                """,
                (phone_hash, document_id),
            ).fetchone()
        return dict(row) if row else None

    def delete_vault_document(self, phone_hash: str, document_id: str) -> bool:
        with _lock, self._connect() as connection:
            result = connection.execute(
                "DELETE FROM vault_documents WHERE phone_hash = ? AND id = ?",
                (phone_hash, document_id),
            )
            return result.rowcount == 1


_persistence: Optional[PersistenceService] = None


def get_persistence() -> PersistenceService:
    global _persistence
    if _persistence is None:
        _persistence = PersistenceService()
    return _persistence
