import numpy as np
from PIL import Image
import io
import base64
import cv2

# Private 2D convolution (used internally)
def _convolve_2d(image: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    iH, iW = image.shape
    kH, kW = kernel.shape
    pad = kH // 2
    padded = np.pad(image, ((pad, pad), (pad, pad)), mode='edge')
    output = np.zeros((iH, iW), dtype=np.float32)
    for y in range(iH):
        for x in range(iW):
            output[y, x] = np.sum(kernel * padded[y:y + kH, x:x + kW])
    return output

# Public convolution - works on GRAY (2D) or RGB (H,W,3)
def convolve(image: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return _convolve_2d(image, kernel)
    if len(image.shape) == 3 and image.shape[2] == 3:
        output = np.zeros_like(image, dtype=np.float32)
        for c in range(3):
            output[:, :, c] = _convolve_2d(image[:, :, c], kernel)
        return output
    raise ValueError("convolve() supports only grayscale (2D) or RGB (H,W,3)")

def resize_to_match(img1: np.ndarray, img2: np.ndarray):
    """Resizes img2 to match the dimensions of img1."""
    h, w = img1.shape[:2]
    return cv2.resize(img2, (w, h))

# Normalize for display
def normalize_img(img: np.ndarray) -> np.ndarray:
    if img.max() > 0:
        return (img / img.max() * 255).astype(np.uint8)
    return np.zeros_like(img, dtype=np.uint8)

# Grayscale 
def to_grayscale(img: np.ndarray) -> np.ndarray:
    if len(img.shape) == 2:
        return img
    return cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

# Base64 converter
def image_to_base64(img: np.ndarray) -> str:
    if len(img.shape) == 2:
        pil_img = Image.fromarray(img, mode='L')
    else:
        pil_img = Image.fromarray(img)
    buff = io.BytesIO()
    pil_img.save(buff, format="PNG")
    return base64.b64encode(buff.getvalue()).decode("utf-8")