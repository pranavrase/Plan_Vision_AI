from sqlalchemy.orm import Session
from app.models.blueprint_element import BlueprintElement
from app.models.comparison import Comparison

class ComparisonService:
    def __init__(self, db: Session):
        self.db = db

    def generate_comparison(self, blueprint_id: int, current_elements: list):
        """
        Compares the current incoming elements with the original AI-generated elements in the DB.
        """
        # Fetch original AI elements (version 1 or source='ai')
        original_elements = self.db.query(BlueprintElement).filter(
            BlueprintElement.blueprint_id == blueprint_id,
            BlueprintElement.source == "ai"
        ).all()
        
        original_map = {str(el.element_data.get("id", el.id)): el for el in original_elements}
        current_map = {str(el.get("id", "")): el for el in current_elements}
        
        added = []
        removed = []
        modified = []
        unchanged = []
        
        for e_id, current_el in current_map.items():
            if e_id not in original_map:
                added.append(current_el)
            else:
                original_el = original_map[e_id].element_data
                # Simple dict comparison. In reality, requires deep geometry comparison
                if current_el == original_el:
                    unchanged.append(current_el)
                else:
                    modified.append({"original": original_el, "current": current_el})
                    
        for e_id, original_el in original_map.items():
            if e_id not in current_map:
                removed.append(original_el.element_data)
                
        changes = {
            "added": added,
            "removed": removed,
            "modified": modified,
            "unchanged": len(unchanged)
        }
        
        comparison = Comparison(
            blueprint_id=blueprint_id,
            changes=changes
        )
        self.db.add(comparison)
        self.db.commit()
        self.db.refresh(comparison)
        
        return comparison
