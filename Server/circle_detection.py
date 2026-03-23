import cv2
import numpy as np
from utils import to_grayscale # Crucial: Import your utility

# Change parameter to 'img' to match what app.py sends
def detect_circles_hough(img, dp=1, minDist=20, param1=50, param2=30, minRadius=10, maxRadius=100):
    if img is None:
        return None, None
    
    # 1. Use the correct variable name 'img'
    gray = to_grayscale(img) 
    
    # 2. Rest of your detection logic remains the same
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=dp,
        minDist=minDist,
        param1=param1,
        param2=param2,
        minRadius=minRadius,
        maxRadius=maxRadius
    )
    
    if circles is not None:
        circles_matrix = np.round(circles[0, :]).astype(int)
        return circles_matrix, img
    
    return None, img

def draw_detected_circles(img, circles_matrix):
    img_copy = img.copy()
    if circles_matrix is not None:
        for (x, y, r) in circles_matrix:
            cv2.circle(img_copy, (x, y), r, (0, 255, 0), 2)
            cv2.circle(img_copy, (x, y), 2, (0, 0, 255), 3)
    return img_copy