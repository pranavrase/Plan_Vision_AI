import os
import uuid
from io import BytesIO
from pathlib import Path
from PIL import Image, UnidentifiedImageError

class PreprocessingService:
    ALLOWED_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}

    def __init__(self, base_dir: str = "storage"):
        self.base_dir = Path(base_dir)
        self.upload_dir = self.base_dir / "originals"
        self.processed_dir = self.base_dir / "processed"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def process_and_save_upload(self, file_content: bytes, original_filename: str, max_size_mb: int = 20):
        if not file_content:
            raise ValueError("Uploaded file is empty")
        if len(file_content) > max_size_mb * 1024 * 1024:
            raise ValueError(f"Image exceeds the {max_size_mb} MB limit")

        try:
            with Image.open(BytesIO(file_content)) as image:
                image.verify()
            with Image.open(BytesIO(file_content)) as image:
                image.load()
                image_format = (image.format or "").upper()
                if image_format not in self.ALLOWED_FORMATS:
                    raise ValueError("Only JPG, PNG, and WEBP images are supported")
                width, height = image.size
                rgb = image.convert("RGB")
        except (UnidentifiedImageError, OSError) as exc:
            raise ValueError(f"Invalid image file: {exc}") from exc

        unique_id = str(uuid.uuid4())
        ext = self.ALLOWED_FORMATS[image_format]
        original_path = self.upload_dir / f"{unique_id}_original.{ext}"
        processed_path = self.processed_dir / f"{unique_id}_processed.png"

        original_path.write_bytes(file_content)
        rgb.save(processed_path, "PNG", optimize=True)
        return str(original_path), str(processed_path), width, height
