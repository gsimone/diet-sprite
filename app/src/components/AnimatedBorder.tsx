import { memo, useCallback, useEffect, useRef, useState, type FC } from 'react';

import { cx } from "class-variance-authority";

type AnimatedBorderProps = {
    className?: string;
    strokeWidth?: number;
    dashArray?: string;
    animationDuration?: number;
};
/**
 * A simple presentational component that makes the dotted lines for the drop affordance
 */
export const AnimatedBorder: FC<AnimatedBorderProps> = memo(
    ({ className = '', strokeWidth = 1, dashArray = '6 3', animationDuration = 1 }) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

        // Calculate the total dash pattern length for animation
        const dashPatternTotal = dashArray
            .split(' ')
            .map(Number)
            .reduce((sum, value) => sum + value, 0);

        const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        }, []);

        useEffect(() => {
            const element = containerRef.current;
            if (!element) return;

            const resizeObserver = new ResizeObserver(handleResize);
            resizeObserver.observe(element);

            // Set initial dimensions
            const { width, height } = element.getBoundingClientRect();
            setDimensions({ width, height });

            return () => {
                resizeObserver.disconnect();
            };
        }, [handleResize]);

        return (
            <div
                ref={containerRef}
                className={cx(
                    'pointer-events-none absolute inset-4 z-10 text-semantic-primary-normal',
                    className
                )}
            >
                {dimensions.width > 0 && dimensions.height > 0 && (
                    <svg
                        width={dimensions.width}
                        height={dimensions.height}
                        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                        className="absolute inset-0"
                    >
                        <rect
                            x={strokeWidth / 2}
                            y={strokeWidth / 2}
                            width={dimensions.width - strokeWidth}
                            height={dimensions.height - strokeWidth}
                            rx="6"
                            ry="6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            strokeDasharray={dashArray}
                            strokeLinecap="round"
                        >
                            <animate
                                attributeName="stroke-dashoffset"
                                values={`0;${dashPatternTotal}`}
                                dur={`${animationDuration}s`}
                                repeatCount="indefinite"
                            />
                        </rect>
                    </svg>
                )}
            </div>
        );
    }
);

AnimatedBorder.displayName = 'AnimatedBorder';
