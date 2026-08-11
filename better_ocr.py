"""
better_ocr.py — Robust timetable image → structured table OCR pipeline.

Pipeline:
  1. Image preprocessing (deskew, upscale, binarize, grid-line removal)
  2. Single-pass OCR on the full image (EasyOCR)
  3. Grid detection via morphology → assign OCR boxes to table cells
  4. Fallback: Y-clustering + X-gap column detection
  5. Structured JSON output (string[][])

Usage:
  python better_ocr.py <image_path> --json
"""

import sys
import json
import os
import math
import warnings

import cv2
import numpy as np

# Suppress noisy warnings from EasyOCR / PyTorch
warnings.filterwarnings("ignore")
os.environ["EASYOCR_LOG_LEVEL"] = "ERROR"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MIN_OCR_CONFIDENCE = 0.20          # below this, discard a detection
UPSCALE_FACTOR = 2                 # default upscale
GRID_LINE_MIN_LENGTH_RATIO = 0.08  # fraction of image width/height for a line
CELL_MIN_AREA_RATIO = 0.0005      # minimum fraction of image area for a cell
ROW_MERGE_RATIO = 0.50             # fraction of median text-height for same-row
COL_GAP_MULTIPLIER = 2.5           # multiple of median char-width to split cols


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_image(path: str):
    """Load image handling unicode paths on Windows."""
    try:
        buf = np.fromfile(path, dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


def _deskew(img: np.ndarray) -> np.ndarray:
    """Correct small rotations (±15°) using Hough line detection."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100,
                            minLineLength=img.shape[1] // 6, maxLineGap=10)
    if lines is None or len(lines) == 0:
        return img

    angles = []
    for line in lines:
        pts = line.flatten()
        if len(pts) < 4:
            continue
        x1, y1, x2, y2 = int(pts[0]), int(pts[1]), int(pts[2]), int(pts[3])
        dx, dy = x2 - x1, y2 - y1
        if abs(dx) < 5:
            continue
        angle = math.degrees(math.atan2(dy, dx))
        if abs(angle) <= 15:
            angles.append(angle)

    if not angles:
        return img

    median_angle = float(np.median(angles))
    if abs(median_angle) < 0.3:
        return img

    h, w = img.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REPLICATE)


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------

def _binarize(gray: np.ndarray) -> np.ndarray:
    """Binarize to white-text-on-black (inverted) using Otsu + adaptive."""
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, otsu = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    adaptive = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY_INV, 31, 15)
    return cv2.bitwise_or(otsu, adaptive)


def _remove_grid_lines(binary: np.ndarray):
    """Detect and subtract horizontal/vertical table grid lines.
    Returns (text_mask, grid_mask) — both inverted (white = foreground)."""
    h, w = binary.shape[:2]
    min_h_len = max(30, int(w * GRID_LINE_MIN_LENGTH_RATIO))
    min_v_len = max(30, int(h * GRID_LINE_MIN_LENGTH_RATIO))

    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (min_h_len, 1))
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, min_v_len))

    h_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel, iterations=1)
    v_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel, iterations=1)

    grid = cv2.add(h_lines, v_lines)
    grid = cv2.dilate(grid, np.ones((3, 3), np.uint8), iterations=1)

    text_mask = cv2.subtract(binary, grid)
    # Slightly bolden text to compensate for grid removal damage
    text_mask = cv2.dilate(text_mask, np.ones((2, 2), np.uint8), iterations=1)

    return text_mask, grid


def preprocess(img: np.ndarray, scale: int = 2):
    """Full preprocess → (ocr_ready_image, grid_mask, scaled_img)."""
    scaled = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(scaled, cv2.COLOR_BGR2GRAY)
    binary = _binarize(gray)
    text_mask, grid_mask = _remove_grid_lines(binary)
    ocr_ready = cv2.bitwise_not(text_mask)  # black text on white bg for OCR
    return ocr_ready, grid_mask, scaled


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------

def _run_easyocr(image: np.ndarray, reader) -> list[dict]:
    """Run EasyOCR and return structured box data."""
    results = reader.readtext(image, paragraph=False)
    boxes = []
    for bbox, text, conf in results:
        text = text.strip()
        if not text or conf < MIN_OCR_CONFIDENCE:
            continue
        x_coords = [p[0] for p in bbox]
        y_coords = [p[1] for p in bbox]
        boxes.append({
            "text": text,
            "cx": sum(x_coords) / 4.0,
            "cy": sum(y_coords) / 4.0,
            "x1": min(x_coords),
            "y1": min(y_coords),
            "x2": max(x_coords),
            "y2": max(y_coords),
            "w": max(x_coords) - min(x_coords),
            "h": max(y_coords) - min(y_coords),
            "conf": conf,
        })
    return boxes


# ---------------------------------------------------------------------------
# Grid cell detection
# ---------------------------------------------------------------------------

def _find_grid_cells(grid_mask: np.ndarray):
    """Find rectangular cells from grid line intersections.
    Returns list of (x, y, w, h) sorted top-to-bottom, left-to-right, or None."""
    h, w = grid_mask.shape[:2]

    # Close small gaps in the grid lines so they form closed rectangles
    kernel = np.ones((5, 5), np.uint8)
    closed = cv2.dilate(grid_mask, kernel, iterations=3)
    closed = cv2.morphologyEx(closed, cv2.MORPH_CLOSE, kernel, iterations=3)

    # Invert: we want the *enclosed areas* (cells) as white regions
    inv = cv2.bitwise_not(closed)

    contours, hierarchy = cv2.findContours(inv, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    min_area = w * h * CELL_MIN_AREA_RATIO
    max_area = w * h * 0.4

    cells = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        x, y, cw, ch = cv2.boundingRect(cnt)
        aspect = cw / max(ch, 1)
        if aspect < 0.2 or aspect > 20:
            continue
        cells.append((x, y, cw, ch))

    if len(cells) < 6:
        return None

    return cells


def _group_cells_into_rows(cells: list[tuple]) -> list[list[tuple]]:
    """Group cells into rows by Y-midpoint clustering."""
    if not cells:
        return []
    cells = sorted(cells, key=lambda c: c[1])
    rows = []
    current_row = [cells[0]]

    for cell in cells[1:]:
        prev_cy = np.mean([c[1] + c[3] / 2 for c in current_row])
        curr_cy = cell[1] + cell[3] / 2
        avg_h = np.mean([c[3] for c in current_row])
        if abs(curr_cy - prev_cy) < avg_h * 0.4:
            current_row.append(cell)
        else:
            rows.append(sorted(current_row, key=lambda c: c[0]))
            current_row = [cell]
    if current_row:
        rows.append(sorted(current_row, key=lambda c: c[0]))

    return rows


def _assign_boxes_to_grid(boxes: list[dict], cells_by_row: list[list[tuple]]) -> list[list[str]]:
    """Assign OCR text boxes to grid cells based on overlap."""
    result = []
    for row_cells in cells_by_row:
        row_texts = []
        for (cx, cy, cw, ch) in row_cells:
            # Find all boxes whose center falls within this cell
            cell_texts = []
            for box in boxes:
                bx, by = box["cx"], box["cy"]
                if cx <= bx <= cx + cw and cy <= by <= cy + ch:
                    cell_texts.append(box)
            # Sort left-to-right within the cell and join
            cell_texts.sort(key=lambda b: b["cx"])
            text = " ".join(b["text"] for b in cell_texts).strip()
            row_texts.append(text)
        if any(t for t in row_texts):
            result.append(row_texts)
    return result


# ---------------------------------------------------------------------------
# Fallback: cluster boxes into rows/columns without grid
# ---------------------------------------------------------------------------

def _cluster_into_rows(boxes: list[dict], median_h: float) -> list[list[dict]]:
    """Cluster OCR boxes into rows by Y-coordinate proximity."""
    if not boxes:
        return []
    y_thresh = max(10, median_h * ROW_MERGE_RATIO)
    sorted_boxes = sorted(boxes, key=lambda b: b["cy"])

    rows = []
    current_row = [sorted_boxes[0]]
    for box in sorted_boxes[1:]:
        avg_cy = np.mean([b["cy"] for b in current_row])
        if abs(box["cy"] - avg_cy) <= y_thresh:
            current_row.append(box)
        else:
            rows.append(sorted(current_row, key=lambda b: b["cx"]))
            current_row = [box]
    if current_row:
        rows.append(sorted(current_row, key=lambda b: b["cx"]))

    return rows


def _detect_column_boundaries(rows: list[list[dict]]):
    """Find consistent column boundaries from X-coordinate gap analysis."""
    if not rows or len(rows) < 2:
        return None

    all_cx = sorted(b["cx"] for row in rows for b in row)
    if len(all_cx) < 6:
        return None

    gaps = [(all_cx[i] - all_cx[i - 1], i) for i in range(1, len(all_cx))]
    if not gaps:
        return None

    median_gap = float(np.median([g[0] for g in gaps]))
    threshold = median_gap * COL_GAP_MULTIPLIER

    boundaries = []
    col_start = all_cx[0]
    for gap_size, idx in sorted(gaps, key=lambda g: g[1]):
        if gap_size > threshold:
            boundaries.append((col_start, all_cx[idx - 1]))
            col_start = all_cx[idx]
    boundaries.append((col_start, all_cx[-1]))

    return boundaries if len(boundaries) >= 2 else None


def _build_from_clustering(boxes: list[dict], median_h: float) -> list[list[str]]:
    """Build string[][] from OCR boxes using row clustering + column assignment."""
    rows = _cluster_into_rows(boxes, median_h)
    col_boundaries = _detect_column_boundaries(rows)

    result = []
    for row_boxes in rows:
        if col_boundaries:
            cols = [""] * len(col_boundaries)
            for box in row_boxes:
                best_col = 0
                best_dist = float("inf")
                for i, (cs, ce) in enumerate(col_boundaries):
                    col_center = (cs + ce) / 2
                    dist = abs(box["cx"] - col_center)
                    if dist < best_dist:
                        best_dist = dist
                        best_col = i
                existing = cols[best_col]
                cols[best_col] = (existing + " " + box["text"]).strip() if existing else box["text"]
            result.append(cols)
        else:
            result.append([b["text"] for b in row_boxes])

    return result


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def process_image(image_path: str, json_only: bool = False):
    """Full OCR pipeline: image → string[][]."""

    img = _load_image(image_path)
    if img is None:
        msg = f"Could not read image: {image_path}"
        print(json.dumps({"error": msg}) if json_only else f"Error: {msg}")
        return None

    # Deskew
    img = _deskew(img)

    # Initialize EasyOCR reader once
    reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    # Preprocess at default scale
    ocr_ready, grid_mask, scaled = preprocess(img, UPSCALE_FACTOR)

    # Run OCR once on the full preprocessed image
    boxes = _run_easyocr(ocr_ready, reader)

    if not boxes:
        # Retry at higher scale
        ocr_ready3, grid_mask3, scaled3 = preprocess(img, 3)
        boxes = _run_easyocr(ocr_ready3, reader)
        if boxes:
            grid_mask = grid_mask3

    if not boxes:
        msg = "No text detected. Please upload a clearer image."
        print(json.dumps({"error": msg}) if json_only else f"Error: {msg}")
        return None

    # Compute stats
    heights = [b["h"] for b in boxes]
    confs = [b["conf"] for b in boxes]
    median_h = float(np.median(heights)) if heights else 30.0
    avg_conf = float(np.mean(confs)) if confs else 0.0

    if avg_conf < MIN_OCR_CONFIDENCE:
        msg = f"OCR confidence too low ({avg_conf:.2f}). Please upload a clearer image."
        print(json.dumps({"error": msg}) if json_only else f"Error: {msg}")
        return None

    # --- Try grid-based cell assignment ---
    structured = None
    cells = _find_grid_cells(grid_mask)
    if cells:
        cells_by_row = _group_cells_into_rows(cells)
        if len(cells_by_row) >= 2:
            structured = _assign_boxes_to_grid(boxes, cells_by_row)
            # Check quality: at least 2 non-empty rows
            non_empty = [r for r in (structured or []) if any(c.strip() for c in r)]
            if len(non_empty) < 2:
                structured = None

    # --- Fallback: clustering ---
    if structured is None:
        structured = _build_from_clustering(boxes, median_h)

    if not structured or len(structured) < 2:
        msg = "Could not extract timetable structure. Please upload a clearer image."
        print(json.dumps({"error": msg}) if json_only else f"Error: {msg}")
        return None

    # Clean up: strip whitespace, remove fully empty rows
    cleaned = []
    for row in structured:
        cleaned_row = [cell.strip() for cell in row]
        if any(c for c in cleaned_row):
            cleaned.append(cleaned_row)

    if json_only:
        print(json.dumps(cleaned))
    else:
        print("\n--- OCR Parsed Table ---")
        for i, row in enumerate(cleaned):
            print(f"Row {i + 1}: " + " | ".join(f"'{c}'" for c in row))

    return cleaned


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

import easyocr  # noqa: E402 — heavy import, keep at bottom

if __name__ == "__main__":
    args = sys.argv[1:]
    json_only = "--json" in args
    if "--json" in args:
        args.remove("--json")

    if not args:
        msg = "No image path provided."
        print(json.dumps({"error": msg}) if json_only else f"Usage: python better_ocr.py <image_path> [--json]")
        sys.exit(1)

    for img_path in args:
        process_image(img_path, json_only)
