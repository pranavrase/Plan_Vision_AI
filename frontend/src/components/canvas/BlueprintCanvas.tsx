import React from 'react';
import { Canvas } from '../editor/Canvas';

interface BlueprintCanvasProps {
  elements: any[];
  scale: number;
  selectedId: string | number | null;
  onSelect: (id: string | number | null) => void;
  currentTool: string;
}

/**
 * Wrapper component for the Blueprint Canvas.
 * This can be used to inject additional logic specific to blueprints
 * (e.g. background image overlay) before delegating to the base SVG canvas.
 */
export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = (props) => {
  return (
    <div className="w-full h-full relative border border-gray-200">
      {/* Background Image layer could go here */}
      <Canvas {...props} />
    </div>
  );
};
