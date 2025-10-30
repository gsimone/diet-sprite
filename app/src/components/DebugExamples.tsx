import { DebugCanvas } from "./DebugCanvas";

import smokeImage from "../../assets/smoke.png";
import depthImage from "../../assets/depth_1.png";
import splosImage from "../../assets/splos.png";
import impostorImage from "../../assets/impostor.png";
interface DebugExamplesProps {
  onExampleClick: (imageSrc: string) => void;
}

export function DebugExamples({ onExampleClick }: DebugExamplesProps) {
  return (
    <div className="relative grid grid-cols-2 lg:grid-cols-3 items-center gap-4 w-full">
      <div className="max-w-[512px] w-full">
        <DebugCanvas
          numberOfVertices={5}
          threshold={0.1}
          imageSrc={smokeImage}
          gridSize={1}
          onClick={() => onExampleClick(smokeImage)}
        />
      </div>
      <div className="max-w-[512px] w-full">
        <DebugCanvas
          numberOfVertices={5}
          threshold={0.5}
          imageSrc={impostorImage}
          animate
          onClick={() => onExampleClick(impostorImage)}
        />
      </div>
      <div className="max-w-[512px] w-full">
        <DebugCanvas
          numberOfVertices={6}
          threshold={0.5}
          imageSrc={splosImage}
          gridSize={64}
          animate
          onClick={() => onExampleClick(splosImage)}
        />
      </div>
    </div>
  );
}

