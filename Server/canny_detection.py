# =============================================================================
#   Pure NumPy Canny Edge Detection 
# =============================================================================

import numpy as np
from utils import gaussian_kernel, convolve


def non_max_suppression(magnitude: np.ndarray, angle: np.ndarray) -> np.ndarray:
    """
    Fully vectorized NMS — zero Python loops over pixels.
    Uses np.where and array slicing instead of per-pixel iteration.
    """
    
    # make all anlges positive and in [0, 180)
    angle = angle % 180
    
    #get image dimensions
    h, w = magnitude.shape
    suppressed = np.zeros_like(magnitude)

    # Pad magnitude so boundary slices are safe
    mag_pad = np.pad(magnitude, 1, mode='constant', constant_values=0)

    # ── Pre-fetch all 8 neighbours at once ───────────────────────────────────
    # Each is a (h, w) array — the neighbour value for every pixel simultaneously
    n_0  = mag_pad[1:h+1, 2:w+2]   # right
    n_45 = mag_pad[2:h+2, 0:w  ]   # bottom-left
    n_90 = mag_pad[2:h+2, 1:w+1]   # bottom
    n_135= mag_pad[2:h+2, 2:w+2]   # bottom-right
    n_180= mag_pad[1:h+1, 0:w  ]   # left
    n_225= mag_pad[0:h,   0:w  ]   # top-left
    n_270= mag_pad[0:h,   1:w+1]   # top
    n_315= mag_pad[0:h,   2:w+2]   # top-right

    # ── Build direction masks (no loop) ──────────────────────────────────────
    # matrix everywhere has the angle of its gradient direction, so we can create boolean masks
    mask_0   = ((angle <  22.5) | (angle >= 157.5))          # horizontal
    mask_45  = ((angle >= 22.5) & (angle <  67.5))           # diagonal /
    mask_90  = ((angle >= 67.5) & (angle < 112.5))           # vertical
    mask_135 = ((angle >= 112.5) & (angle < 157.5))          # diagonal \

    # ── For each direction, select the two neighbours to compare ─────────────
    # q = forward neighbour, r = backward neighbour
    q = np.where(mask_0,   n_0,
        np.where(mask_45,  n_45,
        np.where(mask_90,  n_90,
                           n_135)))

    r = np.where(mask_0,   n_180,
        np.where(mask_45,  n_225,
        np.where(mask_90,  n_270,
                           n_315)))

    # ── Keep pixel only if it's a local maximum along its gradient direction ─
    is_max = (magnitude >= q) & (magnitude >= r)
    suppressed = np.where(is_max, magnitude, 0.0)

    return suppressed


def double_threshold_hysteresis(
    img: np.ndarray, low_ratio: float = 0.05, high_ratio: float = 0.15
) -> np.ndarray:
    """
    Vectorized double threshold + hysteresis using scipy label-based
    connected components — no while loop, no per-pixel iteration.
    """
    from scipy.ndimage import label

    max_magnitude = np.max(img)
    low_thresh  = low_ratio  * max_magnitude
    high_thresh = high_ratio * max_magnitude

    # ── Classify pixels ──────────────────────────────────────────────────────
    strong = img >= high_thresh
    weak   = (img >= low_thresh) & (img < high_thresh)

    # ── Connected components on ALL edge pixels (strong + weak) ──────────────
    # Any component that contains at least one strong pixel is a real edge
    combined         = strong | weak
    structure        = np.ones((3, 3), dtype=int)   # 8-connectivity
    labeled, n_labels = label(combined, structure=structure)

    # ── Find which component labels contain a strong pixel ───────────────────
    strong_labels    = np.unique(labeled[strong])
    strong_labels    = strong_labels[strong_labels != 0]   # exclude background

    # ── Keep only pixels belonging to strong-connected components ────────────
    final = np.isin(labeled, strong_labels)

    return (final * 255).astype(np.uint8)


def canny_edge_detection(
    image: np.ndarray,
    low_ratio: float = 0.05,
    high_ratio: float = 0.15,
    sigma: float = 1.0,
) -> np.ndarray:
    """Pure NumPy Canny — fully vectorized, no Python pixel loops."""

    # Convert to grayscale if color
    if image.ndim == 3 and image.shape[2] in (3, 4):
        image = (
            0.299 * image[..., 0] +
            0.587 * image[..., 1] +
            0.114 * image[..., 2]
        ).astype(np.float64)
    else:
        image = image.astype(np.float64)

    # Normalize to [0, 1]
    image = image / 255.0

    # 1. Gaussian blur
    ksize = int(2 * np.ceil(2 * sigma)) + 1
    if ksize % 2 == 0:
        ksize += 1
    gauss    = gaussian_kernel(ksize, sigma)
    smoothed = convolve(image, gauss).astype(np.float64)

    # 2. Sobel gradients
    sobel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=float)
    sobel_y = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=float)

    gx = convolve(smoothed, sobel_x).astype(np.float64)
    gy = convolve(smoothed, sobel_y).astype(np.float64)

    magnitude = np.hypot(gx, gy)
    angle     = np.arctan2(gy, gx) * (180.0 / np.pi)

    # 3. Non-maximum suppression — vectorized
    nms = non_max_suppression(magnitude, angle)

    # 4. Double threshold + hysteresis — vectorized
    final_edges = double_threshold_hysteresis(nms, low_ratio, high_ratio)

    return final_edges.astype(np.uint8)