import {
  $,
  Div,
  Float,
  Floor,
  glsl,
  Modulo,
  Mul,
  Snippet,
  Texture2D,
  Unit,
  Vec2,
  Vec3,
} from "shader-composer";

export const BillboardUnit = (position: Unit<"vec2">, view: Unit<"mat4">) => {
  const getBillboardPositionSnippet = Snippet(
    (name) => glsl`
      vec3 ${name}(vec2 v, mat4 view){
        vec3 up = vec3(view[0][1], view[1][1], view[2][1]);
        vec3 right = vec3(view[0][0], view[1][0], view[2][0]);
        vec3 p = right * v.x + up * v.y;
        return p;
      }`
  );

  const pos = $`${getBillboardPositionSnippet}( ${position}, ${view} )`;

  return Vec3(pos);
};

export const FlipbookUV = (
  uv: Unit<"vec2">,
  size: Unit<"vec2">,
  index: Unit<"float">
) => {
  const horizontalIndex = Modulo(index, size.x);
  const verticalIndex = Floor(Div(index, size.x));

  const u = Float(
    $` (${uv.x} + .5) / ${size.x} + (1. / ${size.x} ) * ${horizontalIndex}`
  );
  const v = Float(
    $`((${uv.y} + .5) / ${size.y}) + 1. - (1. / ${size.y} ) * (${verticalIndex} + 1.)`
  );

  const flipbookUVs = Vec2([u, v]);

  return flipbookUVs;
};

export const PositionFromDataTexture = (
  texture: Unit<"sampler2D">,
  vertexID: Unit<"int">,
  numberOfVertices: Unit<"float">,
  size: Unit<"vec2">,
  index: Unit<"float">
): Unit<"vec3"> => {
  const uvX = Div(Float(vertexID), numberOfVertices);
  const uvY = Mul(Div(1, Mul(size.x, size.y)), index);

  return Vec3(Texture2D(texture, Vec2([uvX, uvY])));
};
