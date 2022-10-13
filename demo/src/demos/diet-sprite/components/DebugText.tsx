import { Text } from "@react-three/drei";

export const DebugText = ({ children }) => {
  return (
    <Text
      fontSize={0.2 / 6}
      position-y={-3.25 / 6}
      position-x={3 / 6}
      anchorX="right"
      anchorY="top"
      visible={debug}
      color="#fff"
    >
      {children}
    </Text>
  );
};
