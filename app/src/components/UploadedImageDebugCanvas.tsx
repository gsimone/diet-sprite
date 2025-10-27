import { useEffect, useRef, useState, useMemo } from "react";
import { PolygonGenerator } from "diet-sprite";
import { folder, useControls } from "leva";
import { AnimatePresence, motion } from "framer-motion";
import { guessAtlasGrid } from "../utils";
import { DebugCanvas } from "./DebugCanvas";

interface UploadedImageDebugCanvasWithControlsProps {
  uploadedImage: string;
  onClearImage: () => void;
  onPolygonGenerated: (
    polygon: PolygonGenerator | null,
    params: { vertices: number; threshold: number; gridSize: number; animate: boolean; fps: number }
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
  const [isGenerating, setIsGenerating] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const loadingTimeoutRef = useRef<number | null>(null);

  const [
    {
      gridSize,
      numberOfVertices,
      animate,
      fps,
      threshold,
      useAlphaColor,
      alphaColorPicker,
    },
    set,
  ] = useControls(() => ({
    gridSize: { value: 64, min: 1, max: 256, step: 1 },
    numberOfVertices: { value: 5, min: 3, max: 12, step: 1 },
    alpha: folder({
      useAlphaColor: { value: false, label: "Use Color" },
      alphaColorPicker: {
        value: "#ff00ff",
        label: "Alpha Color",
        render: (get) => get("alpha.useAlphaColor"),
      },
      threshold: { value: 0.1, min: 0, max: 1, step: 0.01 },
    }),
    animation: folder({
      animate: { value: true },
      fps: {
        value: 60,
        min: 1,
        max: 60,
        step: 1,
        render: (get) => get("animation.animate"),
      },
    }),
  }));

  // Manage loading indicator with 10ms delay
  useEffect(() => {
    const isLoading = isDetecting || isGenerating;

    if (isLoading) {
      // Start a timeout to show loading after 10ms
      loadingTimeoutRef.current = window.setTimeout(() => {
        setShowLoading(true);
      }, 160);
    } else {
      // Clear timeout if operation finishes before 10ms
      if (loadingTimeoutRef.current !== null) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setShowLoading(false);
    }

    return () => {
      if (loadingTimeoutRef.current !== null) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [isDetecting, isGenerating]);

  // Auto-detect grid size when image changes
  useEffect(() => {
    setIsDetecting(true);
    setIsGenerating(true);

    const image = new Image();
    image.src = uploadedImage;
    image.onload = () => {
      const result = guessAtlasGrid(image, { detectGutters: false });

      if (result.confidence < 0.5) {
        set({ gridSize: 1 });
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

        set({ gridSize: detectedGridSize });
        _setDetectedConfidence(result.confidence);
      }

      requestAnimationFrame(() => {
        setIsDetecting(false);
      });
    };
  }, [uploadedImage, set]);

  // Reset generating state when controls that affect polygon generation change
  useEffect(() => {
    setIsGenerating(true);
  }, [gridSize, numberOfVertices, threshold, useAlphaColor, alphaColorPicker]);

  const alphaColor = useMemo<[number, number, number] | undefined>(() => {
    if (!useAlphaColor) return undefined;

    // Convert hex color to RGB tuple
    const hex = alphaColorPicker.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return [r, g, b];
  }, [useAlphaColor, alphaColorPicker]);

  const handlePolygonGenerated = (polygon: PolygonGenerator) => {
    setIsGenerating(false);
    onPolygonGenerated(polygon, {
      vertices: numberOfVertices,
      threshold,
      gridSize,
      animate,
      fps,
    });
  };

  if (isDetecting) {
    return (
      <div className="flex flex-col items-center gap-4 relative w-[512px] h-[512px]">
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-opacity-80 rounded-lg">
          <div className="flex flex-col items-center gap-4 text-white">
            <div className="w-12 h-12 border-4 border-[rgb(255,26,125)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 relative">
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-opacity-80 rounded-lg">
          <div className="flex flex-col items-center gap-4 text-white">
            <div className="w-12 h-12 border-4 border-[rgb(255,26,125)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}

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

      <AnimatePresence>
        {!showLoading && (
          <motion.div
            className="absolute top-[20px] left-1/2 -translate-x-1/2 text-xs text-white flex gap-3"
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
        )}
      </AnimatePresence>
    </div>
  );
}

