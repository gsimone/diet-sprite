import { BufferAttribute, BufferGeometry, Texture } from "three";
import { PolygonGenerator } from "./PolygonGenerator";
import { fillBuffer } from "./utils";

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
