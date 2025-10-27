import { useEffect, useRef, useState } from "react";
import { PolygonGenerator } from "diet-sprite";
import NumberFlow from "@number-flow/react";
import { cx } from "class-variance-authority";

import defaultDepthImage from "../../assets/depth_1.png";

// Constants to prevent creating new array references on every render
const DEFAULT_GRID_SIZE = 256;
const DEFAULT_INDICES: [number, number] = [0, 0];

interface DebugCanvasProps {
  numberOfVertices?: number;
  threshold?: number;
  gridSize?: number;
  indices?: [number, number];
  accumulateSprites?: boolean;
  imageSrc?: string;
  animate?: boolean;
  size?: number;
  fps?: number;
  onPolygonGenerated?: (polygon: PolygonGenerator) => void;
  showBackgroundNumber?: boolean;
  alphaColor?: [number, number, number];
  onClick?: () => void;
}

export function DebugCanvas({
  numberOfVertices = 6,
  threshold = 0.5,
  gridSize = DEFAULT_GRID_SIZE,
  indices = DEFAULT_INDICES,
  accumulateSprites = true,
  imageSrc = defaultDepthImage,
  animate = false,
  size = 256,
  fps = 30,
  onPolygonGenerated,
  showBackgroundNumber = false,
  alphaColor,
  onClick,
}: DebugCanvasProps) {
  const [debugCanvas, setDebugCanvas] = useState<HTMLCanvasElement | null>(
    null
  );
  const [areaReduction, setAreaReduction] = useState(0);
  const generationTimeRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!debugCanvas) return;

    const image = new Image();
    image.src = imageSrc;
    image.onload = async () => {
      const t0 = performance.now();

      // Convert gridSize to slices array
      const gridDimension = Math.sqrt(gridSize);
      const slices: [number, number] = [gridDimension, gridDimension];

      const polygon = new PolygonGenerator(
        image,
        {
          threshold,
          slices,
          indices,
          accumulateSprites,
          ...(alphaColor ? { alphaColor } : {}),
        },
        numberOfVertices
      );

      const t1 = performance.now();

      const dt = t1 - t0;

      console.log("took ", dt, "ms");

      // Notify parent component that polygon was generated
      if (onPolygonGenerated) {
        onPolygonGenerated(polygon);
      }

      // draw the imageData to the canvas
      const ctx = debugCanvas.getContext("2d");
      if (!ctx) return;

      // Set canvas buffer size to 4x the imageData dimensions with 20% padding
      const baseSize = size / 2; // size is display size (e.g. 256px), base is half
      const scale = 4;
      const dpr = window.devicePixelRatio || 1;
      const padding = 0.2;
      const contentWidth = baseSize * scale * dpr;
      const contentHeight = baseSize * scale * dpr;
      const paddingX = contentWidth * padding;
      const paddingY = contentHeight * padding;
      const width = contentWidth + paddingX * 2;
      const height = contentHeight + paddingY * 2;
      debugCanvas.width = width;
      debugCanvas.height = height;

      // Helper function to draw polygon
      const drawPolygon = () => {
        // Positions are normalized [-0.5, 0.5], need to transform to canvas space with padding offset
        const toCanvasX = (x: number) => (x + 0.5) * contentWidth + paddingX;
        const toCanvasY = (y: number) => (0.5 - y) * contentHeight + paddingY; // flip Y

        // Draw white rectangle representing the original sprite quad
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1 * scale * dpr;
        ctx.setLineDash([3 * scale * dpr, 3 * scale * dpr]);
        ctx.strokeRect(
          toCanvasX(-0.5),
          toCanvasY(0.5),
          contentWidth,
          contentHeight
        );

        // Build edge map to identify inner vs outer edges
        const edgeMap = new Map<string, number>();

        for (let i = 0; i < polygon.index.length; i += 3) {
          const v0 = polygon.index[i];
          const v1 = polygon.index[i + 1];
          const v2 = polygon.index[i + 2];

          // Add each edge (sorted to ensure consistency)
          const edges = [
            [v0, v1].sort((a, b) => a - b).join(","),
            [v1, v2].sort((a, b) => a - b).join(","),
            [v2, v0].sort((a, b) => a - b).join(","),
          ];

          edges.forEach((edge) => {
            edgeMap.set(edge, (edgeMap.get(edge) || 0) + 1);
          });
        }

        // Draw edges with dashed style for inner edges
        ctx.strokeStyle = "rgb(255, 26, 125)";
        ctx.lineWidth = 1 * scale * dpr;

        const drawnEdges = new Set<string>();

        for (let i = 0; i < polygon.index.length; i += 3) {
          const v0 = polygon.index[i];
          const v1 = polygon.index[i + 1];
          const v2 = polygon.index[i + 2];

          const edges = [
            { verts: [v0, v1], key: [v0, v1].sort((a, b) => a - b).join(",") },
            { verts: [v1, v2], key: [v1, v2].sort((a, b) => a - b).join(",") },
            { verts: [v2, v0], key: [v2, v0].sort((a, b) => a - b).join(",") },
          ];

          edges.forEach(({ verts, key }) => {
            if (drawnEdges.has(key)) return;
            drawnEdges.add(key);

            const isInner = (edgeMap.get(key) || 0) > 1;

            // Set dash style
            ctx.setLineDash(isInner ? [3 * scale * dpr, 3 * scale * dpr] : []);

            const i0 = verts[0] * 3;
            const i1 = verts[1] * 3;

            ctx.beginPath();
            ctx.moveTo(
              toCanvasX(polygon.positions[i0]),
              toCanvasY(polygon.positions[i0 + 1])
            );
            ctx.lineTo(
              toCanvasX(polygon.positions[i1]),
              toCanvasY(polygon.positions[i1 + 1])
            );
            ctx.stroke();
          });
        }

        // Reset line dash
        ctx.setLineDash([]);
      };

      setAreaReduction(polygon.data.areaReduction * 100);

      generationTimeRef.current!.textContent = `generated in ${dt.toFixed(
        2
      )}ms`;

      if (animate) {
        // Animation mode: cycle through atlas frames
        const [cols, rows] = slices;
        const totalFrames = cols * rows;
        const spriteWidth = image.width / cols;
        const spriteHeight = image.height / rows;

        let currentFrame = 0;
        const frameDuration = 1000 / fps;
        let lastFrameTime = 0;

        const animationLoop = (timestamp: number) => {
          if (timestamp - lastFrameTime >= frameDuration) {
            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Calculate current frame position in atlas
            const col = currentFrame % cols;
            const row = Math.floor(currentFrame / cols);
            const sx = col * spriteWidth;
            const sy = row * spriteHeight;

            // Draw current sprite frame
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
              image,
              sx,
              sy,
              spriteWidth,
              spriteHeight,
              paddingX,
              paddingY,
              contentWidth,
              contentHeight
            );

            // Draw polygon on top
            drawPolygon();

            // Update frame
            currentFrame = (currentFrame + 1) % totalFrames;
            lastFrameTime = timestamp;
          }

          animationFrameRef.current = requestAnimationFrame(animationLoop);
        };

        animationFrameRef.current = requestAnimationFrame(animationLoop);
      } else {
        // Static mode: draw once
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          await createImageBitmap(polygon.imageData),
          paddingX,
          paddingY,
          contentWidth,
          contentHeight
        );

        drawPolygon();
      }
    };

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    debugCanvas,
    numberOfVertices,
    threshold,
    gridSize,
    indices,
    accumulateSprites,
    imageSrc,
    animate,
    size,
    fps,
    alphaColor,
  ]);

  return (
    <div
      className={`relative shrink-0 ${
        onClick ? "cursor-pointer transition-transform" : ""
      }`}
      style={{ width: `${size}px`, height: `${size}px` }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <canvas ref={setDebugCanvas} className="w-full h-full" />
      <div className="absolute -bottom-4 left-0 right-0 pointer-events-none text-white flex flex-col items-center justify-center gap-1">
        <div
          className={cx(
            "font-bold transition-all duration-300 ease-in-out",
            areaReduction < 0 ? "text-red-400" : "text-white"
          )}
        >
          
          {(areaReduction * -1).toFixed(2)}
          % area
        </div>
        {showBackgroundNumber && (
          <div className="absolute text-[10rem] -mt-2 opacity-[0.03] font-extrabold text-nowrap">
            <NumberFlow
              value={areaReduction * -1}
              format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
            />
            %
          </div>
        )}
        <div ref={generationTimeRef} className="text-xs opacity-50">
          0ms
        </div>
      </div>
    </div>
  );
}

