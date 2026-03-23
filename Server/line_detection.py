import numpy as np
import cv2
from utils import to_grayscale  # Use your existing utility

def manual_hough_transform(image, threshold, rho_res=1, theta_res=1):
    # 1. Pre-processing using your back-end utility
    gray = to_grayscale(image)
    # Canny is still needed for the accumulator to find edges
    edge_image = cv2.Canny(gray, 50, 150)
    
    height, width = edge_image.shape
    img_diag = int(np.ceil(np.sqrt(height**2 + width**2)))
    
    # 2. Setup Parameter Space
    thetas = np.deg2rad(np.arange(0, 180, theta_res))
    rhos = np.arange(-img_diag, img_diag, rho_res)
    
    cos_t = np.cos(thetas)
    sin_t = np.sin(thetas)
    
    # 3. Create Accumulator
    accumulator = np.zeros((len(rhos), len(thetas)), dtype=np.int32)
    
    # 4. Vectorized Voting
    y_idxs, x_idxs = np.nonzero(edge_image)
    for i in range(len(x_idxs)):
        x, y = x_idxs[i], y_idxs[i]
        rho_values = x * cos_t + y * sin_t
        rho_idxs = ((rho_values + img_diag) / rho_res).astype(int)
        np.add.at(accumulator, (rho_idxs, np.arange(len(thetas))), 1)

    # 5. Extract lines with NMS
    detected_lines = []
    # Optimization: Use indices for faster lookup
    rows, cols = accumulator.shape
    for r in range(1, rows - 1):
        for t in range(1, cols - 1):
            if accumulator[r, t] >= threshold:
                if accumulator[r, t] == np.max(accumulator[r-1:r+2, t-1:t+2]):
                    detected_lines.append((rhos[r], thetas[t]))
                    
    return detected_lines

def draw_lines_on_image(original_img, lines):
    res_img = original_img.copy()
    for rho, theta in lines:
        a = np.cos(theta)
        b = np.sin(theta)
        x0, y0 = a * rho, b * rho
        length = 2000 
        x1 = int(x0 + length * (-b))
        y1 = int(y0 + length * (a))
        x2 = int(x0 - length * (-b))
        y2 = int(y0 - length * (a))
        # Draw red lines
        cv2.line(res_img, (x1, y1), (x2, y2), (255, 0, 0), 2) 
    return res_img