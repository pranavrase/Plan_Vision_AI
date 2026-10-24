import json
import time
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from app.models.blueprint import Blueprint, BlueprintStatus
from app.models.blueprint_element import BlueprintElement
from app.models.ocr_result import OCRResult
from app.models.project import Project, ProjectStatus
from app.gemini.analyzer import BlueprintAnalyzer
from app.gemini.schemas import BlueprintAnalysisResponse

class PipelineService:
    def __init__(self, db: Session):
        self.db = db
        self.analyzer = BlueprintAnalyzer()

    def run_pipeline(self, blueprint_id: int):
        blueprint = self.db.query(Blueprint).filter(Blueprint.id == blueprint_id).first()
        if not blueprint:
            raise ValueError(f"Blueprint {blueprint_id} not found")

        started = time.perf_counter()
        try:
            blueprint.status = BlueprintStatus.PREPROCESSING
            self.db.commit()

            if not blueprint.processed_path:
                raise ValueError("Processed image is missing")

            blueprint.status = BlueprintStatus.ANALYZING
            self.db.commit()
            analysis_result: BlueprintAnalysisResponse = self.analyzer.analyze_blueprint(blueprint.processed_path)

            blueprint.status = BlueprintStatus.EXTRACTING_TEXT
            self.db.commit()
            blueprint.status = BlueprintStatus.DETECTING_ELEMENTS
            self.db.commit()

            # Re-running OCR replaces previous AI elements/results for this blueprint.
            self.db.query(BlueprintElement).filter(
                BlueprintElement.blueprint_id == blueprint.id,
                BlueprintElement.source == "ai",
            ).delete(synchronize_session=False)

            self.db.query(OCRResult).filter(OCRResult.blueprint_id == blueprint.id).delete(synchronize_session=False)

            raw = self.analyzer.last_raw_response
            try:
                raw_json = json.loads(raw) if raw else None
            except (TypeError, json.JSONDecodeError):
                raw_json = {"text": raw} if raw else None

            confidence = analysis_result.confidence_summary.get("overall")
            ocr = OCRResult(
                blueprint_id=blueprint.id,
                provider="gemini",
                model=self.analyzer.client.model_name,
                raw_response=raw_json,
                structured_result=analysis_result.model_dump(mode="json"),
                processing_time=time.perf_counter() - started,
                confidence=confidence,
            )
            self.db.add(ocr)

            # Run multi-stage spatial deduplication and line grouping on text elements & room labels
            from app.services.deduplication import SpatialDeduplicator
            dedup = SpatialDeduplicator()
            cleaned_rooms, cleaned_texts, removed_dups_count = dedup.synchronize_room_and_text_labels(
                analysis_result.rooms,
                analysis_result.text_elements
            )

            # Diagnostic extraction logging
            raw_text_count = len(analysis_result.text_elements)
            final_text_count = len(cleaned_texts)
            file_hash = blueprint.file_hash or "N/A"
            print("============================================================")
            print("EXTRACTION DIAGNOSTIC LOG")
            print("============================================================")
            print(f"IMAGE HASH:           {file_hash}")
            print(f"GEMINI TEXT COUNT:    {raw_text_count}")
            print(f"OCR TEXT COUNT:       {raw_text_count}")
            print(f"MERGED TEXT COUNT:    {final_text_count}")
            print(f"DUPLICATE CANDIDATES: {removed_dups_count}")
            print(f"REMOVED DUPLICATES:   {removed_dups_count}")
            print(f"FINAL TEXT COUNT:     {final_text_count}")
            print("============================================================")

            # Smart Post-Processing: Convert measurement text strings into Dimension elements if needed
            import re
            extracted_dimensions = list(analysis_result.dimensions)

            def _get_dim_value(d):
                """Safely get 'value' from a Pydantic model or a plain dict."""
                if isinstance(d, dict):
                    return d.get("value")
                return getattr(d, "value", None)

            final_text_elements = []
            for txt in cleaned_texts:
                content = (txt.get("text") if isinstance(txt, dict) else getattr(txt, "text", "") or "").strip()
                # Match numeric dimension text callouts (e.g. "65.0", "20.0", "22.0", "3.0", "10.5m")
                is_dim_text = bool(re.match(r'^\s*\d+(?:\.\d+)?\s*(?:m|mm|cm|ft|in|\'|\")?\s*$', content, re.IGNORECASE))
                if is_dim_text:
                    if not any(_get_dim_value(d) == content for d in extracted_dimensions if _get_dim_value(d)):
                        bbox = txt.get("bbox", {}) if isinstance(txt, dict) else getattr(txt, "bbox", None)
                        bx = bbox.get("x", 500) if isinstance(bbox, dict) else (bbox.x if bbox else 500)
                        by = bbox.get("y", 500) if isinstance(bbox, dict) else (bbox.y if bbox else 500)
                        bw = bbox.get("width", 50) if isinstance(bbox, dict) else (bbox.width if bbox else 50)
                        unit_match = re.search(r'(m|mm|cm|ft|in|\'|\")', content, re.IGNORECASE)
                        unit_str = unit_match.group(1) if unit_match else ""
                        txt_id = txt.get("id", "auto") if isinstance(txt, dict) else getattr(txt, "id", "auto")
                        conf = txt.get("confidence", 0.9) if isinstance(txt, dict) else getattr(txt, "confidence", 0.9)
                        extracted_dimensions.append({
                            "id": f"dim_auto_{txt_id}",
                            "type": "dimension",
                            "start": {"x": bx, "y": by},
                            "end": {"x": bx + bw, "y": by},
                            "value": content,
                            "unit": unit_str,
                            "confidence": conf,
                            "editable": True
                        })
                    # Omit numeric dimension strings from general text elements to avoid double rendering
                else:
                    final_text_elements.append(txt)

            for element_type, items in [
                ("wall", analysis_result.walls), ("door", analysis_result.doors),
                ("window", analysis_result.windows), ("room", cleaned_rooms),
                ("dimension", extracted_dimensions), ("text", final_text_elements),
            ]:
                self._store_elements(blueprint.id, element_type, items)

            db_text_count = self.db.query(BlueprintElement).filter(
                BlueprintElement.blueprint_id == blueprint.id,
                BlueprintElement.element_type == "text"
            ).count()
            print(f"DATABASE TEXT COUNT:  {db_text_count}")
            print("============================================================")

            blueprint.status = BlueprintStatus.RECONSTRUCTING
            self.db.commit()
            blueprint.status = BlueprintStatus.VALIDATING
            self.db.commit()
            blueprint.status = BlueprintStatus.READY_FOR_REVIEW

            project = self.db.query(Project).filter(Project.id == blueprint.project_id).first()
            if project:
                project.status = ProjectStatus.REVIEW
            self.db.commit()
            self.db.refresh(blueprint)
            return blueprint
        except Exception:
            blueprint.status = BlueprintStatus.FAILED
            self.db.commit()
            raise

    def _store_elements(self, blueprint_id: int, element_type: str, items: list):
        for item in items:
            item_dict = item.model_dump(mode="json") if hasattr(item, "model_dump") else item
            self.db.add(BlueprintElement(
                blueprint_id=blueprint_id,
                element_type=element_type,
                element_data=item_dict,
                confidence=item_dict.get("confidence"),
                source="ai",
                is_verified=False,
            ))
