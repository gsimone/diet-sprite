import { useEffect, useRef, useState } from "react";
import { PolygonGenerator } from "diet-sprite";

interface AtlasDebugCanvasProps {
  numberOfVertices?: number;
  threshold?: number;
  gridSize?: number;
  imageSrc?: string;
  alphaColor?: [number, number, number];
  size?: number;
}

export function AtlasDebugCanvas({
  numberOfVertices = 6,
  threshold = 0.5,
  gridSize = 256,
  imageSrc,
  alphaColor,
  size = 512,
}: AtlasDebugCanvasProps) {
  const [atlasCanvas, setAtlasCanvas] = useState<HTMLCanvasElement | null>(
    null
  );
  const [containerSize, setContainerSize] = useState(size);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!atlasCanvas || !imageSrc) return;

    const image = new Image();
    image.src = imageSrc;
    image.onload = async () => {
      const ctx = atlasCanvas.getContext("2d");
      if (!ctx) return;

      // Convert gridSize to slices array
      const gridDimension = Math.sqrt(gridSize);
      const cols = Math.floor(gridDimension);
      const rows = Math.floor(gridDimension);
      const slices: [number, number] = [cols, rows];

      // 1. Apply padding to the whole canvas (same as DebugCanvas)
      const dpr = window.devicePixelRatio || 1;
      const baseSize = containerSize / 2; // size is display size, base is half
      const scale = 4;
      const padding = 0.2;
      const contentWidth = baseSize * scale * dpr;
      const contentHeight = baseSize * scale * dpr;
      const paddingX = contentWidth * padding;
      const paddingY = contentHeight * padding;
      const canvasWidth = contentWidth + paddingX * 2;
      const canvasHeight = contentHeight + paddingY * 2;

      atlasCanvas.width = canvasWidth;
      atlasCanvas.height = canvasHeight;

      // Generate ONE polygon using accumulateSprites
      const polygon = new PolygonGenerator(
        image,
        {
          threshold,
          slices,
          indices: [0, 0], // indices don't matter when accumulateSprites is true
          accumulateSprites: true,
          ...(alphaColor ? { alphaColor } : {}),
        },
        numberOfVertices
      );

      // 2. Draw the full atlas image in the middle (content area)
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        image,
        paddingX,
        paddingY,
        contentWidth,
        contentHeight
      );

      // Helper function to draw the polygon at a specific tile position
      const drawPolygonAtTile = (col: number, row: number) => {
        // Calculate tile position and size within the content area (high DPI coordinates)
        const tileContentWidth = contentWidth / cols;
        const tileContentHeight = contentHeight / rows;
        const tileX = paddingX + col * tileContentWidth;
        const tileY = paddingY + row * tileContentHeight;

        // 3. Draw white rectangle representing the original sprite quad (no padding)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1  * dpr;
        ctx.setLineDash([2 * scale * dpr, 2 * scale * dpr]);
        ctx.strokeRect(tileX, tileY, tileContentWidth, tileContentHeight);

        // Build edge map to identify inner vs outer edges
        const edgeMap = new Map<string, number>();

        for (let i = 0; i < polygon.index.length; i += 3) {
          const v0 = polygon.index[i];
          const v1 = polygon.index[i + 1];
          const v2 = polygon.index[i + 2];

          const edges = [
            [v0, v1].sort((a, b) => a - b).join(","),
            [v1, v2].sort((a, b) => a - b).join(","),
            [v2, v0].sort((a, b) => a - b).join(","),
          ];

          edges.forEach((edge) => {
            edgeMap.set(edge, (edgeMap.get(edge) || 0) + 1);
          });
        }

        // Transform normalized positions [-0.5, 0.5] to tile coordinates (no padding)
        const toTileX = (x: number) => tileX + (x + 0.5) * tileContentWidth;
        const toTileY = (y: number) => tileY + (0.5 - y) * tileContentHeight; // flip Y

        // 4. Draw the polygon for this atlas member
        ctx.strokeStyle = "rgb(255, 26, 125)";
        ctx.lineWidth = 1  * dpr;

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

            ctx.setLineDash(isInner ? [3, 3] : []);

            const i0 = verts[0] * 3;
            const i1 = verts[1] * 3;

            ctx.beginPath();
            ctx.moveTo(
              toTileX(polygon.positions[i0]),
              toTileY(polygon.positions[i0 + 1])
            );
            ctx.lineTo(
              toTileX(polygon.positions[i1]),
              toTileY(polygon.positions[i1 + 1])
            );
            ctx.stroke();
          });
        }

        ctx.setLineDash([]);
      };

      // Draw the same polygon on each tile in the atlas
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          drawPolygonAtTile(col, row);
        }
      }
    };
  }, [
    atlasCanvas,
    imageSrc,
    numberOfVertices,
    threshold,
    gridSize,
    alphaColor,
    containerSize,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square"
    >
      <canvas ref={setAtlasCanvas} className="w-full h-full" />
    </div>
  );
}

