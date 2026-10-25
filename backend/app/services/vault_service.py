"""
CivicAid Document Vault — Feature #3 of Legal Advisor Priority Ranking

The #1 reason rural land cases are lost is missing/damaged paperwork.
This vault lets users securely store copies of Patta, EC, Aadhaar, etc.
tied to their phone number, retrievable any time from any device.

Storage: Fernet-encrypted file bytes in cache (Redis persists to disk;
memory fallback is per-process only). The application secret must be kept
stable so documents remain decryptable after restart.
For production scale, this would move to S3/Cloudflare R2, but for
a free-tier academic deployment this keeps zero additional cost.
"""
import uuid
import base64
import logging
import hashlib
import secrets
from cryptography.fernet import Fernet, InvalidToken
from datetime import datetime
from typing import Optional
from app.services.cache_service import get_cache
from app.services.persistence_service import get_persistence
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

VAULT_TTL = 86400 * 365  # keep vault documents for 1 year
MAX_VAULT_FILE_MB = 5
MAX_DOCS_PER_PHONE = 30  # prevent abuse of free storage


class DocumentVaultService:
    def _fernet(self) -> Fernet:
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.app_secret_key.encode()).digest())
        return Fernet(key)

    def _encrypt(self, data: bytes) -> str:
        return self._fernet().encrypt(data).decode()

    def _decrypt(self, encoded: str) -> bytes:
        return self._fernet().decrypt(encoded.encode())

    def _token_key(self, phone: str) -> str:
        return f"vault:token:{hashlib.sha256(phone.encode()).hexdigest()}"

    def issue_access_token(self, phone: str) -> str:
        token = secrets.token_urlsafe(32)
        cache = get_cache()
        cache.set(self._token_key(phone), hashlib.sha256(token.encode()).hexdigest(), ttl=VAULT_TTL)
        return token

    def verify_access_token(self, phone: str, token: str) -> bool:
        stored = get_cache().get(self._token_key(phone))
        return bool(stored and token and secrets.compare_digest(
            stored, hashlib.sha256(token.encode()).hexdigest()
        ))

    def upload_document(
        self,
        phone: str,
        title: str,
        doc_type: str,
        file_bytes: bytes,
        content_type: str,
    ) -> dict:
        persistence = get_persistence()
        # Enforce per-user document limit
        existing = self.list_documents(phone)
        if len(existing) >= MAX_DOCS_PER_PHONE:
            raise ValueError(
                f"Vault limit reached ({MAX_DOCS_PER_PHONE} documents). "
                "Delete an old document before adding a new one."
            )

        if len(file_bytes) > MAX_VAULT_FILE_MB * 1024 * 1024:
            raise ValueError(f"File too large. Max {MAX_VAULT_FILE_MB}MB per document.")

        doc_id = str(uuid.uuid4())[:12]
        encrypted_data = self._encrypt(file_bytes)

        phone_hash = hashlib.sha256(phone.encode()).hexdigest()
        meta = {
            "id": doc_id,
            "phone": phone,
            "title": title,
            "doc_type": doc_type,
            "content_type": content_type,
            "uploaded_at": datetime.now().isoformat(),
            "size_bytes": len(file_bytes),
        }

        persistence.save_vault_document(
            {**meta, "phone_hash": phone_hash},
            encrypted_data,
        )

        logger.info("[Vault] Stored document %s (%s bytes)", doc_id, len(file_bytes))
        return meta

    def list_documents(self, phone: str) -> list[dict]:
        rows = get_persistence().list_vault_documents(hashlib.sha256(phone.encode()).hexdigest())
        return [{**row, "phone": phone} for row in rows]

    def get_document(self, phone: str, doc_id: str) -> Optional[tuple[dict, bytes]]:
        """Returns (metadata, decrypted_bytes) or None if not found / wrong owner."""
        row = get_persistence().get_vault_document(
            hashlib.sha256(phone.encode()).hexdigest(),
            doc_id,
        )
        if not row:
            return None
        meta = {key: row[key] for key in ("id", "title", "doc_type", "content_type", "uploaded_at", "size_bytes")}
        meta["phone"] = phone
        encrypted_data = row["encrypted_data"]

        try:
            decrypted = self._decrypt(encrypted_data)
        except InvalidToken:
            logger.error("Vault decryption failed for document %s", doc_id)
            return None
        return meta, decrypted

    def delete_document(self, phone: str, doc_id: str) -> bool:
        deleted = get_persistence().delete_vault_document(
            hashlib.sha256(phone.encode()).hexdigest(),
            doc_id,
        )
        if not deleted:
            return False

        logger.info("[Vault] Deleted document %s", doc_id)
        return True


# ── Singleton ─────────────────────────────────────────────────────────────
_vault_service: Optional[DocumentVaultService] = None

def get_vault_service() -> DocumentVaultService:
    global _vault_service
    if _vault_service is None:
        _vault_service = DocumentVaultService()
    return _vault_service
