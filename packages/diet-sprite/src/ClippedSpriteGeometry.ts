import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  RGBAFormat,
  Texture,
} from "three";
import { PolygonGenerator } from "./PolygonGenerator";
import { addAxis, fillBuffer } from "./utils";

const DEFAULT_SETTINGS = {
  threshold: 0.01,
  horizontalSlices: 1,
  verticalSlices: 1,
  horizontalIndex: 0,
  verticalIndex: 0,
};

export class ClippedSpriteGeometry extends BufferGeometry {
  image: HTMLImageElement;
  vertices: number = 8;
  settings = DEFAULT_SETTINGS;

  constructor(
    imageOrTexture: HTMLImageElement | Texture,
    vertices = 8,
    threshold = 0.01,
    horizontalSlices = 1,
    verticalSlices = 1,
    horizontalIndex = 0,
    verticalIndex = 0
  ) {
    super();

    this.vertices = vertices;
    this.settings = {
      ...this.settings,
      threshold,
      horizontalSlices,
      verticalSlices,
      horizontalIndex,
      verticalIndex,
    };

    this.image =
      "image" in imageOrTexture ? imageOrTexture.image : imageOrTexture;

    this.build();
  }

  build() {
    const polygon = new PolygonGenerator(
      this.image,
      this.settings,
      this.vertices
    );

    const count = polygon.positions.length;

    const indexBA = new BufferAttribute(polygon.index, 1);
    const positionsBA = new BufferAttribute(polygon.positions, 3);
    const normalBA = new BufferAttribute(fillBuffer(count, [0, 0, 1]), 3);
    const uvBA = new BufferAttribute(polygon.uv, 2);

    this.userData.reduction = polygon.data.areaReduction;

    this.setIndex(indexBA);
    this.setAttribute("position", positionsBA);
    this.setAttribute("normal", normalBA);
    this.setAttribute("uv", uvBA);
  }
}

export class ClippedFlipbookGeometry extends BufferGeometry {
  constructor(vertices: number) {
    super();
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(vertices * 3), 3)
    );
    geometry.setAttribute(
      "normal",
      new BufferAttribute(fillBuffer(vertices * 3, [0, 0, 1]), 3)
    );

    Object.assign(this, geometry);
  }
}

export function createClippedFlipbook(
  imageOrTexture: HTMLImageElement | Texture,
  vertices: number,
  threshold: number,
  horizontalSlices: number,
  verticalSlices: number
): [
  BufferGeometry,
  DataTexture,
  Float32Array,
  { avg: number; min: number; max: number }
] {
  const total = horizontalSlices * verticalSlices;
  const positions = new Float32Array(total * vertices * 4);

  let candidateGeometry: BufferGeometry = null!;
  let totalSavings = 0;
  let minSaving = Infinity;
  let maxSaving = 0;

  /**
   * Generate the geometry for each step in the flipbook and accumulate the positions in a buffer.
   * keep one of the generated geometries as the initial one.
   * We could also have a uvs buffer but uvs are very easily calculated in the shader with some multiplications.
   */
  for (let i = 0; i < total; i++) {
    const geometry = new ClippedSpriteGeometry(
      imageOrTexture,
      vertices,
      threshold,
      horizontalSlices,
      verticalSlices,
      i % horizontalSlices,
      Math.floor(i / horizontalSlices)
    );

    const pos = geometry.attributes.position.array;
    /**
     *  Save one of the generated geometries to use it as the flipbook geometry. Any geometry with the correct number of vertices is fine.
     */
    if (pos.length === vertices * 3 && !candidateGeometry) {
      candidateGeometry = geometry;
    }

    /**
     * The data texture wants to have four elements per vertex.
     */
    const posWithFourElements = addAxis(pos as Float32Array, 3, () => 1);

    positions.set(posWithFourElements, posWithFourElements.length * i);

    minSaving = Math.min(minSaving, geometry.userData.reduction);
    maxSaving = Math.max(maxSaving, geometry.userData.reduction);
    totalSavings += geometry.userData.reduction;
  }

  /**
   * We can safely 0-initialize the all elements of the positions array since positions are going to be set in the vertex shader anyway.
   */
  (candidateGeometry.getAttribute("position").array as Float32Array).map(
    () => 0
  );

  /**
   * UVs are not necessary for the flipbook as they are calculated per-position and per-frame with simple operations.
   */
  candidateGeometry.deleteAttribute("uv");

  const texture = new DataTexture(
    positions,
    vertices,
    total,
    RGBAFormat,
    FloatType
  );
  texture.needsUpdate = true;

  return [
    candidateGeometry,
    texture,
    positions,
    { avg: totalSavings / total, min: minSaving, max: maxSaving },
  ];
}
