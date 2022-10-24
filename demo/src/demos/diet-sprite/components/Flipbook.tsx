import { useMemo, useRef } from "react";

import { createClippedFlipbook } from "diet-sprite";
import { MeshBasicMaterial, Texture } from "three";
import { DebugBackground } from "./DebugBackground";
import { DebugText } from "./DebugText";
import { MyMaterial } from "../materials/MyMaterial";

type MyFlipbookProps = {
  map: Texture;
  fps: number;
  debug: boolean;
  vertices: number;
  horizontalSlices: number;
  verticalSlices: number;
  threshold: number;
};

export function MyFlipbook({
  map,
  fps = 30,
  debug,
  vertices,
  horizontalSlices,
  verticalSlices,
  threshold,
  ...props
}: MyFlipbookProps) {
  const $mat = useRef<MeshBasicMaterial>(null!);
  const $mat2 = useRef<MeshBasicMaterial>(null!);

  const [geometry, dataTexture, _, savings] = useMemo(() => {
    return createClippedFlipbook(map.image, vertices, threshold, [
      horizontalSlices,
      verticalSlices,
    ]);
  }, [map.image, vertices, horizontalSlices, verticalSlices, threshold]);

  return (
    <group {...props} scale={6}>
      {debug && <DebugBackground />}
      {debug && (
        <DebugText>
          avg {format(savings.avg * 100)}% - min {format(savings.min * 100)}% -
          max {format(savings.max * 100)}%
        </DebugText>
      )}

      {debug && (
        <mesh position-x={0.65} scale-x={1 / 4}>
          <planeGeometry />
          <meshBasicMaterial map={dataTexture} color="white" />
        </mesh>
      )}

      <mesh
        renderOrder={1}
        visible={debug}
        geometry={geometry}
      >
        <MyMaterial
          debug
          wireframe
          ref={$mat}
          flipbookMap={map}
          dataTexture={dataTexture}
          size={[horizontalSlices, verticalSlices]}
          vertices={vertices}
        />
      </mesh>

      <mesh geometry={geometry}>
        <MyMaterial
          transparent
          ref={$mat2}
          flipbookMap={map}
          dataTexture={dataTexture}
          size={[horizontalSlices, verticalSlices]}
          vertices={vertices}
        />
      </mesh>
    </group>
  );
}

/**
 * You can ignore this
 */
// format number to 2 decimal places
function format(number: number) {
  return Math.round(number * 100) / 100;
}
