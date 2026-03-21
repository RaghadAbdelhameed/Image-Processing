import numpy as np
import cv2
from utils import convolve, normalize_img
from canny_detection import canny_edge_detection


def apply_edge(
    gray: np.ndarray,
    method: str,
    canny_mode: str = "automatic",
    low_threshold: int = 50,
    high_threshold: int = 150,
    sigma: float = 1.0,
) -> list[dict[str, any]]:

    if method == "sobel":
        kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
        ky = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]])

    elif method == "prewitt":
        kx = np.array([[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]])
        ky = np.array([[-1, -1, -1], [0, 0, 0], [1, 1, 1]])

    elif method == "roberts":
        kx = np.array([[1, 0], [0, -1]])
        ky = np.array([[0, 1], [-1, 0]])

    elif method == "canny":
        if canny_mode == "manual":
            # ── Pure NumPy implementation, thresholds from sliders ──
            low_ratio  = low_threshold  / 255.0
            high_ratio = high_threshold / 255.0
            edges = canny_edge_detection(
                gray,
                low_ratio=low_ratio,
                high_ratio=high_ratio,
                sigma=sigma,
            )
        else:
            # ── Automatic: original cv2.Canny ───────────────────────
            edges = cv2.Canny(gray, 50, 150)

        return [{"label": "Canny Edge", "image": edges}]

    else:
        raise ValueError(f"Unknown edge method: {method}")

    # Sobel / Prewitt / Roberts
    gx  = convolve(gray, kx)
    gy  = convolve(gray, ky)
    mag = np.sqrt(gx ** 2 + gy ** 2)

    return [
        {"label": "X-Gradient", "image": normalize_img(np.abs(gx))},
        {"label": "Y-Gradient", "image": normalize_img(np.abs(gy))},
        {"label": "Magnitude",  "image": normalize_img(mag)},
    ]