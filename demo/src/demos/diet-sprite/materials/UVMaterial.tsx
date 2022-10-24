import { shaderMaterial } from "@react-three/drei";
import { UV, Vec3 } from "shader-composer";
import { Shader, ShaderMaster, useShader } from "shader-composer-r3f";

export const UVMaterial = () => {
  const shader = useShader(() => {

    return ShaderMaster({
      color: Vec3([UV, 0.])
    })
  })

  return (
    <meshBasicMaterial wireframe>
      <Shader {...shader} />
    </meshBasicMaterial>
  );
}
