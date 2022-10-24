import { shaderMaterial } from "@react-three/drei";
import { forwardRef } from "react";
import {
  $,
  Add,
  Div,
  Float,
  Floor,
  GlobalTime,
  InstanceID,
  Modulo,
  Mul,
  Sub,
  Texture2D,
  Unit,
  varying,
  Vec2,
  Vec3,
  VertexID,
} from "shader-composer";
import {
  Shader,
  ShaderMaster,
  useShader,
  useUniformUnit,
} from "shader-composer-r3f";
import { DataTexture, Material, MeshBasicMaterial, MeshBasicMaterialParameters, Texture, Vector2 } from "three";
import { billboardChunk } from "./common";

import { pipe } from "fp-ts/lib/function";

const getFlipbookUV = (
  uv: Unit<"vec2">,
  size: Unit<"vec2">,
  index: Unit<"float">
): Unit<"vec2"> => {
  const horizontalIndex = Modulo(index, size.x);
  const verticalIndex = Floor(Div(index, size.x));

  const u = Float(
    $` (${uv.x} + .5) / ${size.x} + (1. / ${size.x} ) * ${horizontalIndex} `
  );
  const v = Float(
    $`((${uv.y} + .5) / ${size.y}) + 1. - (1. / ${size.y} ) * (${verticalIndex} + 1.)`
  );

  const flipbookUVs = Vec2([u, v]);

  return flipbookUVs;
};

const getPositionFromDataTexture = (
  texture: Unit<"sampler2D">,
  vertexID: Unit<"int">,
  numberOfVertices: Unit<"float">,
  size: Unit<"vec2">,
  index: Unit<"float">
): Unit<"vec3"> => {
  // total number of sprites in the flipbook
  const total = Mul(size.x, size.y);

  const uv = Vec2([
    Div(Float(vertexID), numberOfVertices),
    Mul(Div(1, total), index),
  ]);

  const pos = Vec3(Texture2D(texture, uv));

  return pos;
};

interface MaterialProps extends MeshBasicMaterialParameters {
  dataTexture: DataTexture;
  size: [number, number];
  vertices: number;
  flipbookMap: Texture;
  fps?: number;
};

export const MyMaterial = forwardRef<Material, MaterialProps>(
  (
    {
      dataTexture,
      fps = 30,
      size = [1, 1],
      flipbookMap,
      vertices = 8,
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

    /**
     * Scrolls the index of the flipbook based on global time and fps
     */
    let index = pipe(
      GlobalTime,
      (t) => Mul(t, fps),
      (v) => Floor(v),
      (v) => Modulo(v, Mul(uSize.x, uSize.y))
    );

    /**
     * Just to do a little variation in the instanced example, offset the index by the instanceID
     */
    index = Sub(index, Modulo( Float(InstanceID), Mul(uSize.x, uSize.y) ));

    const shader = useShader(() => {
      const position = getPositionFromDataTexture(
        uDataTexture,
        VertexID,
        uNumberOfVertices,
        uSize,
        index
      );

      const flipbookUVs = varying(getFlipbookUV(Vec2(position), uSize, index));

      const color = Texture2D(uMap, flipbookUVs);

      return ShaderMaster({
        position: position,
        color: color.color,
        alpha: color.alpha,
      });
    });

    return (
      <meshBasicMaterial ref={ref} {...props}>
        <Shader {...shader} />
      </meshBasicMaterial>
    );
  }
);