import re
import math
from typing import List, Dict, Any, Tuple

def _safe_float(val: Any, default: float = 0.8) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

class TextNormalizer:
    @staticmethod
    def normalize(text: str) -> str:
        if not text:
            return ""
        # 1. Convert to uppercase
        s = text.upper().strip()
        # 2. Replace multiple spaces/newlines with a single space
        s = re.sub(r'\s+', ' ', s)
        # 3. Strip minor leading/trailing punctuation artifacts except quotes/apostrophes in room names
        s = re.sub(r'^[^\w\'"]+|[^\w\'"]+$', '', s)
        return s

class MultiLineTextGrouper:
    @staticmethod
    def group_text_elements(elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Groups multi-line handwritten text elements (e.g. 'DINING' on line 1, 'ROOM' on line 2)
        into a single logical text element spanning both lines.
        """
        if not elements:
            return []

        # Convert items into mutable dicts with bbox
        items = []
        for el in elements:
            d = el.model_dump(mode="json") if hasattr(el, "model_dump") else dict(el)
            b = SpatialDeduplicator.compute_bbox(d)
            d["_bbox_tuple"] = b # (x1, y1, x2, y2)
            items.append(d)

        # Sort top-to-bottom
        items.sort(key=lambda item: item["_bbox_tuple"][1])

        merged = []
        used = [False] * len(items)

        for i in range(len(items)):
            if used[i]:
                continue

            curr = items[i]
            box1 = curr["_bbox_tuple"]
            txt1 = (curr.get("text") or "").strip()

            # Try to find vertically aligned next line below curr
            matched_j = None
            for j in range(i + 1, len(items)):
                if used[j]:
                    continue
                cand = items[j]
                box2 = cand["_bbox_tuple"]
                txt2 = (cand.get("text") or "").strip()

                # Check vertical proximity (line 2 is below line 1 within threshold)
                vertical_gap = box2[1] - box1[3] # y2_start - y1_end
                if -15 <= vertical_gap <= 45:
                    # Check horizontal overlap / alignment
                    c1_x = (box1[0] + box1[2]) / 2.0
                    c2_x = (box2[0] + box2[2]) / 2.0
                    h_overlap = max(0, min(box1[2], box2[2]) - max(box1[0], box2[0]))
                    min_w = min(box1[2] - box1[0], box2[2] - box2[0])

                    if abs(c1_x - c2_x) <= 60 or (min_w > 0 and h_overlap / min_w >= 0.3):
                        matched_j = j
                        break

            if matched_j is not None:
                used[matched_j] = True
                cand = items[matched_j]
                box2 = cand["_bbox_tuple"]
                txt2 = (cand.get("text") or "").strip()

                # Combine text
                combined_text = f"{txt1} {txt2}".strip()

                # Combined bounding box
                min_x = min(box1[0], box2[0])
                min_y = min(box1[1], box2[1])
                max_x = max(box1[2], box2[2])
                max_y = max(box1[3], box2[3])

                merged_item = dict(curr)
                merged_item["text"] = combined_text
                merged_item["bbox"] = {
                    "x": min_x,
                    "y": min_y,
                    "width": max_x - min_x,
                    "height": max_y - min_y
                }
                merged_item["confidence"] = max(_safe_float(curr.get("confidence"), 0.9), _safe_float(cand.get("confidence"), 0.9))
                merged_item.pop("_bbox_tuple", None)
                merged.append(merged_item)
            else:
                curr.pop("_bbox_tuple", None)
                merged.append(curr)

        return merged


class SpatialDeduplicator:
    def __init__(self, iou_threshold: float = 0.30, distance_threshold_pct: float = 0.08):
        self.iou_threshold = iou_threshold
        self.distance_threshold_pct = distance_threshold_pct

    @staticmethod
    def compute_bbox(element: Dict[str, Any]) -> Tuple[float, float, float, float]:
        """Returns (min_x, min_y, max_x, max_y) normalized to 0-1000 scale."""
        if "bbox" in element and isinstance(element["bbox"], dict):
            b = element["bbox"]
            x = b.get("x", 0.0)
            y = b.get("y", 0.0)
            w = b.get("width", 50.0)
            h = b.get("height", 20.0)
            return (x, y, x + w, y + h)
        elif "x" in element and "y" in element:
            x = element.get("x", 0.0)
            y = element.get("y", 0.0)
            w = element.get("width", 60.0)
            h = element.get("height", 24.0)
            return (x, y, x + w, y + h)
        elif "start" in element and isinstance(element["start"], dict):
            s = element["start"]
            e = element.get("end", s)
            return (min(s.get("x", 0), e.get("x", 0)), min(s.get("y", 0), e.get("y", 0)),
                    max(s.get("x", 0), e.get("x", 0)) + 5, max(s.get("y", 0), e.get("y", 0)) + 5)
        elif "position" in element and isinstance(element["position"], dict):
            p = element["position"]
            px, py = p.get("x", 0), p.get("y", 0)
            return (px - 15, py - 15, px + 15, py + 15)
        elif "polygon" in element and isinstance(element["polygon"], list) and element["polygon"]:
            pts = element["polygon"]
            xs = [p.get("x", 0) for p in pts if isinstance(p, dict)]
            ys = [p.get("y", 0) for p in pts if isinstance(p, dict)]
            if xs and ys:
                return (min(xs), min(ys), max(xs), max(ys))
        return (0.0, 0.0, 50.0, 20.0)

    @staticmethod
    def get_center(bbox: Tuple[float, float, float, float]) -> Tuple[float, float]:
        return ((bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0)

    def compute_iou(self, boxA: Tuple[float, float, float, float], boxB: Tuple[float, float, float, float]) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
        if interArea <= 0.0:
            return 0.0

        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
        unionArea = boxAArea + boxBArea - interArea
        if unionArea <= 0.0:
            return 0.0
        return interArea / unionArea

    def is_duplicate_text(self, el1: Dict[str, Any], el2: Dict[str, Any], canvas_max: float = 1000.0) -> bool:
        txt1 = TextNormalizer.normalize(el1.get("text") or el1.get("name") or "")
        txt2 = TextNormalizer.normalize(el2.get("text") or el2.get("name") or "")

        if not txt1 or not txt2 or txt1 != txt2:
            return False

        box1 = self.compute_bbox(el1)
        box2 = self.compute_bbox(el2)

        # 1. IoU Check
        iou = self.compute_iou(box1, box2)
        if iou >= self.iou_threshold:
            return True

        # 2. Distance between centers check
        c1 = self.get_center(box1)
        c2 = self.get_center(box2)
        dist = math.hypot(c1[0] - c2[0], c1[1] - c2[1])
        max_allowed_dist = canvas_max * self.distance_threshold_pct

        if dist <= max_allowed_dist:
            return True

        return False

    def deduplicate_text_elements(self, raw_text_elements: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
        """
        Deduplicates text elements while keeping physically distinct identical labels intact.
        Returns (deduplicated_list, count_removed).
        """
        # Step 1: Group multi-line handwriting (e.g. DINING + ROOM)
        grouped = MultiLineTextGrouper.group_text_elements(raw_text_elements)

        deduped: List[Dict[str, Any]] = []
        removed_count = 0

        for item in grouped:
            item_dict = item.model_dump(mode="json") if hasattr(item, "model_dump") else dict(item)
            raw_text = item_dict.get("text", "")
            norm_text = TextNormalizer.normalize(raw_text)
            item_dict["normalized_text"] = norm_text

            is_dup = False
            for idx, existing in enumerate(deduped):
                if self.is_duplicate_text(item_dict, existing):
                    is_dup = True
                    removed_count += 1
                    # Keep item with higher confidence or larger bounding box
                    conf_item = _safe_float(item_dict.get("confidence"), 0.8)
                    conf_existing = _safe_float(existing.get("confidence"), 0.8)
                    if conf_item > conf_existing:
                        deduped[idx] = item_dict
                    break

            if not is_dup:
                deduped.append(item_dict)

        return deduped, removed_count

    def synchronize_room_and_text_labels(self, rooms: List[Dict[str, Any]], texts: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
        """
        Ensures room names and text labels maintain a SINGLE authoritative representation.
        """
        cleaned_texts, removed_count = self.deduplicate_text_elements(texts)
        cleaned_rooms: List[Dict[str, Any]] = []

        for r in rooms:
            r_copy = r.model_dump(mode="json") if hasattr(r, "model_dump") else dict(r)
            room_name = TextNormalizer.normalize(r_copy.get("name", ""))
            r_copy["normalized_name"] = room_name
            cleaned_rooms.append(r_copy)

        return cleaned_rooms, cleaned_texts, removed_count

