"""
CivicAid Document Vault — Feature #3 of Legal Advisor Priority Ranking

The #1 reason rural land cases are lost is missing/damaged paperwork.
This vault lets users securely store copies of Patta, EC, Aadhaar, etc.
tied to their phone number, retrievable any time from any device.

Storage: base64-encoded file bytes in cache (Redis persists to disk;
memory fallback is per-session only — documented clearly in the API).
For production scale, this would move to S3/Cloudflare R2, but for
a free-tier academic deployment this keeps zero additional cost.
"""
import uuid
import base64
import logging
import hashlib
from datetime import datetime
from typing import Optional
from app.services.cache_service import get_cache

logger = logging.getLogger(__name__)

VAULT_TTL = 86400 * 365  # keep vault documents for 1 year
MAX_VAULT_FILE_MB = 5
MAX_DOCS_PER_PHONE = 30  # prevent abuse of free storage


class DocumentVaultService:
    def _encrypt(self, data: bytes, phone: str) -> str:
        """
        Simple XOR-based obfuscation keyed on phone number, then base64.
        This is NOT cryptographically strong encryption — it prevents
        casual inspection of stored bytes but is not a substitute for
        real encryption-at-rest (AES) in a production deployment.
        Documented honestly here rather than overclaiming security.
        """
        key = hashlib.sha256(phone.encode()).digest()
        encrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
        return base64.b64encode(encrypted).decode()

    def _decrypt(self, encoded: str, phone: str) -> bytes:
        key = hashlib.sha256(phone.encode()).digest()
        encrypted = base64.b64decode(encoded)
        return bytes(b ^ key[i % len(key)] for i, b in enumerate(encrypted))

    def upload_document(
        self,
        phone: str,
        title: str,
        doc_type: str,
        file_bytes: bytes,
        content_type: str,
    ) -> dict:
        cache = get_cache()

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
        encrypted_data = self._encrypt(file_bytes, phone)

        meta = {
            "id": doc_id,
            "phone": phone,
            "title": title,
            "doc_type": doc_type,
            "content_type": content_type,
            "uploaded_at": datetime.now().isoformat(),
            "size_bytes": len(file_bytes),
        }

        # Store metadata and encrypted content separately
        cache.set(f"vault:meta:{doc_id}", meta, ttl=VAULT_TTL)
        cache.set(f"vault:data:{doc_id}", encrypted_data, ttl=VAULT_TTL)

        # Add to this phone's document index
        phone_key = f"vault:phone:{phone}"
        doc_ids = cache.get(phone_key) or []
        doc_ids.append(doc_id)
        cache.set(phone_key, doc_ids, ttl=VAULT_TTL)

        logger.info(f"[Vault] Stored document {doc_id} for {phone} ({len(file_bytes)} bytes)")
        return meta

    def list_documents(self, phone: str) -> list[dict]:
        cache = get_cache()
        doc_ids = cache.get(f"vault:phone:{phone}") or []
        docs = []
        for doc_id in doc_ids:
            meta = cache.get(f"vault:meta:{doc_id}")
            if meta:
                docs.append(meta)
        docs.sort(key=lambda d: d["uploaded_at"], reverse=True)
        return docs

    def get_document(self, phone: str, doc_id: str) -> Optional[tuple[dict, bytes]]:
        """Returns (metadata, decrypted_bytes) or None if not found / wrong owner."""
        cache = get_cache()
        meta = cache.get(f"vault:meta:{doc_id}")
        if not meta or meta.get("phone") != phone:
            return None  # prevents cross-user access even with a guessed doc_id

        encrypted_data = cache.get(f"vault:data:{doc_id}")
        if not encrypted_data:
            return None

        decrypted = self._decrypt(encrypted_data, phone)
        return meta, decrypted

    def delete_document(self, phone: str, doc_id: str) -> bool:
        cache = get_cache()
        meta = cache.get(f"vault:meta:{doc_id}")
        if not meta or meta.get("phone") != phone:
            return False  # not found or not owned by this phone

        cache.delete(f"vault:meta:{doc_id}")
        cache.delete(f"vault:data:{doc_id}")

        phone_key = f"vault:phone:{phone}"
        doc_ids = cache.get(phone_key) or []
        doc_ids = [d for d in doc_ids if d != doc_id]
        cache.set(phone_key, doc_ids, ttl=VAULT_TTL)

        logger.info(f"[Vault] Deleted document {doc_id} for {phone}")
        return True


# ── Singleton ─────────────────────────────────────────────────────────────
_vault_service: Optional[DocumentVaultService] = None

def get_vault_service() -> DocumentVaultService:
    global _vault_service
    if _vault_service is None:
        _vault_service = DocumentVaultService()
    return _vault_service
