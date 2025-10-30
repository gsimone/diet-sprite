import { useEffect, useRef, useState, useMemo } from "react";
import { PolygonGenerator } from "diet-sprite";
import NumberFlow from "@number-flow/react";
import { cx } from "class-variance-authority";

import defaultDepthImage from "../../assets/depth_1.png";
import { DEFAULT_FPS } from "../constants";

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
  fps = DEFAULT_FPS,
  onPolygonGenerated,
  showBackgroundNumber = false,
  alphaColor,
  onClick,
}: DebugCanvasProps) {
  const [debugCanvas, setDebugCanvas] = useState<HTMLCanvasElement | null>(
    null
  );
  const [areaReduction, setAreaReduction] = useState(0);
  const [containerSize, setContainerSize] = useState(size);
  const containerRef = useRef<HTMLDivElement>(null);
  const generationTimeRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const currentFrameRef = useRef<number>(0);
  const previousGridSizeRef = useRef<number>(gridSize);

  // Memoize slices calculation - only recalculates when gridSize changes
  const slices = useMemo<[number, number]>(() => {
    const gridDimension = Math.sqrt(gridSize);
    return [gridDimension, gridDimension];
  }, [gridSize]);

  // Measure container size
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const minSize = Math.min(width, height);
        if (minSize > 0) {
          setContainerSize(minSize);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Clear canvas immediately when it's set to prevent showing old content
  useEffect(() => {
    if (!debugCanvas) return;
    
    // Set dimensions to 0 initially to ensure it's cleared
    debugCanvas.width = 0;
    debugCanvas.height = 0;
  }, [debugCanvas]);

  useEffect(() => {
    if (!debugCanvas) return;

    // If image is already loaded and imageSrc hasn't changed, reuse it
    const cachedImage = imageRef.current;
    const shouldReuseImage = cachedImage && cachedImage.src === imageSrc && cachedImage.complete;
    
    const image = shouldReuseImage ? cachedImage : new Image();
    
    if (!shouldReuseImage) {
      image.src = imageSrc;
    }
    
    const generatePolygon = async () => {
      // Set canvas dimensions immediately to clear old content
      // Setting width/height automatically clears the canvas
      const baseSize = containerSize / 2;
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

      const ctx = debugCanvas.getContext("2d");
      if (!ctx) return;

      const t0 = performance.now();

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

      // Calculate actual sprite dimensions to get correct aspect ratio
      const [cols, rows] = slices;
      const spriteWidth = image.width / cols;
      const spriteHeight = image.height / rows;
      const spriteAspect = spriteWidth / spriteHeight;

      // Helper function to draw polygon
      const drawPolygon = () => {
        // Adjust content dimensions to maintain correct aspect ratio of the sprite
        let actualContentWidth = contentWidth;
        let actualContentHeight = contentHeight;
        let offsetX = paddingX;
        let offsetY = paddingY;

        if (spriteAspect > 1) {
          // Wider than tall
          actualContentHeight = contentWidth / spriteAspect;
          offsetY = paddingY + (contentHeight - actualContentHeight) / 2;
        } else {
          // Taller than wide
          actualContentWidth = contentHeight * spriteAspect;
          offsetX = paddingX + (contentWidth - actualContentWidth) / 2;
        }

        // Positions are normalized [-0.5, 0.5], need to transform to canvas space with offset
        const toCanvasX = (x: number) => (x + 0.5) * actualContentWidth + offsetX;
        const toCanvasY = (y: number) => (0.5 - y) * actualContentHeight + offsetY; // flip Y

        // Draw white rectangle representing the original sprite quad
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1 * scale * dpr;
        ctx.setLineDash([3 * scale * dpr, 3 * scale * dpr]);
        ctx.strokeRect(
          toCanvasX(-0.5),
          toCanvasY(0.5),
          actualContentWidth,
          actualContentHeight
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

      // Calculate adjusted dimensions for aspect ratio (same as in drawPolygon)
      let actualContentWidth = contentWidth;
      let actualContentHeight = contentHeight;
      let offsetX = paddingX;
      let offsetY = paddingY;

      if (spriteAspect > 1) {
        // Wider than tall
        actualContentHeight = contentWidth / spriteAspect;
        offsetY = paddingY + (contentHeight - actualContentHeight) / 2;
      } else {
        // Taller than wide
        actualContentWidth = contentHeight * spriteAspect;
        offsetX = paddingX + (contentWidth - actualContentWidth) / 2;
      }

      if (animate) {
        // Animation mode: cycle through atlas frames
        const [cols, rows] = slices;
        const totalFrames = cols * rows;

        // Reset frame only if gridSize changed
        if (previousGridSizeRef.current !== gridSize) {
          currentFrameRef.current = 0;
          previousGridSizeRef.current = gridSize;
        }

        // Ensure current frame is within valid range for the current grid size
        if (currentFrameRef.current >= totalFrames) {
          currentFrameRef.current = 0;
        }

        const frameDuration = 1000 / fps;
        let lastFrameTime = 0;

        const animationLoop = (timestamp: number) => {
          if (timestamp - lastFrameTime >= frameDuration) {
            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Calculate current frame position in atlas
            const col = currentFrameRef.current % cols;
            const row = Math.floor(currentFrameRef.current / cols);
            const sx = col * spriteWidth;
            const sy = row * spriteHeight;

            // Draw current sprite frame with correct aspect ratio
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
              image,
              sx,
              sy,
              spriteWidth,
              spriteHeight,
              offsetX,
              offsetY,
              actualContentWidth,
              actualContentHeight
            );

            // Draw polygon on top
            drawPolygon();

            // Update frame
            currentFrameRef.current = (currentFrameRef.current + 1) % totalFrames;
            lastFrameTime = timestamp;
          }

          animationFrameRef.current = requestAnimationFrame(animationLoop);
        };

        animationFrameRef.current = requestAnimationFrame(animationLoop);
      } else {
        // Static mode: draw once with correct aspect ratio
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          await createImageBitmap(polygon.imageData),
          offsetX,
          offsetY,
          actualContentWidth,
          actualContentHeight
        );

        drawPolygon();
      }
    };

    // Handle image load - if already cached/complete, generate immediately
    if (shouldReuseImage || image.complete) {
      imageRef.current = image;
      generatePolygon();
    } else {
      image.onload = () => {
        imageRef.current = image;
        generatePolygon();
      };
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Only clear imageRef if imageSrc is changing (not just other params)
      if (!shouldReuseImage) {
        imageRef.current = null;
      }
    };
  }, [
    debugCanvas,
    imageSrc,
    numberOfVertices,
    threshold,
    slices,
    indices,
    accumulateSprites,
    animate,
    containerSize,
    fps,
    alphaColor,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-square ${
        onClick ? "cursor-pointer transition-transform" : ""
      }`}
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

