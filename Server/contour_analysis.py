import numpy as np
from typing import List


# ─────────────────────────────────────────────────────────────────────────────
# Chain Code (Freeman 8-direction)
# ─────────────────────────────────────────────────────────────────────────────
#
#   3  2  1
#   4  *  0
#   5  6  7
#
# Direction mapping: (dx, dy) → code
# ─────────────────────────────────────────────────────────────────────────────

_DIR_TO_CODE = {
    ( 1,  0): 0,
    ( 1, -1): 1,
    ( 0, -1): 2,
    (-1, -1): 3,
    (-1,  0): 4,
    (-1,  1): 5,
    ( 0,  1): 6,
    ( 1,  1): 7,
}

# Step lengths: diagonal moves are √2, straight moves are 1
_CODE_LENGTH = {
    0: 1.0,
    1: np.sqrt(2),
    2: 1.0,
    3: np.sqrt(2),
    4: 1.0,
    5: np.sqrt(2),
    6: 1.0,
    7: np.sqrt(2),
}


def _snap_to_grid(contour: np.ndarray) -> np.ndarray:
    """Round float contour points to integer pixel coordinates."""
    return np.round(contour).astype(np.int32)


def compute_chain_code(contour: List[List[float]]) -> List[int]:
    """
    Compute the Freeman 8-direction chain code for a closed contour.

    Parameters
    ----------
    contour : list of [x, y] float pairs (the final_contour from the snake)

    Returns
    -------
    chain_code : list of ints in [0..7]
    """
    pts = _snap_to_grid(np.array(contour))           # (N, 2) int array
    n   = len(pts)
    codes = []

    for i in range(n):
        p_cur  = pts[i]
        p_next = pts[(i + 1) % n]

        dx = int(p_next[0] - p_cur[0])
        dy = int(p_next[1] - p_cur[1])

        # Normalise to unit step (clamp to –1/0/+1)
        sx = int(np.sign(dx))
        sy = int(np.sign(dy))

        code = _DIR_TO_CODE.get((sx, sy))
        if code is not None:
            codes.append(code)
        # If dx == dy == 0 (duplicate point) we skip

    return codes


# ─────────────────────────────────────────────────────────────────────────────
# Perimeter
# ─────────────────────────────────────────────────────────────────────────────

def compute_perimeter(contour: List[List[float]]) -> float:
    """
    Compute perimeter from the float contour (Euclidean distances).
    More accurate than the chain-code approximation for curved contours.
    """
    pts = np.array(contour, dtype=np.float64)
    n   = len(pts)
    total = 0.0
    for i in range(n):
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        total += np.linalg.norm(p2 - p1)
    return float(total)


def compute_perimeter_from_chain(chain_code: List[int]) -> float:
    """
    Compute perimeter from chain code.
    Straight steps = 1 px, diagonal steps = √2 px.
    """
    return float(sum(_CODE_LENGTH[c] for c in chain_code))


# ─────────────────────────────────────────────────────────────────────────────
# Area  (Shoelace / Green's theorem)
# ─────────────────────────────────────────────────────────────────────────────

def compute_area(contour: List[List[float]]) -> float:
    """
    Compute the area enclosed by the contour using the Shoelace formula.

    Parameters
    ----------
    contour : list of [x, y] float pairs

    Returns
    -------
    area : float (always positive, in pixels²)
    """
    pts = np.array(contour, dtype=np.float64)
    n   = len(pts)
    x   = pts[:, 0]
    y   = pts[:, 1]

    # Shoelace: A = 0.5 * |Σ (x_i * y_{i+1} – x_{i+1} * y_i)|
    x_next = np.roll(x, -1)
    y_next = np.roll(y, -1)
    area   = 0.5 * abs(np.sum(x * y_next - x_next * y))
    return float(area)


# ─────────────────────────────────────────────────────────────────────────────
# Public API (called by the FastAPI route)
# ─────────────────────────────────────────────────────────────────────────────

def analyze_contour(contour: List[List[float]]) -> dict:
    """
    Full contour analysis.

    Parameters
    ----------
    contour : list of [x, y] pairs  (final_contour from run_snake)

    Returns
    -------
    dict with keys:
        chain_code  – List[int]
        perimeter   – float (px)
        area        – float (px²)
    """
    chain_code = compute_chain_code(contour)
    perimeter  = compute_perimeter(contour)          # Euclidean (smoother)
    area       = compute_area(contour)

    return {
        "chain_code": chain_code,
        "perimeter":  round(perimeter, 2),
        "area":       round(area, 2),
    }