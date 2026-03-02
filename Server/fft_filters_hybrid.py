import cv2
import numpy as np
from utils import to_grayscale, resize_to_match

def apply_fft_filter(image, filter_type='low', radius=30):
    """Applies LPF or HPF in the frequency domain and returns a viewable image."""
    gray = to_grayscale(image)

    # FFT
    dft = np.fft.fft2(gray)
    dft_shift = np.fft.fftshift(dft)

    rows, cols = gray.shape
    crow, ccol = rows // 2, cols // 2
    mask = np.zeros((rows, cols), np.float32)
    
    y, x = np.ogrid[:rows, :cols]
    mask_area = (x - ccol)**2 + (y - crow)**2 <= radius**2

    if filter_type.lower() == 'low':
        mask[mask_area] = 1
    else:
        mask.fill(1)
        mask[mask_area] = 0

    # Apply mask and Inverse FFT
    fshift = dft_shift * mask
    f_ishift = np.fft.ifftshift(fshift)
    img_back = np.fft.ifft2(f_ishift)
    img_back = np.abs(img_back)
    
    # --- CRITICAL: Normalize so it looks like a real image, not 'dotted' ---
    return cv2.normalize(img_back, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

def create_hybrid(img1, img2, radius_low=30, radius_high=30):
    """
    Returns: (Low Pass Image 1, High Pass Image 2, Hybrid Result)
    All in viewable real-domain format.
    """
    img2_resized = resize_to_match(img1, img2)
    
    # Use the FFT function to get the components
    lp_res = apply_fft_filter(img1, filter_type='low', radius=radius_low)
    hp_res = apply_fft_filter(img2_resized, filter_type='high', radius=radius_high)
    
    # Create the hybrid by combining them
    # We use float for addition to prevent clipping before we're done
    hybrid = lp_res.astype(np.float32) + hp_res.astype(np.float32)
    hybrid_res = np.clip(hybrid, 0, 255).astype(np.uint8)
    
    return lp_res, hp_res, hybrid_res