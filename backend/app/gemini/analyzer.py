import json
import re
from PIL import Image
from app.gemini.client import GeminiClient
from app.gemini.prompts import DOCUMENT_ANALYSIS_PROMPT
from app.gemini.schemas import BlueprintAnalysisResponse

class BlueprintAnalyzer:
    def __init__(self):
        self.client = GeminiClient()
        self.last_raw_response = None

    def analyze_blueprint(self, image_path: str) -> BlueprintAnalysisResponse:
        with Image.open(image_path) as image:
            image.load()
            raw_response = self.client.generate_content(
                prompt=DOCUMENT_ANALYSIS_PROMPT,
                image=image,
                response_schema=BlueprintAnalysisResponse.model_json_schema(),
            )

        self.last_raw_response = raw_response
        json_text = raw_response.strip()
        if json_text.startswith("```"):
            json_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", json_text, flags=re.IGNORECASE | re.DOTALL).strip()
        try:
            json_data = json.loads(json_text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Gemini returned invalid JSON: {exc}") from exc
        return BlueprintAnalysisResponse.model_validate(json_data)
