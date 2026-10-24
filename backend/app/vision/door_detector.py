import cv2
import numpy as np
from typing import List, Dict

class DoorDetector:
    """
    Optional OpenCV-based module to supplement Gemini AI's detection.
    Can be used in the preprocessing or postprocessing steps to find arc/door features.
    """
    def __init__(self, debug: bool = False):
        self.debug = debug

    def detect_doors(self, image_path: str) -> List[Dict]:
        """
        Fallback traditional computer vision method to detect architectural doors 
        (often represented by arcs/quarters of circles in blueprints).
        """
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError(f"Could not read image: {image_path}")

        # Preprocessing: blurring, thresholding, edge detection
        blurred = cv2.GaussianBlur(img, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

        # In a real CV pipeline, we would use HoughCircles or contour analysis 
        # to find specific door arc patterns here.
        # This acts as a stub to be expanded if Gemini needs CV reinforcement.
        doors = []
        
        # Example contour detection logic:
        # contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        # for cnt in contours:
        #     # analyze curvature, bounding box, etc.
        #     pass

        return doors

    def overlay_detections(self, image_path: str, doors: List[Dict], output_path: str):
        """
        Utility for debugging detected doors on the original image.
        """
        img = cv2.imread(image_path)
        # draw bounding boxes from `doors` onto `img`
        cv2.imwrite(output_path, img)
