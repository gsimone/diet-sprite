import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";

export const materialKey = (() => Math.random())();

import { BillboardMaterial } from './materials/BillboardMaterial'

extend({ BillboardMaterial });
