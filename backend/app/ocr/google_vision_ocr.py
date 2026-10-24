"""
DISABLED/DEPRECATED: Google Vision OCR Stub
Per project requirements: "Do NOT use Google Cloud Vision API."

This file is intentionally stubbed to intercept any accidental calls 
to Google Vision and redirect them or raise an explicit error.
The system uses the Gemini API via `app.gemini.analyzer` instead.
"""

import logging

logger = logging.getLogger(__name__)

class GoogleVisionOCR:
    def __init__(self):
        logger.warning("GoogleVisionOCR initialized, but Google Cloud Vision is DISABLED per requirements.")
        
    def detect_text(self, image_path: str):
        """
        Raises a NotImplementedError. All OCR tasks must be routed through Gemini.
        """
        raise NotImplementedError(
            "Google Cloud Vision API is prohibited in this project. "
            "Please use `app.gemini.analyzer.BlueprintAnalyzer` instead."
        )

    def detect_document(self, image_path: str):
        raise NotImplementedError(
            "Google Cloud Vision API is prohibited in this project."
        )
