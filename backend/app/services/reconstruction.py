class ReconstructionService:
    def __init__(self):
        pass
        
    def generate_svg(self, elements: list) -> str:
        """
        Generates an SVG representation of the blueprint elements.
        """
        # A simple SVG generator. In a real application, this would have complex logic to handle scale, units, etc.
        svg_content = ['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">']
        
        # Add a background grid
        svg_content.append('<defs><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="gray" stroke-width="0.5"/></pattern></defs>')
        svg_content.append('<rect width="100%" height="100%" fill="url(#grid)" />')
        
        for element in elements:
            el_type = element.element_type
            data = element.element_data
            
            if el_type == "wall":
                start = data.get("start", {"x": 0, "y": 0})
                end = data.get("end", {"x": 0, "y": 0})
                thickness = data.get("thickness", 5)
                svg_content.append(f'<line x1="{start["x"]}" y1="{start["y"]}" x2="{end["x"]}" y2="{end["y"]}" stroke="black" stroke-width="{thickness}" stroke-linecap="square"/>')
            
            elif el_type == "room":
                polygon = data.get("polygon", [])
                if polygon:
                    points_str = " ".join([f"{p['x']},{p['y']}" for p in polygon])
                    name = data.get("name", "")
                    svg_content.append(f'<polygon points="{points_str}" fill="lightblue" fill-opacity="0.3" stroke="blue" stroke-width="2"/>')
                    # Room label
                    centroid_x = sum(p["x"] for p in polygon) / len(polygon)
                    centroid_y = sum(p["y"] for p in polygon) / len(polygon)
                    svg_content.append(f'<text x="{centroid_x}" y="{centroid_y}" font-family="Arial" font-size="20" fill="darkblue" text-anchor="middle">{name}</text>')
            
            elif el_type == "door":
                # Simplified door representation
                pos = data.get("position", {"x":0, "y":0})
                w = data.get("width", 20)
                svg_content.append(f'<rect x="{pos["x"] - w/2}" y="{pos["y"] - 5}" width="{w}" height="10" fill="brown"/>')
                
            elif el_type == "window":
                # Simplified window representation
                start = data.get("start", {"x": 0, "y": 0})
                end = data.get("end", {"x": 0, "y": 0})
                svg_content.append(f'<line x1="{start["x"]}" y1="{start["y"]}" x2="{end["x"]}" y2="{end["y"]}" stroke="cyan" stroke-width="10" stroke-linecap="square" opacity="0.7"/>')

            elif el_type == "dimension":
                start = data.get("start", {"x": 0, "y": 0})
                end = data.get("end", {"x": 0, "y": 0})
                val = data.get("value", "")
                unit = data.get("unit", "")
                
                # Dimension line
                svg_content.append(f'<line x1="{start["x"]}" y1="{start["y"]}" x2="{end["x"]}" y2="{end["y"]}" stroke="green" stroke-width="1" stroke-dasharray="4"/>')
                
                # Label
                mid_x = (start["x"] + end["x"]) / 2
                mid_y = (start["y"] + end["y"]) / 2
                svg_content.append(f'<text x="{mid_x}" y="{mid_y - 5}" font-family="Arial" font-size="14" fill="green" text-anchor="middle">{val}{unit}</text>')
        
        svg_content.append('</svg>')
        return "\n".join(svg_content)
