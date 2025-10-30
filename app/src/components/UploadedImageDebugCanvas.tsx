import { useEffect, useState, useMemo, useCallback } from "react";
import { PolygonGenerator } from "diet-sprite";
import { AnimatePresence, motion } from "framer-motion";
import { guessAtlasGrid } from "../utils";
import { DebugCanvas } from "./DebugCanvas";
import { NumberSlider } from "./NumberSlider";

const VERTICES_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];

interface UploadedImageDebugCanvasWithControlsProps {
  uploadedImage: string;
  onClearImage: () => void;
  onPolygonGenerated: (
    polygon: PolygonGenerator | null,
    params: {
      vertices: number;
      threshold: number;
      gridSize: number;
      animate: boolean;
      fps: number;
    }
  ) => void;
}

export function UploadedImageDebugCanvasWithControls({
  uploadedImage,
  onClearImage: _onClearImage,
  onPolygonGenerated,
}: UploadedImageDebugCanvasWithControlsProps) {
  const [_detectedConfidence, _setDetectedConfidence] = useState<number | null>(
    null
  );
  const [isDetecting, setIsDetecting] = useState(true);

  const [numberOfVertices, setNumberOfVertices] = useState(5);
  const [gridSize, setGridSize] = useState(64);
  const [animate] = useState(true);
  const [fps] = useState(60);
  const [threshold, setThreshold] = useState(0);
  const [useAlphaColor] = useState(false);
  const [alphaColorPicker] = useState("#ff00ff");

  // Auto-detect grid size when image changes
  useEffect(() => {
    setIsDetecting(true);

    const image = new Image();
    image.src = uploadedImage;
    image.onload = () => {
      const result = guessAtlasGrid(image, { detectGutters: false });

      if (result.confidence < 0.5) {
        setGridSize(1);
        requestAnimationFrame(() => {
          setIsDetecting(false);
        });
        return;
      }

      if (result.tileWidth && result.tileHeight) {
        // Calculate grid size as cols * rows
        const cols = Math.round(image.width / result.tileWidth);
        const rows = Math.round(image.height / result.tileHeight);
        const detectedGridSize = cols * rows;

        setGridSize(detectedGridSize);
        _setDetectedConfidence(result.confidence);
      }

      requestAnimationFrame(() => {
        setIsDetecting(false);
      });
    };
  }, [uploadedImage]);

  const alphaColor = useMemo<[number, number, number] | undefined>(() => {
    if (!useAlphaColor) return undefined;

    // Convert hex color to RGB tuple
    const hex = alphaColorPicker.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return [r, g, b];
  }, [useAlphaColor, alphaColorPicker]);

  const handlePolygonGenerated = useCallback((polygon: PolygonGenerator) => {
    onPolygonGenerated(polygon, {
      vertices: numberOfVertices,
      threshold,
      gridSize,
      animate,
      fps,
    });
  }, [numberOfVertices, threshold, gridSize, animate, fps]);

  if (isDetecting) {
    return (
      <div className="flex flex-col items-center gap-4 relative">
        <div className="flex items-center gap-4">
          <div className="w-[512px] h-[512px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-white">
              <div className="w-12 h-12 border-4 border-[rgb(255,26,125)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="absolute top-[100px] left-1/2 -translate-x-1/2 text-xs text-white flex gap-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="flex items-center gap-2 ">
            <div className="rounded-full w-3 h-3 border border-white/20 border-dashed"></div>
            <span>Original area</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full w-3 h-3 border border-[rgb(255,26,125)]"></div>
            <span>
              <strong>diet</strong>sprite area
            </span>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-col items-center gap-4 relative">
        <div className="flex items-center gap-4">
          <div className="w-[512px] h-[512px] relative">
            <DebugCanvas
              numberOfVertices={numberOfVertices}
              threshold={threshold}
              imageSrc={uploadedImage}
              gridSize={gridSize}
              animate={animate}
              size={512}
              fps={fps}
              onPolygonGenerated={handlePolygonGenerated}
              showBackgroundNumber={true}
              alphaColor={alphaColor}
            />

            {/* <div className="w-[512px] h-[512px] absolute left-0 -translate-x-96 top-0 opacity-5 hover:opacity-100 transition-all">
              <AtlasDebugCanvas
                numberOfVertices={numberOfVertices}
                threshold={threshold}
                imageSrc={uploadedImage}
                gridSize={gridSize}
                alphaColor={alphaColor}
                size={512}
              />
            </div> */}
          </div>
          <div className="absolute left-0 -translate-x-[calc(100%+2rem)] w-[24rem] grid grid-cols-2 gap-4 text-white items-center">
            <span className="text-right text-sm opacity-30">Vertices</span>
            <NumberSlider
              value={numberOfVertices}
              onChange={setNumberOfVertices}
              options={VERTICES_OPTIONS}
              width={200}
            />
            <span className="text-right text-sm opacity-30">
              Alpha Threshold
            </span>
            <NumberSlider
              value={(threshold * 100)} // Round to nearest step of 5
              onChange={(val) => setThreshold(val / 100)}
              options={Array.from({ length: 100 }, (_, i) => i )} // 0, 5, 10, ..., 100 (step of 5)
              itemWidth={20} // Smaller spacing for faster navigation
              width={200}
            />
            <span className="text-right text-sm opacity-30">Grid Size</span>
            <NumberSlider
              value={Math.sqrt(gridSize)}
              onChange={(val) => setGridSize(val * val)}
              options={Array.from({ length: 64 }, (_, i) => i + 1)} // 1 to 64
              itemWidth={25}
              width={200}
            />
          </div>
        </div>
      </div>
    </>
  );
}
