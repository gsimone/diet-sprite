import { Edges, Plane, Text } from "@react-three/drei";
import { folder, useControls } from "leva";
import { useLayoutEffect, useRef, useState } from "react";
import { BufferGeometry } from "three";
import { DebugBackground } from "./DebugBackground";
import { DebugText } from "./DebugText";

export function MySprite({
  map,
  index,
  vertices,
  debug,
  threshold,
  horizontalSlices,
  verticalSlices,
  ...props
}) {
  const ref = useRef<BufferGeometry>(null!);
  const [reduction, setReduction] = useState(0);

  const horizontalIndex = index % horizontalSlices;
  const verticalIndex = Math.floor(index / horizontalSlices);

  useLayoutEffect(() => {
    setReduction(-Math.floor(ref.current.userData.reduction * 100));
  }, [
    map,
    index,
    vertices,
    setReduction,
    threshold,
    horizontalIndex,
    verticalIndex,
  ]);

  return (
    <group {...props} scale={6}>
      {debug && <DebugBackground />}
      {debug && <DebugText>Area difference: {reduction}%</DebugText>}

      <mesh>
        <clippedSpriteGeometry
          ref={ref}
          args={[
            map,
            vertices,
            threshold,
            [horizontalSlices, verticalSlices],
            [horizontalIndex, verticalIndex],
          ]}
        />
        <myBillboardMaterial
          map={map}
          transparent
          alphaTest={threshold}
          alphaMap={map}
        />
      </mesh>

      <mesh visible={debug}>
        <clippedSpriteGeometry
          args={[
            map,
            vertices,
            threshold,
            [horizontalSlices, verticalSlices],
            [horizontalIndex, verticalIndex],
          ]}
        />
        <myUVsMaterial depthTest={false} wireframe transparent />
      </mesh>
    </group>
  );
}
