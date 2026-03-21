# =============================================================================
#   Pure NumPy Canny Edge Detection - Optimized Version
#   (Thresholds: low=0.05, high=0.15, sigma=1.0)
# =============================================================================

import numpy as np
from tkinter import Tk, filedialog
from PIL import Image
import matplotlib.pyplot as plt
import os

# ────────────────────────────────────────────────
#                  Pure NumPy Canny
# ────────────────────────────────────────────────


def gaussian_kernel(size: int, sigma: float = 1.0) -> np.ndarray:
    """Create 2D Gaussian kernel."""
    ax = np.linspace(-(size - 1) / 2.0, (size - 1) / 2.0, size)
    xx, yy = np.meshgrid(ax, ax)
    kernel = np.exp(-(xx**2 + yy**2) / (2.0 * sigma**2))
    return kernel / np.sum(kernel)


def convolve2d(image: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    """Manual 2D convolution with reflect padding."""
    h, w = image.shape
    kh, kw = kernel.shape
    pad_h, pad_w = kh // 2, kw // 2

    padded = np.pad(image, ((pad_h, pad_h), (pad_w, pad_w)), mode="reflect")
    output = np.zeros((h, w), dtype=np.float64)

    for i in range(h):
        for j in range(w):
            output[i, j] = np.sum(padded[i : i + kh, j : j + kw] * kernel)

    return output


def non_max_suppression(magnitude: np.ndarray, angle: np.ndarray) -> np.ndarray:
    """Non-maximum suppression — 4 quantized directions."""
    h, w = magnitude.shape
    suppressed = np.zeros_like(magnitude, dtype=np.float64)

    angle = angle % 180

    for i in range(1, h - 1):
        for j in range(1, w - 1):
            ang = angle[i, j]

            # Horizontal
            if (0 <= ang < 22.5) or (157.5 <= ang <= 180):
                q = magnitude[i, j + 1]
                r = magnitude[i, j - 1]
            # Diagonal /
            elif 22.5 <= ang < 67.5:
                q = magnitude[i + 1, j - 1]
                r = magnitude[i - 1, j + 1]
            # Vertical
            elif 67.5 <= ang < 112.5:
                q = magnitude[i + 1, j]
                r = magnitude[i - 1, j]
            # Diagonal \
            else:
                q = magnitude[i + 1, j + 1]
                r = magnitude[i - 1, j - 1]

            if magnitude[i, j] >= q and magnitude[i, j] >= r:
                suppressed[i, j] = magnitude[i, j]

    return suppressed


def double_threshold_hysteresis(
    img: np.ndarray, low_ratio: float = 0.05, high_ratio: float = 0.15
) -> np.ndarray:
    """Double threshold + edge tracking by hysteresis."""
    strong = 255
    weak = 75
    
    # Calculate thresholds based on maximum magnitude
    max_magnitude = np.max(img)
    low_thresh = low_ratio * max_magnitude
    high_thresh = high_ratio * max_magnitude
    
    edges = np.zeros_like(img, dtype=np.uint8)
    
    # Find strong and weak edges
    strong_i, strong_j = np.where(img >= high_thresh)
    weak_i, weak_j = np.where((img >= low_thresh) & (img < high_thresh))
    
    edges[strong_i, strong_j] = strong
    edges[weak_i, weak_j] = weak
    
    # Hysteresis - propagate strong edges to connected weak edges
    changed = True
    while changed:
        changed = False
        for i in range(1, img.shape[0] - 1):
            for j in range(1, img.shape[1] - 1):
                if edges[i, j] == weak:
                    # Check 8-neighborhood
                    if np.any(edges[i - 1:i + 2, j - 1:j + 2] == strong):
                        edges[i, j] = strong
                        changed = True
    
    # Remove remaining weak edges
    edges[edges == weak] = 0
    return edges


def canny_edge_detection(
    image: np.ndarray,
    low_ratio: float = 0.05,
    high_ratio: float = 0.15,
    sigma: float = 1.0,
) -> np.ndarray:
    """
    Pure NumPy Canny edge detector.
    Optimized thresholds: low_ratio=0.05, high_ratio=0.15
    """
    # Convert to grayscale if color
    if image.ndim == 3 and image.shape[2] in (3, 4):
        image = (
            0.299 * image[..., 0] + 0.587 * image[..., 1] + 0.114 * image[..., 2]
        ).astype(np.float64)
    else:
        image = image.astype(np.float64)
    
    # Normalize to [0, 1] range
    image = image / 255.0
    
    # 1. Gaussian blur
    ksize = int(2 * np.ceil(2 * sigma)) + 1
    if ksize % 2 == 0:
        ksize += 1
    gauss = gaussian_kernel(ksize, sigma)
    smoothed = convolve2d(image, gauss)
    
    # 2. Sobel gradients
    sobel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=float)
    sobel_y = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=float)
    
    gx = convolve2d(smoothed, sobel_x)
    gy = convolve2d(smoothed, sobel_y)
    
    magnitude = np.hypot(gx, gy)
    angle = np.arctan2(gy, gx) * (180 / np.pi) % 180
    
    # 3. Non-maximum suppression
    nms = non_max_suppression(magnitude, angle)
    
    # 4. Double threshold + hysteresis
    final_edges = double_threshold_hysteresis(nms, low_ratio, high_ratio)
    
    return final_edges.astype(np.uint8)


# ────────────────────────────────────────────────
#                Main Program
# ────────────────────────────────────────────────


def main():
    # Hide empty tkinter window
    root = Tk()
    root.withdraw()

    print("Please select an image file...")
    file_path = filedialog.askopenfilename(
        title="Select Image for Canny Edge Detection",
        filetypes=[
            ("Common image files", "*.jpg *.jpeg *.png *.bmp *.tiff *.webp"),
            ("All files", "*.*"),
        ],
    )

    if not file_path:
        print("No file selected. Exiting.")
        return

    print(f"Selected image: {file_path}")

    try:
        # Load image
        pil_img = Image.open(file_path).convert("RGB")
        img_array = np.array(pil_img)

        print(f"Image shape: {img_array.shape}")

        # Run Canny with optimized thresholds (low=0.05, high=0.15)
        print("Applying Canny edge detection with thresholds: low=5%, high=15%...")
        edges = canny_edge_detection(
            img_array, 
            low_ratio=0.05, 
            high_ratio=0.15, 
            sigma=1.0
        )

        # Prepare output filename
        base, ext = os.path.splitext(file_path)
        output_path = f"{base}_canny_edges{ext}"

        # Save edge map
        Image.fromarray(edges).save(output_path)
        print(f"Edge map saved → {output_path}")

        # Display results
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 6))

        ax1.imshow(img_array)
        ax1.set_title("Original Image", fontsize=12, fontweight='bold')
        ax1.axis("off")

        ax2.imshow(edges, cmap="gray")
        ax2.set_title("Canny Edges (low=5%, high=15%)", fontsize=12, fontweight='bold')
        ax2.axis("off")

        plt.tight_layout()
        plt.show()
        
        print("\n✅ Edge detection completed successfully!")

    except Exception as e:
        print(f"Error occurred: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()