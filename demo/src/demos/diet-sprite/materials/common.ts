import { $, glsl, Snippet, Unit, Vec3 } from "shader-composer";

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

  const pos = $`${getBillboardPositionSnippet}( ${position}, ${view} )`

  return Vec3(pos);
};
