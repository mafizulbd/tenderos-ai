"""OCR fallback for scanned PDFs in deps.extract_text_from_file.

Gemini is never called for real here — hermes_client.ocr_pdf_with_gemini is mocked,
since a real call needs network + a valid GEMINI_API_KEY.
"""

from unittest.mock import patch

import fitz

from deps import extract_text_from_file


def _pdf_bytes(text: str | None) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    if text:
        page.insert_text((72, 72), text)
    return doc.tobytes()


def test_scanned_pdf_with_no_text_layer_falls_back_to_ocr():
    content = _pdf_bytes(None)  # blank page, no text layer -> looks "scanned"

    with patch("hermes_client.ocr_pdf_with_gemini", return_value="OCR TRANSCRIBED TEXT") as mock_ocr:
        result = extract_text_from_file("scanned.pdf", content)

    mock_ocr.assert_called_once()
    assert result == "OCR TRANSCRIBED TEXT"


def test_normal_pdf_with_text_layer_skips_ocr():
    content = _pdf_bytes(
        "This is a normal tender document with a real embedded text layer, "
        "plenty of characters, well above the OCR fallback threshold."
    )

    with patch("hermes_client.ocr_pdf_with_gemini") as mock_ocr:
        result = extract_text_from_file("normal.pdf", content)

    mock_ocr.assert_not_called()
    assert "tender document" in result


def test_ocr_failure_falls_back_to_original_near_empty_text():
    content = _pdf_bytes(None)

    with patch("hermes_client.ocr_pdf_with_gemini", side_effect=RuntimeError("gemini down")):
        result = extract_text_from_file("scanned.pdf", content)

    assert result.strip() == ""
