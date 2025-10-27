import React from 'react';

interface CanvasLabelProps {
  text: string;
  color?: string;
  side?: 'left' | 'right';
}

export const CanvasLabel: React.FC<CanvasLabelProps> = ({ 
  text, 
  color = 'rgba(255, 255, 255, 0.7)',
  side = 'left'
}) => {
  return (
    <div 
      className="absolute bottom-[90px] transform -translate-x-1/2 text-lg font-semibold font-sans pointer-events-none z-1000 px-2 py-1"
      style={{ 
        left: side === 'left' ? '25%' : '75%',
        color,
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
      }}
    >
      {text}
    </div>
  );
};
