import { Billboard, Plane, Text } from "@react-three/drei";
import { useMemo, useRef } from "react";

import { createClippedFlipbook } from "diet-sprite";
import { materialKey } from "../materials";
import { useFrame } from "@react-three/fiber";
import { Texture } from "three";
import { DebugBackground } from "./DebugBackground";
import { DebugText } from "./DebugText";

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
  const $mat = useRef();
  const $mat2 = useRef();

  const [geometry, dataTexture, _, savings] = useMemo(() => {
    return createClippedFlipbook(map.image, vertices, threshold, [
      horizontalSlices,
      verticalSlices,
    ]);
  }, [map.image, vertices, horizontalSlices, verticalSlices, threshold]);

  /**
   * Animates the u_index uniform to go through the flipbook
   */
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if ($mat.current && $mat2.current) {
      $mat.current.uniforms.u_index.value =
        $mat2.current.uniforms.u_index.value =
          Math.floor(t * fps) % (horizontalSlices * verticalSlices);
    }
  });

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
        position-z={0.1}
      >
        <myMaterial
          depthRead={false}
          key={materialKey}
          ref={$mat}
          u_data={dataTexture}
          u_debugUv={1}
          u_map={map}
          u_slices={[horizontalSlices, verticalSlices]}
          u_vertices={vertices}
          wireframe
        />
      </mesh>

      <mesh geometry={geometry}>
        <myMaterial
          key={materialKey}
          ref={$mat2}
          transparent
          u_data={dataTexture}
          u_map={map}
          u_slices={[horizontalSlices, verticalSlices]}
          u_vertices={vertices}
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
