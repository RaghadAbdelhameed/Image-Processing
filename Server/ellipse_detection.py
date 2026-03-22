import numpy as np
from PIL import Image, ImageDraw
from collections import deque

from utils import to_grayscale, image_to_base64, convolve


class ArcSupportEllipseDetector:
    def __init__(self):
        pass

    def compute_gradients_and_edges(self, gray: np.ndarray, edge_thresh: int):
        kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
        ky = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]])

        gx = convolve(gray, kx)
        gy = convolve(gray, ky)
        magnitude = np.hypot(gx, gy)          
        orientation = np.arctan2(gy, gx)
        edges = (magnitude > edge_thresh).astype(np.uint8)
        return edges, orientation

    
    def extract_arc_segments(self, edges, orientation, min_size, angle_tol=np.radians(20)):
        h, w = edges.shape
        visited = np.zeros_like(edges, dtype=bool)
        segments = []
        neighbors = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

        for y in range(1, h-1):
            for x in range(1, w-1):
                if edges[y, x] and not visited[y, x]:
                    segment = []
                    queue = deque([(y, x)])
                    visited[y, x] = True
                    while queue:
                        cy, cx = queue.popleft()
                        segment.append((cx, cy))
                        current_angle = orientation[cy, cx]
                        for dy, dx in neighbors:
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w:
                                if edges[ny, nx] and not visited[ny, nx]:
                                    angle_diff = abs(current_angle - orientation[ny, nx])
                                    if min(angle_diff, 2*np.pi - angle_diff) <= angle_tol:
                                        visited[ny, nx] = True
                                        queue.append((ny, nx))
                    if len(segment) >= min_size:
                        segments.append(np.array(segment))
        return segments

    def fit_ellipse(self, points):
        if len(points) < 6: return None
        x, y = points[:, 0], points[:, 1]
        D = np.vstack([x**2, x*y, y**2, x, y, np.ones_like(x)]).T
        S = np.dot(D.T, D)
        C = np.zeros((6, 6)); C[0, 2] = 2; C[2, 0] = 2; C[1, 1] = -1
        try:
            E, V = np.linalg.eig(np.dot(np.linalg.inv(S), C))
            a = V[:, np.where(E > 0)[0][0]].real
            A, B, C_val, D_val, E_val, F = a
            b_val, c, d, f, g, a_c = B/2, C_val, D_val/2, E_val/2, F, A
            num = b_val**2 - a_c*c
            if num == 0: return None
            x0, y0 = (c*d - b_val*f) / num, (a_c*f - b_val*d) / num
            up = 2 * (a_c*f**2 + c*d**2 + g*b_val**2 - 2*b_val*d*f - a_c*c*g)
            term = np.sqrt((a_c - c)**2 + 4*b_val**2)
            down1 = (b_val**2 - a_c*c) * ((c - a_c) * (term/(a_c - c + 1e-9)) - (c + a_c))
            down2 = (b_val**2 - a_c*c) * ((a_c - c) * (term/(a_c - c + 1e-9)) - (c + a_c))
            if up/down1 <= 0 or up/down2 <= 0: return None
            return {"center": (x0, y0), "axes": (np.sqrt(up/down1), np.sqrt(up/down2)), "angle": 0.5 * np.arctan2(2*b_val, a_c - c)}
        except: return None

    def verify(self, ell, edges, tr_thresh):
        if not ell: return 0
        h, w = edges.shape
        cx, cy = ell["center"]; a, b = ell["axes"]; phi = ell["angle"]
        t = np.linspace(0, 2*np.pi, 200)
        x_p = cx + a*np.cos(t)*np.cos(phi) - b*np.sin(t)*np.sin(phi)
        y_p = cy + a*np.cos(t)*np.sin(phi) + b*np.sin(t)*np.cos(phi)
        inliers = 0
        for px, py in zip(x_p, y_p):
            ix, iy = int(round(px)), int(round(py))
            found = False
            for dy in range(-1, 2):
                for dx in range(-1, 2):
                    if 0 <= iy+dy < h and 0 <= ix+dx < w:
                        if edges[iy+dy, ix+dx] > 0:
                            found = True; break
                if found: break
            if found: inliers += 1
        ratio = inliers / len(t)
        return ratio if ratio >= tr_thresh else 0

    def apply_nms(self, ellipses):
        ellipses.sort(key=lambda x: x['score'], reverse=True)
        keep = []
        for cand in ellipses:
            is_dup = False
            for conf in keep:
                dist = np.hypot(cand['center'][0] - conf['center'][0], cand['center'][1] - conf['center'][1])
                if dist < np.mean(conf['axes']) * 0.01:
                    is_dup = True; break
            if not is_dup: keep.append(cand)
        return keep

    def run(self, img_rgb: np.ndarray, edge_thresh: int = 50,
            tr_thresh: float = 0.5, min_size: int = 25):
        """img_rgb = your stored RGB numpy array (uint8)"""
        gray = to_grayscale(img_rgb)

        edges, orientation = self.compute_gradients_and_edges(gray, edge_thresh)
        segments = self.extract_arc_segments(edges, orientation, min_size)

        candidates = []
        for seg in segments:
            ell = self.fit_ellipse(seg)
            score = self.verify(ell, edges, tr_thresh)
            if score > 0:
                ell['score'] = score
                candidates.append(ell)

        results = self.apply_nms(candidates)

        # Draw on original color image
        out_pil = Image.fromarray(img_rgb)
        draw = ImageDraw.Draw(out_pil)
        for ell in results:
            cx, cy = ell["center"]
            a, b = ell["axes"]
            phi = ell["angle"]
            t = np.linspace(0, 2*np.pi, 100)
            x = cx + a*np.cos(t)*np.cos(phi) - b*np.sin(t)*np.sin(phi)
            y = cy + a*np.cos(t)*np.sin(phi) + b*np.sin(t)*np.cos(phi)
            draw.line(list(zip(x, y)) + [(x[0], y[0])], fill="red", width=3)
            draw.ellipse([cx-2, cy-2, cx+2, cy+2], fill="blue")

        return {
            "result_image": image_to_base64(np.array(out_pil)),
            "num_ellipses": len(results)
        }