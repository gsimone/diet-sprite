import { Text } from "@react-three/drei";
import React from "react";

export const DebugText: React.FC = ({ children }) => {
  return (
    <Text
      fontSize={0.2 / 6}
      position-y={-3.25 / 6}
      position-x={3 / 6}
      anchorX="right"
      anchorY="top"
      color="#fff"
    >
      {children}
    </Text>
  );
};
