import { useLayoutEffect, useRef } from "react";

import { useFrame } from "@react-three/fiber";
import { InstancedMesh, NormalBlending, Object3D, Texture } from "three";

import * as random from "maath/random";

import { useClippedFlipbook } from "./Flipbook";
import { materialKey } from "../materials";

type Props = {
  map: Texture;
  fps: boolean;
  showPolygon: boolean;
  vertices: number;
  horizontalSlices: number;
  verticalSlices: number;
  threshold: number;
};

export function MyInstances(props: Props) {
  const { map, fps, vertices, horizontalSlices, verticalSlices, threshold } =
    props;

  const [geometry, dataTexture] = useClippedFlipbook(
    map,
    vertices,
    horizontalSlices,
    verticalSlices,
    threshold
  );

  const $mat = useRef();

  const $instancedMesh = useRef<InstancedMesh>();

  const count = 300;
  const points = random.inSphere(new Float32Array(count * 3), {
    radius: 0.5,
  }) as Float32Array;

  useLayoutEffect(() => {
    const dummy = new Object3D();
    if ($instancedMesh.current) {
      for (let i = 0; i < points.length; i += 3) {
        const [x, y, z] = points.slice(i * 3, i * 3 + 3);
        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        $instancedMesh.current.setMatrixAt(i, dummy.matrix);
      }

      $instancedMesh.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if ($mat.current) {
      $mat.current.uniforms.u_index.value =
        Math.floor(t * fps) % (horizontalSlices * verticalSlices);
    }
  });

  return (
    <instancedMesh
      ref={$instancedMesh}
      geometry={geometry}
      args={[undefined, undefined, count]}
    >
      <myMaterial
        ref={$mat}
        key={materialKey}
        blending={NormalBlending}
        depthWrite={false}
        u_data={dataTexture}
        u_horizontalSlices={horizontalSlices}
        u_map={map}
        u_vertices={vertices}
        u_verticalSlices={verticalSlices}
        transparent
      />
    </instancedMesh>
  );
}
