import numpy as np
from PIL import Image, ImageDraw
from collections import deque

from utils import to_grayscale, image_to_base64, convolve


class ArcSupportEllipseDetector:
    def __init__(self):
        pass

    def compute_gradients_and_edges(self, gray: np.ndarray, edge_thresh: int):
        """
        SUMMARY: Finds sharp transitions (edges) in the image using Sobel-like operators.
        Returns a binary edge map and a matrix containing the gradient orientation of each pixel.
        """
        # Custom 3x3 convolution kernels (similar to Sobel) to detect X and Y intensity changes
        kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
        ky = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]])

        gx = convolve(gray, kx)
        gy = convolve(gray, ky)
        
        # calculates the Pythagorean distance (sqrt(gx^2 + gy^2)) to find edge strength.
        magnitude = np.hypot(gx, gy)          
        # safely calculates the angle/direction the edge is facing.
        orientation = np.arctan2(gy, gx)
        
        # Binarize the image: 1 if magnitude > threshold (it's an edge), 0 otherwise.
        edges = (magnitude > edge_thresh).astype(np.uint8)
        return edges, orientation

    
    def extract_arc_segments(self, edges, orientation, min_size, angle_tol=np.radians(20)):
        """
        SUMMARY: Uses Breadth-First Search (BFS) to group connected edge pixels into continuous, 
        smooth curves (arcs). Discards isolated noise smaller than min_size.
        """
        h, w = edges.shape
        visited = np.zeros_like(edges, dtype=bool) # Tracker to prevent infinite loops
        segments = []
        # 8-way connectivity (up, down, left, right, diagonals)
        neighbors = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

        for y in range(1, h-1):
            for x in range(1, w-1):
                # If we find an unvisited edge pixel, start a new BFS queue (a new arc)
                if edges[y, x] and not visited[y, x]:
                    segment = []
                    queue = deque([(y, x)])
                    visited[y, x] = True
                    
                    while queue:
                        cy, cx = queue.popleft()
                        segment.append((cx, cy))
                        current_angle = orientation[cy, cx]
                        
                        # Check all 8 surrounding neighbors
                        for dy, dx in neighbors:
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w:
                                if edges[ny, nx] and not visited[ny, nx]:
                                    angle_diff = abs(current_angle - orientation[ny, nx])
                                    
                                    # min(diff, 2*pi - diff) ensures we find the shortest angular distance.
                                    # If the angle is within tolerance, it's a smooth curve. Add it!
                                    if min(angle_diff, 2*np.pi - angle_diff) <= angle_tol:
                                        visited[ny, nx] = True
                                        queue.append((ny, nx))
                    
                    # Only keep the arc if it's long enough (filters out noise)
                    if len(segment) >= min_size:
                        segments.append(np.array(segment))
        return segments

    def fit_ellipse(self, points):
        """
        SUMMARY: Uses Direct Least Squares (Fitzgibbon algorithm) to force an algebraic 
        ellipse equation onto a set of arc points, then converts the algebra to geometry.
        """
        # A conic equation has 6 terms, requiring at least 6 points to solve.
        if len(points) < 6: return None
        x, y = points[:, 0], points[:, 1]
        
        # Design matrix D maps coordinates to algebraic terms: Ax^2 + Bxy + Cy^2 + Dx + Ey + F = 0
        D = np.vstack([x**2, x*y, y**2, x, y, np.ones_like(x)]).T
        S = np.dot(D.T, D) # Scatter matrix
        
        # The Fitzgibbon constraint matrix. This specifically forces the generalized 
        # conic solver to ONLY return an ellipse (4AC - B^2 = 1).
        C = np.zeros((6, 6)); C[0, 2] = 2; C[2, 0] = 2; C[1, 1] = -1
        
        try:
            # Solve the generalized eigenvalue problem
            E, V = np.linalg.eig(np.dot(np.linalg.inv(S), C))
            
            # The constraint matrix guarantees exactly one positive eigenvalue.
            # We extract the eigenvector corresponding to that positive eigenvalue.
            a = V[:, np.where(E > 0)[0][0]].real
            
            # Unpack eigenvector into algebraic coefficients
            A, B, C_val, D_val, E_val, F = a
            
            # --- Convert Algebra to Geometry ---
            b_val, c, d, f, g, a_c = B/2, C_val, D_val/2, E_val/2, F, A
            num = b_val**2 - a_c*c
            if num == 0: return None # It's a parabola, not an ellipse
            
            # Calculate Center (x0, y0)
            x0, y0 = (c*d - b_val*f) / num, (a_c*f - b_val*d) / num
            
            # Standard algebraic compression formulas for calculating axis lengths
            up = 2 * (a_c*f**2 + c*d**2 + g*b_val**2 - 2*b_val*d*f - a_c*c*g)
            term = np.sqrt((a_c - c)**2 + 4*b_val**2)
            down1 = (b_val**2 - a_c*c) * ((c - a_c) * (term/(a_c - c + 1e-9)) - (c + a_c))
            down2 = (b_val**2 - a_c*c) * ((a_c - c) * (term/(a_c - c + 1e-9)) - (c + a_c))
            
            # If lengths are negative, the math failed to find a real shape
            if up/down1 <= 0 or up/down2 <= 0: return None
            
            # Return standard geometry: Center, Axes (Semi-Major/Minor), and Rotation Angle
            return {"center": (x0, y0), "axes": (np.sqrt(up/down1), np.sqrt(up/down2)), "angle": 0.5 * np.arctan2(2*b_val, a_c - c)}
        except: return None

    def verify(self, ell, edges, tr_thresh):
        """
        SUMMARY: The "Reality Check". Generates points along the perimeter of the mathematically 
        fitted ellipse and checks the real edge map to see if physical edges actually exist there.
        """
        if not ell: return 0
        h, w = edges.shape
        cx, cy = ell["center"]; a, b = ell["axes"]; phi = ell["angle"]
        
        # Generate 200 evenly spaced angles around a circle
        t = np.linspace(0, 2*np.pi, 200)
        
        # This draws the 200 floating-point coordinates along the boundary.
        x_p = cx + a*np.cos(t)*np.cos(phi) - b*np.sin(t)*np.sin(phi)
        y_p = cy + a*np.cos(t)*np.sin(phi) + b*np.sin(t)*np.cos(phi)
        
        inliers = 0
        for px, py in zip(x_p, y_p):
            ix, iy = int(round(px)), int(round(py)) # Round floating-point math to exact pixel grid
            found = False
            
            # 3x3 Neighborhood search. We don't just check the exact pixel, we check 
            # its immediate neighbors to account for rounding errors and slight pixelation.
            for dy in range(-1, 2):
                for dx in range(-1, 2):
                    if 0 <= iy+dy < h and 0 <= ix+dx < w:
                        if edges[iy+dy, ix+dx] > 0:
                            found = True; break
                if found: break
            if found: inliers += 1
            
        # Score is the percentage of perimeter points that landed on actual edges
        ratio = inliers / len(t)
        return ratio if ratio >= tr_thresh else 0

    def apply_nms(self, ellipses):
        """
        SUMMARY: Non-Maximum Suppression. Removes duplicates by keeping the highest-scoring 
        ellipses and discarding any lower-scoring ellipses that share nearly the same center.
        """
        # Sort by score descending. The most accurate ellipses get to suppress the weaker ones.
        ellipses.sort(key=lambda x: x['score'], reverse=True)
        keep = []
        
        for cand in ellipses:
            is_dup = False
            for conf in keep:
                # Calculate Euclidean distance between the candidate center and confirmed center
                dist = np.hypot(cand['center'][0] - conf['center'][0], cand['center'][1] - conf['center'][1])
                
                # Distance Threshold. If the centers are closer than 1% of the 
                # ellipse's average axis size, they are considered duplicates.
                if dist < np.mean(conf['axes']) * 0.01:
                    is_dup = True; break
            
            if not is_dup: keep.append(cand)
        return keep

    def run(self, img_rgb: np.ndarray, edge_thresh: int = 50,
            tr_thresh: float = 0.5, min_size: int = 25):
        """
        SUMMARY: The main pipeline orchestrator. Runs all steps in sequence and draws the result.
        """
        # 1. Image Prep
        gray = to_grayscale(img_rgb)

        # 2. Extract Data
        edges, orientation = self.compute_gradients_and_edges(gray, edge_thresh)
        segments = self.extract_arc_segments(edges, orientation, min_size)

        # 3. Fit and Verify
        candidates = []
        for seg in segments:
            ell = self.fit_ellipse(seg)
            score = self.verify(ell, edges, tr_thresh)
            if score > 0:
                ell['score'] = score
                candidates.append(ell)

        # 4. Clean up Duplicates
        results = self.apply_nms(candidates)

        # 5. Draw on original color image
        out_pil = Image.fromarray(img_rgb)
        draw = ImageDraw.Draw(out_pil)
        for ell in results:
            cx, cy = ell["center"]
            a, b = ell["axes"]
            phi = ell["angle"]
            
            # Parametric equation to draw the continuous red outline
            t = np.linspace(0, 2*np.pi, 100)
            x = cx + a*np.cos(t)*np.cos(phi) - b*np.sin(t)*np.sin(phi)
            y = cy + a*np.cos(t)*np.sin(phi) + b*np.sin(t)*np.cos(phi)
            draw.line(list(zip(x, y)) + [(x[0], y[0])], fill="red", width=3)
            draw.ellipse([cx-2, cy-2, cx+2, cy+2], fill="blue") # Blue center dot

        return {
            "result_image": image_to_base64(np.array(out_pil)),
            "num_ellipses": len(results)
        }