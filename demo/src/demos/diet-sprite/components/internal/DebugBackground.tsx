import { Plane } from "@react-three/drei";

export const DebugBackground = () => {
  return (
    <Plane>
      <meshBasicMaterial color="#fff" wireframe transparent opacity={0.3} />
    </Plane>
  );
};
