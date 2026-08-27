"""1x2 inch thermal label rendering (PDF, monochrome).

QR payloads are compact for reliable scans at this size:
  spools: CRV:S:<spoolman spool id>     bins: CRV:B:<bin name>
The PDF is sized exactly 2x1 in; print at 100% scale from any OS driver.
"""

import io

import segno
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

WIDTH, HEIGHT = 2 * inch, 1 * inch
MARGIN = 0.06 * inch
# QR needs a quiet zone (~4 modules) on every side or scanners misread it.
QR_MARGIN = 0.1 * inch
QR_SIZE = HEIGHT - 2 * QR_MARGIN
TEXT_X = QR_MARGIN + QR_SIZE + 0.06 * inch
TEXT_W = WIDTH - TEXT_X - MARGIN


def _draw_qr(c: canvas.Canvas, payload: str, x: float, y: float, size: float) -> None:
    qr = segno.make(payload, error="m", micro=False)
    matrix = [list(row) for row in qr.matrix]
    n = len(matrix)
    module = size / n
    c.setFillGray(0)
    for row_idx, row in enumerate(matrix):
        for col_idx, dark in enumerate(row):
            if dark:
                c.rect(
                    x + col_idx * module,
                    y + size - (row_idx + 1) * module,
                    module,
                    module,
                    stroke=0,
                    fill=1,
                )


def _fit_text(c: canvas.Canvas, text: str, font: str, max_size: float, max_width: float) -> float:
    size = max_size
    while size > 4 and c.stringWidth(text, font, size) > max_width:
        size -= 0.5
    return size


def _truncate(c: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> str:
    while text and c.stringWidth(text + "…", font, size) > max_width:
        text = text[:-1]
    return text + "…" if text else ""


def _label_canvas() -> tuple[canvas.Canvas, io.BytesIO]:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(WIDTH, HEIGHT))
    return c, buf


def render_spool_label(spool: dict) -> bytes:
    filament = spool.get("filament") or {}
    vendor = (filament.get("vendor") or {}).get("name") or ""
    name = filament.get("name") or "Unknown filament"
    material = filament.get("material") or ""
    color_hex = filament.get("color_hex")
    spool_id = spool["id"]

    c, buf = _label_canvas()
    _draw_qr(c, f"CRV:S:{spool_id}", QR_MARGIN, QR_MARGIN, QR_SIZE)

    y = HEIGHT - MARGIN - 9
    if vendor:
        c.setFont("Helvetica", 6.5)
        c.drawString(TEXT_X, y, _truncate_if_needed(c, vendor, "Helvetica", 6.5))
        y -= 10

    size = _fit_text(c, name, "Helvetica-Bold", 10, TEXT_W)
    c.setFont("Helvetica-Bold", size)
    c.drawString(TEXT_X, y, _truncate_if_needed(c, name, "Helvetica-Bold", size))
    y -= 11

    detail = " · ".join(part for part in (material, f"#{color_hex}" if color_hex else "") if part)
    if detail:
        c.setFont("Helvetica", 7)
        c.drawString(TEXT_X, y, _truncate_if_needed(c, detail, "Helvetica", 7))

    c.setFont("Helvetica", 6)
    c.drawRightString(WIDTH - MARGIN, MARGIN + 1, f"S{spool_id}")

    c.showPage()
    c.save()
    return buf.getvalue()


def render_bin_label(name: str) -> bytes:
    c, buf = _label_canvas()
    _draw_qr(c, f"CRV:B:{name}", QR_MARGIN, QR_MARGIN, QR_SIZE)

    c.setFont("Helvetica", 6.5)
    c.drawString(TEXT_X, HEIGHT - MARGIN - 9, "BIN")

    size = _fit_text(c, name, "Helvetica-Bold", 16, TEXT_W)
    c.setFont("Helvetica-Bold", size)
    c.drawString(TEXT_X, (HEIGHT - size) / 2, _truncate_if_needed(c, name, "Helvetica-Bold", size))

    c.showPage()
    c.save()
    return buf.getvalue()


def _truncate_if_needed(c: canvas.Canvas, text: str, font: str, size: float) -> str:
    if c.stringWidth(text, font, size) <= TEXT_W:
        return text
    return _truncate(c, text, font, size, TEXT_W)
