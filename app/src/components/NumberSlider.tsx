import { useRef, useState } from "react";
import { useDrag } from "@use-gesture/react";
import { cx } from "class-variance-authority";

export interface NumberSliderProps {
  value: number;
  onChange: (value: number) => void;
  options: number[];
  itemWidth?: number; // Optional custom item width
  width?: number; // Optional fixed width for the slider container
}

export function NumberSlider({
  value,
  onChange,
  options,
  itemWidth: customItemWidth,
  width,
}: NumberSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartIndexRef = useRef<number>(options.indexOf(value));
  const lastSelectedIndexRef = useRef<number>(options.indexOf(value));
  const wasDraggedRef = useRef<boolean>(false);

  const centerIndex = options.indexOf(value);
  const itemWidth = customItemWidth ?? 40; // Use custom width if provided, default to 40

  const handleClick = (e: React.MouseEvent) => {
    // Only handle click if there was no actual drag
    if (!wasDraggedRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const containerCenter = rect.width / 2;
      const relativeX = clickX - containerCenter;

      // Account for current drag offset when calculating which item was clicked
      const adjustedX = relativeX + dragOffset;
      const itemIndexDelta = Math.round(adjustedX / itemWidth);
      const newIndex = Math.max(
        0,
        Math.min(options.length - 1, centerIndex + itemIndexDelta)
      );

      if (options[newIndex] !== value) {
        onChange(options[newIndex]);
      }
      setDragOffset(0);
    }
    wasDraggedRef.current = false;
  };

  const bind = useDrag(
    ({ movement: [mx], dragging, active, first }) => {
      setIsDragging(active);

      if (first) {
        // Reset tracking when drag starts
        dragStartIndexRef.current = options.indexOf(value);
        lastSelectedIndexRef.current = options.indexOf(value);
        setDragOffset(0);
        wasDraggedRef.current = false;
        
        // Request pointer lock
        if (containerRef.current) {
          containerRef.current.requestPointerLock();
        }
      }

      if (dragging) {
        // Mark that we've dragged (not just clicked)
        if (Math.abs(mx) > 5) {
          wasDraggedRef.current = true;
        }

        // Calculate which item should be selected based on cumulative drag
        // Negative mx because: drag left = higher number (higher index)
        const totalMovement = -mx;
        const itemIndexDelta = Math.round(totalMovement / itemWidth);
        const clampedDelta = Math.max(
          -dragStartIndexRef.current,
          Math.min(
            options.length - 1 - dragStartIndexRef.current,
            itemIndexDelta
          )
        );
        const newIndex = dragStartIndexRef.current + clampedDelta;

        // Only update if we've moved to a different item
        if (
          newIndex !== lastSelectedIndexRef.current &&
          newIndex >= 0 &&
          newIndex < options.length
        ) {
          onChange(options[newIndex]);
          lastSelectedIndexRef.current = newIndex;
        }

        // Calculate offset relative to the currently selected item's center
        // This keeps the visual position smooth
        const currentSelectedIndex = lastSelectedIndexRef.current;
        let offsetFromCurrentCenter =
          totalMovement -
          (currentSelectedIndex - dragStartIndexRef.current) * itemWidth;

        // Clamp offset to prevent dragging beyond first/last items
        // Drag left (mx negative) = higher index, drag right (mx positive) = lower index
        // At first item (index 0), can't drag left (positive offset = selecting higher index, but we're already at 0)
        // At last item, can't drag right (negative offset = selecting lower index, but we're already at last)
        if (currentSelectedIndex === 0) {
          offsetFromCurrentCenter = Math.max(0, offsetFromCurrentCenter); // Can't drag left
        } else if (currentSelectedIndex === options.length - 1) {
          offsetFromCurrentCenter = Math.min(0, offsetFromCurrentCenter); // Can't drag right
        }

        setDragOffset(offsetFromCurrentCenter);
      } else {
        // Drag ended - snap to center and reset
        setDragOffset(0);
        dragStartIndexRef.current = options.indexOf(value);
        lastSelectedIndexRef.current = options.indexOf(value);
        
        // Exit pointer lock
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
    },
    {
      axis: "x",
      pointer: { capture: false }, // Disable capture to allow clicks
    }
  );

  return (
    <div
      ref={containerRef}
      {...bind()}
      onClick={handleClick}
      className="relative flex items-center justify-center h-8 overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
      style={{
        width: width ? `${width}px` : `${itemWidth * options.length}px`,
        maxWidth: width ? `${width}px` : `${itemWidth * 5}px`, // Show max 5 items (selected + 2 on each side)
      }}
    >
      {options.map((num, index) => {
        const offset = (index - centerIndex) * itemWidth - dragOffset;
        const distance = Math.abs(offset) / itemWidth * .5; 

        // Calculate opacity based on pixel distance from center
        // Exponential decay for smooth fade based on position
        const opacity = Math.exp(-distance * 1.8);

        const scale = Math.max(0.8, 1 - distance / 3);
        const isSelected = num === value;

        return (
          <div
            key={num}
            className="absolute flex items-center justify-center select-none pointer-events-none"
            style={{
              transform: `translateX(${offset}px) scale(${scale})`,
              opacity: opacity,
              transition: isDragging
                ? "none"
                : "transform 0.2s ease-out, opacity 0.2s ease-out",
            }}
          >
            <span
              className={cx(
                "px-2 py-1",
                isSelected ? "font-bold" : "font-normal"
              )}
            >
              {num}
            </span>
          </div>
        );
      })}
    </div>
  );
}

