import { Plane, Text } from "@react-three/drei";
import { useMemo, useRef } from "react";

import { createClippedFlipbook } from "diet-sprite";
import { materialKey } from "../materials";
import { useFrame } from "@react-three/fiber";
import { Texture } from "three";

type MyFlipbookProps = {
  map: Texture;
  fps: number;
  showPolygon: boolean;
  vertices: number;
  horizontalSlices: number;
  verticalSlices: number;
  threshold: number;
};

export function MyFlipbook({
  map,
  fps = 30,
  showPolygon,
  vertices,
  horizontalSlices,
  verticalSlices,
  threshold,
  ...props
}: MyFlipbookProps) {
  const $mat = useRef();
  const $mat2 = useRef();

  const [geometry, dataTexture, _, savings] = useMemo(() => {
    return createClippedFlipbook(
      map.image,
      vertices,
      threshold,
      horizontalSlices,
      verticalSlices
    );
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
    <group {...props}>
      <Plane scale={6}>
        <meshBasicMaterial wireframe transparent opacity={0.3} />
      </Plane>

      <mesh scale-y={-6} position-x={3.5}>
        <planeGeometry />
        <meshBasicMaterial map={dataTexture} color="white" />
      </mesh>

      <mesh
        scale={6.1}
        renderOrder={1}
        visible={showPolygon}
        geometry={geometry}
        position-z={0.1}
      >
        <myMaterial
          depthRead={false}
          key={materialKey}
          ref={$mat}
          u_data={dataTexture}
          u_debugUv={1}
          u_horizontalSlices={horizontalSlices}
          u_map={map}
          u_vertices={vertices}
          u_verticalSlices={verticalSlices}
          wireframe
        />
      </mesh>

      <mesh scale={6} geometry={geometry}>
        <myMaterial
          key={materialKey}
          ref={$mat2}
          transparent
          u_data={dataTexture}
          u_horizontalSlices={horizontalSlices}
          u_map={map}
          u_vertices={vertices}
          u_verticalSlices={verticalSlices}
        />
      </mesh>
      <Text
        fontSize={0.2}
        position-y={-3.25}
        position-x={3}
        anchorX="right"
        anchorY="top"
      >
        avg {format(savings.avg * 100)}% - min {format(savings.min * 100)}% -
        max {format(savings.max * 100)}%
      </Text>
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
