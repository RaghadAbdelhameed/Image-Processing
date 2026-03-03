import numpy as np
from utils import to_grayscale, image_to_base64


# ──────────────────────────────────────────────
# Core helpers
# ──────────────────────────────────────────────

def _compute_channel_hist_cdf(channel: np.ndarray):
    """
    Compute histogram and normalized CDF for a single 2D uint8 channel.

    Returns:
        hist: list of 256 intensity counts
        cdf : cumulative distribution function normalized to [0, 1]
    """
    # Compute histogram with 256 bins (0–255)
    hist, _ = np.histogram(channel.flatten(), bins=256, range=(0, 255))

    # Compute cumulative distribution function
    cdf = hist.cumsum().astype(np.float64)

    # Normalize CDF to range [0, 1]
    cdf /= cdf[-1]

    return hist.tolist(), cdf.tolist()


def compute_histogram(img: np.ndarray, mode: str) -> dict:
    """
    Compute per-channel histogram and CDF.

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

    # If grayscale mode, convert image to gray first
    if mode == "gray":
        gray = to_grayscale(img)

        # Compute histogram and CDF for single channel
        h, c = _compute_channel_hist_cdf(gray)

        return {"hist": [h], "cdf": [c]}

    # RGB mode — compute per channel
    hists, cdfs = [], []

    # Loop through R, G, B channels
    for ch in range(3):
        h, c = _compute_channel_hist_cdf(img[:, :, ch])
        hists.append(h)
        cdfs.append(c)

    return {"hist": hists, "cdf": cdfs}


# ──────────────────────────────────────────────
# Histogram equalisation
# ──────────────────────────────────────────────

def _equalize_channel(channel: np.ndarray) -> np.ndarray:
    """
    Apply histogram equalization to a single channel using a LUT.
    """

    # Compute histogram
    hist, _ = np.histogram(channel.flatten(), bins=256, range=(0, 255))

    # Compute cumulative distribution
    cdf = hist.cumsum()

    # Get minimum non-zero CDF value (avoids division issues)
    cdf_min = cdf[cdf > 0].min()

    # Total number of pixels
    total = channel.size

    # Build Lookup Table (LUT) using equalization formula
    lut = np.round(
        (cdf - cdf_min) / (total - cdf_min) * 255
    ).clip(0, 255).astype(np.uint8)

    # Map original intensities through LUT
    return lut[channel]


def equalize_histogram(img: np.ndarray, mode: str) -> np.ndarray:
    """
    Apply histogram equalization to the image.
    """

    # Grayscale mode
    if mode == "gray":
        gray = to_grayscale(img)
        eq = _equalize_channel(gray)

        # Return as 3-channel RGB for consistent front-end display
        return np.stack([eq, eq, eq], axis=-1)

    # RGB mode — equalize each channel independently
    result = np.zeros_like(img)

    for ch in range(3):
        result[:, :, ch] = _equalize_channel(img[:, :, ch])

    return result


# ──────────────────────────────────────────────
# Normalisation (min-max stretch per channel)
# ──────────────────────────────────────────────

def _normalize_channel(channel: np.ndarray) -> np.ndarray:
    """
    Apply min-max normalization (contrast stretching) to a single channel.
    """

    mn, mx = channel.min(), channel.max()

    # Avoid division by zero if image is constant
    if mx == mn:
        return np.zeros_like(channel, dtype=np.uint8)

    # Scale intensities to full 0–255 range
    return ((channel.astype(np.float32) - mn) / (mx - mn) * 255).astype(np.uint8)


def normalize_image(img: np.ndarray, mode: str) -> np.ndarray:
    """
    Apply min-max normalization to the image.
    """

    # Grayscale mode
    if mode == "gray":
        gray = to_grayscale(img)
        norm = _normalize_channel(gray)

        # Return as RGB for consistent front-end display
        return np.stack([norm, norm, norm], axis=-1)

    # RGB mode — normalize each channel independently
    result = np.zeros_like(img)

    for ch in range(3):
        result[:, :, ch] = _normalize_channel(img[:, :, ch])

    return result


# ──────────────────────────────────────────────
# Main entry-point called by app.py
# ──────────────────────────────────────────────

def process_histogram(img: np.ndarray, mode: str, action: str) -> dict:
    """
    Main processing function.

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

    # Compute histogram of source image (based on selected mode)
    source_img = to_grayscale(img) if mode == "gray" else img
    source_hist_data = compute_histogram(source_img, mode)

    # Apply selected action
    if action == "equalize":
        result_img = equalize_histogram(img, mode)

    elif action == "normalize":
        result_img = normalize_image(img, mode)

    else:
        # "none" action — optionally convert to grayscale
        if mode == "gray":
            gray = to_grayscale(img)
            result_img = np.stack([gray, gray, gray], axis=-1)
        else:
            result_img = img.copy()

    # Compute histogram of processed image
    result_hist_data = compute_histogram(result_img, mode)

    # Return final response
    return {
        "result_image": image_to_base64(result_img),
        "source_hist": source_hist_data,
        "result_hist": result_hist_data,
    }