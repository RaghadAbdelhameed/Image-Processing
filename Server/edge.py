import numpy as np
import cv2
from utils import convolve, normalize_img

def apply_edge(gray: np.ndarray, method: str) -> list[dict[str, any]]:
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
        edges = cv2.Canny(gray, 50, 150)  # Default thresholds
        return [{"label": "Canny Edge", "image": edges}]
    else:
        raise ValueError("Unknown edge method")
    
    gx = convolve(gray, kx)
    gy = convolve(gray, ky)
    abs_gx = np.abs(gx)
    abs_gy = np.abs(gy)
    mag = np.sqrt(gx**2 + gy**2)
    return [
        {"label": "X-Gradient", "image": normalize_img(abs_gx)},
        {"label": "Y-Gradient", "image": normalize_img(abs_gy)},
        {"label": "Magnitude", "image": normalize_img(mag)}
    ]