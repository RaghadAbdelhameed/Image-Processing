import numpy as np
import cv2
import math
from utils import convolve

def gaussian_kernel(size: int, sigma: float = 1.0) -> np.ndarray:
    kernel = np.zeros((size, size), dtype=np.float32)
    center = size // 2
    s = 2 * sigma ** 2
    total = 0.0
    for i in range(size):
        for j in range(size):
            x = j - center
            y = i - center
            val = math.exp(-(x * x + y * y) / s)
            kernel[i, j] = val
            total += val
    return kernel / total

def median_filter(image: np.ndarray, size: int) -> np.ndarray:
    """Works on grayscale (2D) or RGB (H,W,3)"""
    if size % 2 == 0:
        raise ValueError("Kernel size must be odd")

    if len(image.shape) == 2:  # grayscale
        h, w = image.shape
        pad = size // 2
        padded = np.pad(image, ((pad, pad), (pad, pad)), mode='edge')
        output = np.zeros((h, w), dtype=np.uint8)
        for y in range(h):
            for x in range(w):
                region = padded[y:y + size, x:x + size].flatten()
                output[y, x] = np.median(region)
        return output

    elif len(image.shape) == 3 and image.shape[2] == 3:  # RGB
        output = np.zeros_like(image, dtype=np.uint8)
        for c in range(3):
            output[:, :, c] = median_filter(image[:, :, c], size)  # reuse grayscale version
        return output

    raise ValueError("median_filter supports grayscale or RGB only")


def add_noise(image: np.ndarray, noise_type: str, noise_ratio: float) -> np.ndarray:
    """Works directly on RGB image"""
    if len(image.shape) == 3 and image.shape[2] == 3:
        h, w = image.shape[:2]
    else:
        raise ValueError("add_noise expects RGB image (H,W,3)")

    if noise_type == "gaussian":
        std = noise_ratio * 50
        noisy = image.astype(np.float32).copy()
        for c in range(3):
            noise = np.zeros((h, w), dtype=np.int16)
            cv2.randn(noise, 0, std)
            noisy[:, :, c] += noise.astype(np.float32)
        return np.clip(noisy, 0, 255).astype(np.uint8)

    elif noise_type == "uniform":
        amp = int(noise_ratio * 128)
        noisy = image.astype(np.float32).copy()
        for c in range(3):
            noise = np.zeros((h, w), dtype=np.int16)
            cv2.randu(noise, -amp, amp)
            noisy[:, :, c] += noise.astype(np.float32)
        return np.clip(noisy, 0, 255).astype(np.uint8)

    elif noise_type == "salt&pepper":
        prob = noise_ratio
        noisy = image.copy()
        num_salt = int(prob * h * w / 2)
        num_pepper = int(prob * h * w / 2)
        if num_salt > 0:
            y = np.random.randint(0, h, num_salt)
            x = np.random.randint(0, w, num_salt)
            noisy[y, x] = 255
        if num_pepper > 0:
            y = np.random.randint(0, h, num_pepper)
            x = np.random.randint(0, w, num_pepper)
            noisy[y, x] = 0
        return noisy

    raise ValueError(f"Unknown noise type: {noise_type}")


def apply_filter(image: np.ndarray, filter_type: str, kernel_size: int) -> np.ndarray:
    """Works directly on RGB image"""
    if kernel_size % 2 == 0:
        raise ValueError("Kernel size must be odd")

    if filter_type == "average":
        kernel = np.ones((kernel_size, kernel_size), dtype=np.float32) / (kernel_size ** 2)
        filtered = convolve(image, kernel)
        return np.clip(filtered, 0, 255).astype(np.uint8)

    elif filter_type == "gaussian":
        kernel = gaussian_kernel(kernel_size)
        filtered = convolve(image, kernel)
        return np.clip(filtered, 0, 255).astype(np.uint8)

    elif filter_type == "median":
        return median_filter(image, kernel_size)

    raise ValueError(f"Unknown filter type: {filter_type}")