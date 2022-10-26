import { forwardRef } from "react";
import {
  Float,
  Floor,
  GlobalTime,
  InstanceID,
  Modulo,
  Mul,
  Sub,
  Texture2D,
  varying,
  Vec2,
  Vec3,
  VertexID,
  ViewMatrix,
} from "shader-composer";

import {
  Shader,
  ShaderMaster,
  useShader,
  useUniformUnit,
} from "shader-composer-r3f";

import {
  DataTexture,
  MeshBasicMaterial,
  MeshBasicMaterialParameters,
  Texture,
  Vector2,
} from "three";

import { BillboardUnit, FlipbookUV, PositionFromDataTexture } from "./common";

import { pipe } from "fp-ts/lib/function";

interface MaterialProps extends MeshBasicMaterialParameters {
  dataTexture: DataTexture;
  size: [number, number];
  vertices: number;
  flipbookMap: Texture;
  fps?: number;
  debug?: boolean;
}

export const MyMaterial = forwardRef<MeshBasicMaterial, MaterialProps>(
  (
    {
      dataTexture,
      fps = 30,
      size = [1, 1],
      flipbookMap,
      vertices = 8,
      debug = false,
      ...props
    },
    ref
  ) => {
    const uDataTexture = useUniformUnit("sampler2D", dataTexture, {
      name: "positionsDataTexture",
    });
    const uSize = useUniformUnit("vec2", new Vector2(...size));
    const uNumberOfVertices = useUniformUnit("float", vertices);
    const uMap = useUniformUnit("sampler2D", flipbookMap);

    const total = Mul(uSize.x, uSize.y);

    /**
     * Scrolls the index of the flipbook based on global time and fps
     */
    let index = pipe(
      GlobalTime,
      (t) => Mul(t, fps),
      (v) => Floor(v),
      (v) => Modulo(v, total)
    );

    /**
     * Just to do a little variation in the instanced example, offset the index by the instanceID
     */
    index = Sub(index, Modulo(Float(InstanceID), total));

    const shader = useShader(() => {
      const position = PositionFromDataTexture(
        uDataTexture,
        VertexID,
        uNumberOfVertices,
        uSize,
        index
      );

      const flipbookUVs = varying(FlipbookUV(Vec2(position), uSize, index));

      const sample = Texture2D(uMap, flipbookUVs);

      return ShaderMaster({
        position: BillboardUnit(Vec2(position), ViewMatrix),
        color: debug ? Vec3([flipbookUVs, 0]) : sample.color,
        alpha: sample.alpha,
      });
    });

    return (
      <meshBasicMaterial ref={ref} {...props}>
        <Shader {...shader} />
      </meshBasicMaterial>
    );
  }
);
