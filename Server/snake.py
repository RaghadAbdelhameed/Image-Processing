import cv2
import numpy as np
from utils import normalize_img, to_grayscale


# ─────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────

def _gaussian_blur(gray: np.ndarray, ksize: int = 5, sigma: float = 1.0) -> np.ndarray:
    k = cv2.getGaussianKernel(ksize, sigma)
    kernel = k @ k.T
    from numpy.lib.stride_tricks import sliding_window_view
    pad = ksize // 2
    padded = np.pad(gray.astype(np.float32), pad, mode='edge')
    windows = sliding_window_view(padded, (ksize, ksize))
    return np.sum(windows * kernel, axis=(2, 3)).astype(np.float32)


def _sobel_magnitude(gray: np.ndarray):
    from numpy.lib.stride_tricks import sliding_window_view

    def _conv2d(img, kern):
        kh, kw = kern.shape
        ph, pw = kh // 2, kw // 2
        padded = np.pad(img.astype(np.float32), ((ph, ph), (pw, pw)), mode='edge')
        windows = sliding_window_view(padded, (kh, kw))
        return np.sum(windows * kern, axis=(2, 3)).astype(np.float32)

    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
    ky = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float32)
    gx = _conv2d(gray, kx)
    gy = _conv2d(gray, ky)
    mag = np.sqrt(gx**2 + gy**2)
    direction = np.arctan2(gy, gx)
    return mag, direction


def _distance_transform(binary_edges: np.ndarray) -> np.ndarray:
    """Simple two-pass distance transform (no scipy needed)."""
    dist = np.full(binary_edges.shape, np.inf, dtype=np.float32)
    h, w = binary_edges.shape
    for y in range(h):
        for x in range(w):
            if binary_edges[y, x] == 0:
                dist[y, x] = 0
            else:
                if x > 0:
                    dist[y, x] = min(dist[y, x], dist[y, x - 1] + 1)
                if y > 0:
                    dist[y, x] = min(dist[y, x], dist[y - 1, x] + 1)
    for y in range(h - 1, -1, -1):
        for x in range(w - 1, -1, -1):
            if x < w - 1:
                dist[y, x] = min(dist[y, x], dist[y, x + 1] + 1)
            if y < h - 1:
                dist[y, x] = min(dist[y, x], dist[y + 1, x] + 1)
    return dist


# ─────────────────────────────────────────────
# Energy map
# ─────────────────────────────────────────────

def _compute_energy_map(img_rgb: np.ndarray):
    gray = to_grayscale(img_rgb)
    blurred = _gaussian_blur(gray, 5, 1.0)

    edges1 = cv2.Canny(blurred.astype(np.uint8), 30, 100)
    edges2 = cv2.Canny(blurred.astype(np.uint8), 50, 150)
    edges3 = cv2.Canny(blurred.astype(np.uint8), 80, 200)
    combined_edges = np.maximum.reduce([edges1, edges2, edges3]).astype(np.float32)

    grad_mag, _ = _sobel_magnitude(blurred)
    grad_mag = normalize_img(grad_mag).astype(np.float32)

    energy_map = 255.0 - (0.6 * grad_mag + 0.4 * combined_edges)

    edge_dist = _distance_transform((255 - combined_edges).astype(np.uint8))
    edge_dist_norm = normalize_img(edge_dist).astype(np.float32)

    combined = 0.5 * energy_map + 0.5 * edge_dist_norm
    smoothed = _gaussian_blur(combined, 5, 1.0)
    return smoothed


def _compute_gradient_directions(energy_map: np.ndarray):
    from numpy.lib.stride_tricks import sliding_window_view

    def _conv2d(img, kern):
        kh, kw = kern.shape
        ph, pw = kh // 2, kw // 2
        padded = np.pad(img.astype(np.float32), ((ph, ph), (pw, pw)), mode='edge')
        windows = sliding_window_view(padded, (kh, kw))
        return np.sum(windows * kern, axis=(2, 3)).astype(np.float32)

    kx = np.array([[1, 0, -1], [2, 0, -2], [1, 0, -1]], dtype=np.float32)
    ky = np.array([[1, 2, 1], [0, 0, 0], [-1, -2, -1]], dtype=np.float32)
    gx = _conv2d(energy_map, kx)
    gy = _conv2d(energy_map, ky)
    mag = np.sqrt(gx**2 + gy**2)
    direction = np.arctan2(gy, gx)
    return mag, direction


# ─────────────────────────────────────────────
# Contour initialisation
# ─────────────────────────────────────────────

def initialize_contour(x1: int, y1: int, x2: int, y2: int, num_points: int = 30) -> np.ndarray:
    """Build a rectangular contour from two corner points."""
    top    = np.linspace([x1, y1], [x2, y1], num_points)
    right  = np.linspace([x2, y1], [x2, y2], num_points)
    bottom = np.linspace([x2, y2], [x1, y2], num_points)
    left   = np.linspace([x1, y2], [x1, y1], num_points)
    return np.vstack([top, right, bottom, left])


def _resample_contour(contour: np.ndarray, num_points: int = 120) -> np.ndarray:
    closed = np.vstack([contour, contour[0]])
    dist = np.zeros(len(closed))
    for i in range(1, len(closed)):
        dist[i] = dist[i - 1] + np.linalg.norm(closed[i] - closed[i - 1])
    new_dist = np.linspace(0, dist[-1], num_points)
    new_contour = np.zeros((num_points, 2))
    for i in range(2):
        new_contour[:, i] = np.interp(new_dist, dist, closed[:, i])
    return new_contour


# ─────────────────────────────────────────────
# Force computations
# ─────────────────────────────────────────────

def _compute_external_forces(contour, energy_map, cx, cy):
    h, w = energy_map.shape
    forces = np.zeros_like(contour)
    for i, point in enumerate(contour):
        dx = point[0] - cx
        dy = point[1] - cy
        angle = np.arctan2(dy, dx)
        cur_r = np.sqrt(dx**2 + dy**2)
        best_energy = float('inf')
        best_r = cur_r
        for r in np.linspace(cur_r - 15, cur_r + 15, 50):
            x = cx + r * np.cos(angle)
            y = cy + r * np.sin(angle)
            if 0 <= int(y) < h and 0 <= int(x) < w:
                xf, yf = int(x), int(y)
                xc, yc = min(xf + 1, w - 1), min(yf + 1, h - 1)
                wx, wy = x - xf, y - yf
                e = ((1 - wx) * (1 - wy) * energy_map[yf, xf] +
                     wx * (1 - wy) * energy_map[yf, xc] +
                     (1 - wx) * wy * energy_map[yc, xf] +
                     wx * wy * energy_map[yc, xc])
                if e < best_energy:
                    best_energy = e
                    best_r = r
        dr = best_r - cur_r
        max_dr = 2.0 * (1.0 / (1.0 + np.exp(-best_energy / 50)))
        dr = np.clip(dr, -max_dr, max_dr)
        forces[i, 0] = dr * np.cos(angle)
        forces[i, 1] = dr * np.sin(angle)
    return forces


def _compute_internal_forces(contour, grad_mag, grad_dir):
    h, w = grad_mag.shape
    forces = np.zeros_like(contour)
    for i, point in enumerate(contour):
        x = int(np.clip(point[0], 0, w - 1))
        y = int(np.clip(point[1], 0, h - 1))
        gdir = grad_dir[y, x]
        gmag = grad_mag[y, x]
        scale = min(5.0, gmag / 30.0)
        forces[i, 0] = scale * np.cos(gdir)
        forces[i, 1] = scale * np.sin(gdir)
    return forces


def _smooth_contour(contour, smooth_w, rigid_w):
    n = len(contour)
    smoothed = contour.copy()
    for _ in range(3):
        for i in range(n):
            prev_i = (i - 1) % n
            next_i = (i + 1) % n
            smoothed[i] = ((1 - smooth_w) * contour[i] +
                           smooth_w * 0.5 * (contour[prev_i] + contour[next_i]))
            if 0 < i < n - 1:
                smoothed[i] += rigid_w * (contour[i - 1] - 2 * contour[i] + contour[i + 1])
    return smoothed


# ─────────────────────────────────────────────
# Greedy algorithm
# ─────────────────────────────────────────────

def _greedy_algorithm(contour, energy_map, grad_mag, grad_dir,
                      cx, cy, max_iterations, alpha, beta, gamma,
                      adaptive_weights):
    h, w = energy_map.shape
    for iteration in range(max_iterations):
        prev = contour.copy()
        if adaptive_weights:
            progress = iteration / max_iterations
            ext_w    = gamma * (1.0 - 0.5 * progress)
            smooth_w = alpha * (1.0 + 0.5 * progress)
            rigid_w  = beta  * (1.0 + 0.5 * progress)
        else:
            ext_w, smooth_w, rigid_w = gamma, alpha, beta

        ext_forces  = _compute_external_forces(contour, energy_map, cx, cy)
        int_forces  = _compute_internal_forces(contour, grad_mag, grad_dir)
        combined    = 0.5 * ext_forces + 0.5 * int_forces

        contour += ext_w * combined

        if iteration % 3 == 0:
            contour = _smooth_contour(contour, smooth_w, rigid_w)

        contour[:, 0] = np.clip(contour[:, 0], 0, w - 1)
        contour[:, 1] = np.clip(contour[:, 1], 0, h - 1)

        if iteration % 15 == 0 and iteration > 0:
            contour = _resample_contour(contour, len(contour))

        movement = np.mean(np.sqrt(np.sum((contour - prev) ** 2, axis=1)))
        if movement < 0.05:
            break

    return contour


# ─────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────

def run_snake(
    img_rgb: np.ndarray,
    x1: int, y1: int, x2: int, y2: int,
    alpha: float = 0.1,
    beta: float = 0.1,
    gamma: float = 1.0,
    max_iterations: int = 300,
    adaptive_weights: bool = True,
) -> dict:
    """
    Run the Active Contour Model (snake) on img_rgb.

    Returns a dict with:
      - result_image  : RGB np.ndarray with final contour drawn in green
      - initial_contour: list of [x, y] pairs
      - final_contour  : list of [x, y] pairs
    """
    energy_map = _compute_energy_map(img_rgb)
    contour    = initialize_contour(x1, y1, x2, y2)
    initial    = contour.copy()

    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0

    contour = _resample_contour(contour, num_points=120)
    grad_mag, grad_dir = _compute_gradient_directions(energy_map)

    contour = _greedy_algorithm(
        contour, energy_map, grad_mag, grad_dir,
        cx, cy, max_iterations, alpha, beta, gamma, adaptive_weights
    )

    # Final smoothing passes
    for _ in range(3):
        n = len(contour)
        smoothed = contour.copy()
        for i in range(n):
            prev_i = (i - 1) % n
            next_i = (i + 1) % n
            smoothed[i] = ((1 - alpha) * contour[i] +
                           alpha * 0.5 * (contour[prev_i] + contour[next_i]))
            if 0 < i < n - 1:
                smoothed[i] += beta * (contour[i - 1] - 2 * contour[i] + contour[i + 1])
        contour = smoothed

    # Draw contour on a copy of the original image
    result = img_rgb.copy()
    pts = np.round(contour).astype(np.int32)
    for i in range(len(pts) - 1):
        cv2.line(result, tuple(pts[i]), tuple(pts[i + 1]), (0, 255, 0), 2)
    cv2.line(result, tuple(pts[-1]), tuple(pts[0]), (0, 255, 0), 2)

    # Also draw the initial contour in red
    init_pts = np.round(initial).astype(np.int32)
    for i in range(len(init_pts) - 1):
        cv2.line(result, tuple(init_pts[i]), tuple(init_pts[i + 1]), (255, 0, 0), 1)
    cv2.line(result, tuple(init_pts[-1]), tuple(init_pts[0]), (255, 0, 0), 1)

    return {
        "result_image":    result,
        "initial_contour": initial.tolist(),
        "final_contour":   contour.tolist(),
    }