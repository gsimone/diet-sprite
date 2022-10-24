import { FC } from "react";
import { $, Vec2, VertexPosition, ViewMatrix } from "shader-composer";
import { Shader, ShaderMaster, useShader } from "shader-composer-r3f";
import { MeshBasicMaterial } from "three";
import { BillboardUnit } from "./common";

export const BillboardMaterial: FC<Partial<MeshBasicMaterial>> = (props) => {
  const shader = useShader(() => {
    return ShaderMaster({
      position: BillboardUnit(Vec2(VertexPosition), ViewMatrix),
    });
  });

  return (
    <meshBasicMaterial {...props}>
      <Shader {...shader} />
    </meshBasicMaterial>
  );
};
