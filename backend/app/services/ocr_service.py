"""CivicAid OCR Service — Text extraction from PDFs and images"""
import io
import time
import logging
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
import PyPDF2
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)
pytesseract.pytesseract.tesseract_cmd = settings.tesseract_path
TESSERACT_CONFIG = "--oem 3 --psm 6 -l tam+eng"


def preprocess_image(image: Image.Image) -> Image.Image:
    if image.mode != "L":
        image = image.convert("L")
    w, h = image.size
    if w < 1000:
        scale = 1000 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(2.0)
    image = image.filter(ImageFilter.SHARPEN)
    image = image.point(lambda p: 255 if p > 128 else 0, "1").convert("L")
    return image


def extract_text_from_image(image_bytes: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        processed = preprocess_image(image)
        return pytesseract.image_to_string(processed, config=TESSERACT_CONFIG).strip()
    except Exception as e:
        logger.error(f"Image OCR failed: {e}")
        return ""


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    texts = []
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            texts.append(page.extract_text() or "")
        combined = "\n".join(texts).strip()
        if len(combined) > 100:
            return combined
    except Exception as e:
        logger.warning(f"Digital PDF extraction failed: {e}")
    # Fallback: OCR the PDF pages
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, dpi=200)
        ocr_texts = []
        for img in images[:5]:
            processed = preprocess_image(img)
            ocr_texts.append(pytesseract.image_to_string(processed, config=TESSERACT_CONFIG))
        return "\n\n".join(ocr_texts).strip()
    except Exception as e:
        logger.warning(f"PDF OCR fallback failed: {e}")
        return "\n".join(texts).strip()


def extract_text(file_bytes: bytes, mime_type: str, filename: str) -> tuple[str, int]:
    start = time.time()
    filename_lower = filename.lower()
    if mime_type == "application/pdf" or filename_lower.endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
    elif mime_type.startswith("image/") or any(filename_lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png")):
        text = extract_text_from_image(file_bytes)
    else:
        text = ""
    elapsed_ms = int((time.time() - start) * 1000)
    return text, elapsed_ms
