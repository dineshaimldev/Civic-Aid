import base64
import logging
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import VaultDocumentMeta, VaultUploadResponse, VaultListResponse
from app.services.vault_service import get_vault_service
from app.core.config import get_settings

router   = APIRouter(prefix="/api/vault", tags=["vault"])
logger   = logging.getLogger(__name__)
settings = get_settings()
limiter  = Limiter(key_func=get_remote_address)


@router.post("/upload", response_model=VaultUploadResponse)
@limiter.limit("10/minute")
async def upload_to_vault(
    request: Request,
    file: UploadFile = File(...),
    phone: str = Form(...),
    title: str = Form(...),
    doc_type: str = Form(default="other"),
):
    """
    Securely store a document copy (Patta, EC, Aadhaar, sale deed, etc.)
    tied to the user's phone number. Solves the #1 reason rural land
    cases are lost — missing or damaged paperwork.

    Note: uses obfuscated storage keyed to phone number, not full AES
    encryption. Documented honestly — see vault_service.py docstring.
    """
    data = await file.read()
    try:
        service = get_vault_service()
        meta = service.upload_document(
            phone=phone,
            title=title,
            doc_type=doc_type,
            file_bytes=data,
            content_type=file.content_type or "application/octet-stream",
        )
        return VaultUploadResponse(document=VaultDocumentMeta(**meta))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Vault upload error: {e}")
        raise HTTPException(status_code=500, detail="Could not store document.")


@router.get("/{phone}", response_model=VaultListResponse)
@limiter.limit("30/minute")
async def list_vault_documents(request: Request, phone: str):
    """List all documents stored in a phone number's vault."""
    service = get_vault_service()
    docs = service.list_documents(phone)
    return VaultListResponse(
        documents=[VaultDocumentMeta(**d) for d in docs],
        total_count=len(docs),
    )


@router.get("/{phone}/{doc_id}/download")
@limiter.limit("20/minute")
async def download_vault_document(request: Request, phone: str, doc_id: str):
    """Download a specific document from the vault. Owner-only access."""
    service = get_vault_service()
    result = service.get_document(phone, doc_id)
    if not result:
        raise HTTPException(status_code=404, detail="Document not found.")

    meta, decrypted_bytes = result
    return Response(
        content=decrypted_bytes,
        media_type=meta.get("content_type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{meta["title"]}"'},
    )


@router.delete("/{phone}/{doc_id}")
@limiter.limit("10/minute")
async def delete_vault_document(request: Request, phone: str, doc_id: str):
    """Delete a document from the vault. Owner-only."""
    service = get_vault_service()
    success = service.delete_document(phone, doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or not owned by this phone.")
    return {"deleted": True, "id": doc_id}
