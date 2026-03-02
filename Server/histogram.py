import numpy as np
from utils import to_grayscale, image_to_base64


# ──────────────────────────────────────────────
# Core helpers
# ──────────────────────────────────────────────

def _compute_channel_hist_cdf(channel: np.ndarray):
    """Return normalised histogram (counts) and CDF [0,1] for a single 2-D uint8 channel."""
    hist, _ = np.histogram(channel.flatten(), bins=256, range=(0, 255))
    cdf = hist.cumsum().astype(np.float64)
    cdf /= cdf[-1]          # normalise to [0, 1]
    return hist.tolist(), cdf.tolist()


def compute_histogram(img: np.ndarray, mode: str) -> dict:
    """
    Compute per-channel histogram + CDF.

    Parameters
    ----------
    img  : RGB (H,W,3) or grayscale (H,W) uint8 array
    mode : "gray" | "rgb"

    Returns
    -------
    {
      "hist": [[...], ...],   # one list per channel
      "cdf":  [[...], ...]
    }
    """
    if mode == "gray":
        gray = to_grayscale(img)
        h, c = _compute_channel_hist_cdf(gray)
        return {"hist": [h], "cdf": [c]}

    # RGB
    hists, cdfs = [], []
    for ch in range(3):
        h, c = _compute_channel_hist_cdf(img[:, :, ch])
        hists.append(h)
        cdfs.append(c)
    return {"hist": hists, "cdf": cdfs}


# ──────────────────────────────────────────────
# Histogram equalisation
# ──────────────────────────────────────────────

def _equalize_channel(channel: np.ndarray) -> np.ndarray:
    hist, _ = np.histogram(channel.flatten(), bins=256, range=(0, 255))
    cdf = hist.cumsum()
    cdf_min = cdf[cdf > 0].min()
    total = channel.size
    lut = np.round((cdf - cdf_min) / (total - cdf_min) * 255).clip(0, 255).astype(np.uint8)
    return lut[channel]


def equalize_histogram(img: np.ndarray, mode: str) -> np.ndarray:
    if mode == "gray":
        gray = to_grayscale(img)
        eq = _equalize_channel(gray)
        # Return as RGB so the front-end can display it uniformly
        return np.stack([eq, eq, eq], axis=-1)

    result = np.zeros_like(img)
    for ch in range(3):
        result[:, :, ch] = _equalize_channel(img[:, :, ch])
    return result


# ──────────────────────────────────────────────
# Normalisation (min-max stretch per channel)
# ──────────────────────────────────────────────

def _normalize_channel(channel: np.ndarray) -> np.ndarray:
    mn, mx = channel.min(), channel.max()
    if mx == mn:
        return np.zeros_like(channel, dtype=np.uint8)
    return ((channel.astype(np.float32) - mn) / (mx - mn) * 255).astype(np.uint8)


def normalize_image(img: np.ndarray, mode: str) -> np.ndarray:
    if mode == "gray":
        gray = to_grayscale(img)
        norm = _normalize_channel(gray)
        return np.stack([norm, norm, norm], axis=-1)

    result = np.zeros_like(img)
    for ch in range(3):
        result[:, :, ch] = _normalize_channel(img[:, :, ch])
    return result


# ──────────────────────────────────────────────
# Main entry-point called by app.py
# ──────────────────────────────────────────────

def process_histogram(img: np.ndarray, mode: str, action: str) -> dict:
    """
    Parameters
    ----------
    img    : RGB uint8 ndarray (H,W,3)
    mode   : "gray" | "rgb"
    action : "none" | "equalize" | "normalize"

    Returns
    -------
    {
      "result_image"   : base64 PNG string,
      "source_hist"    : {"hist": [...], "cdf": [...]},
      "result_hist"    : {"hist": [...], "cdf": [...]}
    }
    """
    # --- source histograms (always on the working colour space) ---
    source_img = to_grayscale(img) if mode == "gray" else img
    source_hist_data = compute_histogram(source_img, mode)

    # --- apply action ---
    if action == "equalize":
        result_img = equalize_histogram(img, mode)
    elif action == "normalize":
        result_img = normalize_image(img, mode)
    else:
        # "none" — just convert to grayscale if needed, keep RGB otherwise
        if mode == "gray":
            gray = to_grayscale(img)
            result_img = np.stack([gray, gray, gray], axis=-1)
        else:
            result_img = img.copy()

    # --- result histograms ---
    result_hist_data = compute_histogram(result_img, mode)

    return {
        "result_image": image_to_base64(result_img),
        "source_hist": source_hist_data,
        "result_hist": result_hist_data,
    }