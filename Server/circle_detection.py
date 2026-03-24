import cv2
import numpy as np
from utils import to_grayscale


def detect_circles_hough(
    img, dp=1.2, minDist=30, param1=50, param2=50, minRadius=10, maxRadius=100
):
    if img is None:
        return []

    # --- SPEED TRICK 1: Max Resolution Limit ---
    # If the image is massive, scale it down for calculation
    scale_factor = 1.0
    max_dimension = 800
    h, w = img.shape[:2]

    if max(h, w) > max_dimension:
        scale_factor = max_dimension / float(max(h, w))
        img_resized = cv2.resize(img, (int(w * scale_factor), int(h * scale_factor)))
        # Adjust parameters to match the scaled image
        minRadius = max(5, int(minRadius * scale_factor))
        maxRadius = int(maxRadius * scale_factor)
        minDist = int(minDist * scale_factor)
    else:
        img_resized = img

    # 1. Preprocessing
    gray = to_grayscale(img_resized)
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)

    # 2. Edge Detection
    edges = cv2.Canny(blurred, param1 / 2, param1)

    # 3. Accumulator Setup
    img_height, img_width = edges.shape
    acc_height = int(np.ceil(img_height / dp))
    acc_width = int(np.ceil(img_width / dp))

    radii = np.arange(minRadius, maxRadius + 1)
    accumulator = np.zeros((acc_height, acc_width, len(radii)), dtype=np.int32)

    ys, xs = np.nonzero(edges)

    # --- SPEED TRICK 2: Edge Thinning ---
    # Only process every 2nd edge pixel (cuts workload in half!)
    edge_stride = 2
    ys = ys[::edge_stride]
    xs = xs[::edge_stride]

    if len(xs) == 0:
        return []

    chunk_size = 5000

    # 4. CHUNKED Vectorized Voting
    for r_idx, r in enumerate(radii):
        # --- SPEED TRICK 3: Dynamic Angle Calculation ---
        # Calculate angles specifically for this radius, saving math on small circles
        angle_steps = max(12, int(2 * np.pi * r))
        thetas = np.linspace(0, 2 * np.pi, angle_steps, endpoint=False)
        cos_thetas = np.cos(thetas)
        sin_thetas = np.sin(thetas)

        for i in range(0, len(xs), chunk_size):
            xs_chunk = xs[i : i + chunk_size]
            ys_chunk = ys[i : i + chunk_size]

            a_centers = np.round(
                (xs_chunk[:, None] - r * cos_thetas[None, :]) / dp
            ).astype(int)
            b_centers = np.round(
                (ys_chunk[:, None] - r * sin_thetas[None, :]) / dp
            ).astype(int)

            valid = (
                (a_centers >= 0)
                & (a_centers < acc_width)
                & (b_centers >= 0)
                & (b_centers < acc_height)
            )

            valid_a = a_centers[valid]
            valid_b = b_centers[valid]

            np.add.at(accumulator[:, :, r_idx], (valid_b, valid_a), 1)

    # 5. Extracting Peaks
    # Adjust param2 threshold slightly because we threw away half our edge pixels
    adjusted_param2 = max(10, int(param2 / edge_stride))
    ry, rx, rr = np.where(accumulator >= adjusted_param2)

    if len(rx) == 0:
        return []

    scores = accumulator[ry, rx, rr]
    orig_x = (rx * dp).astype(int)
    orig_y = (ry * dp).astype(int)
    orig_r = radii[rr]

    candidates = np.stack([orig_x, orig_y, orig_r, scores], axis=1)
    candidates = candidates[np.argsort(-candidates[:, 3])]

    # 6. Non-Maximum Suppression
    accepted_circles = []
    for candidate in candidates:
        cx, cy, cr, _ = candidate
        keep = True
        for acx, acy, acr in accepted_circles:
            if np.hypot(cx - acx, cy - acy) < minDist:
                keep = False
                break
        if keep:
            accepted_circles.append((int(cx), int(cy), int(cr)))

    # --- Final Step: Scale coordinates back up if we downscaled the image ---
    if scale_factor != 1.0:
        final_circles = []
        for x, y, r in accepted_circles:
            final_circles.append(
                (int(x / scale_factor), int(y / scale_factor), int(r / scale_factor))
            )
        return final_circles

    return accepted_circles


def draw_detected_circles(img, circles_matrix):
    img_copy = img.copy()
    if circles_matrix:
        for x, y, r in circles_matrix:
            cv2.circle(img_copy, (x, y), r, (0, 255, 0), 2)
            cv2.circle(img_copy, (x, y), 2, (0, 0, 255), 3)
    return img_copy
