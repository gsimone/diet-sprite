import { PolygonGenerator } from "diet-sprite";
import { generateGLTF } from "./generateGLTF";
import { downloadFile } from "./download";

/**
 * Generates a GLTF from PolygonGenerator data and downloads it
 * 
 * @param polygon The PolygonGenerator instance containing the geometry data
 * @param filename The name of the file to download (default: "sprite.gltf")
 */
export function downloadGLTF(polygon: PolygonGenerator, filename: string = "sprite.gltf") {
  const gltf = generateGLTF(polygon);
  downloadFile(gltf, filename, "model/gltf+json");
}

