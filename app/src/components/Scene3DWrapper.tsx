import { useEffect, useRef } from "react";
import { Scene3D, Scene3DOptions } from "./Scene3DVanilla";

interface Scene3DWrapperProps extends Omit<Scene3DOptions, "container"> {
  className?: string;
}

export function Scene3DWrapper(props: Scene3DWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene3D | null>(null);

  // Create scene only when imageSrc changes
  useEffect(() => {
    if (!containerRef.current) return;

    console.log('Creating new Scene3D instance');
    sceneRef.current = new Scene3D({
      container: containerRef.current,
      imageSrc: props.imageSrc,
      vertices: props.vertices,
      threshold: props.threshold,
      gridSize: props.gridSize,
      animate: props.animate,
      fps: props.fps,
      useInstancing: props.useInstancing,
      instanceGridSize: props.instanceGridSize,
    });

    return () => {
      console.log('Disposing Scene3D instance');
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [props.imageSrc]);

  // Update geometry when vertices, threshold, or gridSize changes
  useEffect(() => {
    if (sceneRef.current) {
      console.log('Updating geometry params:', { 
        vertices: props.vertices, 
        threshold: props.threshold, 
        gridSize: props.gridSize 
      });
      sceneRef.current.updateGeometryParams(
        props.vertices,
        props.threshold,
        props.gridSize
      );
    }
  }, [props.vertices, props.threshold, props.gridSize]);

  // Update animation when animate or fps changes
  useEffect(() => {
    if (sceneRef.current) {
      console.log('Updating animation params:', { 
        animate: props.animate, 
        fps: props.fps 
      });
      sceneRef.current.updateAnimationParams(
        props.animate ?? false,
        props.fps ?? 30
      );
    }
  }, [props.animate, props.fps]);

  // Update instancing when useInstancing or instanceGridSize changes
  useEffect(() => {
    if (sceneRef.current) {
      console.log('Updating instancing params:', { 
        useInstancing: props.useInstancing, 
        instanceGridSize: props.instanceGridSize 
      });
      sceneRef.current.updateInstancingParams(
        props.useInstancing ?? false,
        props.instanceGridSize ?? 128
      );
    }
  }, [props.useInstancing, props.instanceGridSize]);

  return (
    <div className="w-full h-full relative">
      <div
        ref={containerRef}
        className={`w-full h-full relative ${props.className || ""}`}
      ></div>
      <div className="absolute left-0  right-0 bottom-[200px] grid grid-cols-2 gap-4  tex-center">
        
        <div className="text-center text-white font-bold text-[12px]">plane geometry</div>
        <div className="text-center text-[rgb(255,26,125)] font-bold text-[12px]"><strong>diet</strong>sprite geometry</div>
      </div>
    </div>
  );
}
