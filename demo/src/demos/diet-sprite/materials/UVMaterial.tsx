import { FC } from "react";
import { UV, Vec2, Vec3, VertexPosition, ViewMatrix } from "shader-composer";
import { Shader, ShaderMaster, useShader } from "shader-composer-r3f";
import { MeshBasicMaterialParameters } from "three";
import { BillboardUnit } from "./common";

export const UVMaterial: FC<MeshBasicMaterialParameters> = (props) => {
  const shader = useShader(() => {

    return ShaderMaster({
      position: BillboardUnit(Vec2(VertexPosition), ViewMatrix),
      color: Vec3([UV, 0.]),
    })
  })

  return (
    <meshBasicMaterial {...props}>
      <Shader {...shader} />
    </meshBasicMaterial>
  );
}
