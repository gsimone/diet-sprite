// @ts-ignore
import earcut from "earcut";
import { mapBuffer, get2DFromIndex } from "./maath-helpers";

import { convexhull, simplifyConvexHull, calcPolygonArea } from "./geometry";
import { Point } from ".";
import { addAxis, createBufferFromListOfPoints, getNeighbours } from "./utils";
import { checkPointAlpha } from "./filters";

export type Settings = {
  scale: number;
  threshold: number;
  slices: [number, number];
  indices: [number, number];
  filter: (
    threshold: number,
    alphaColor?: [number, number, number]
  ) => (...rgb: number[]) => boolean;
  accumulateSprites?: boolean;
  alphaColor?: [number, number, number];
};

const DEFAULT_SETTINGS: Settings = {
  threshold: 0.01,
  slices: [1, 1],
  indices: [0, 0],
  scale: 1,
  filter: checkPointAlpha,
  accumulateSprites: false,
};

export class PolygonGenerator {
  points: Array<Point> = [];

  data: {
    areaReduction: number;
  } = {
    areaReduction: 0,
  };

  debug = true;

  index: Uint32Array;
  positions: Float32Array;
  uv: Float32Array;

  defaultSettings = DEFAULT_SETTINGS;

  settings: Settings;

  imageData: ImageData;

  constructor(
    img: HTMLImageElement,
    settings: Partial<Settings>,
    public vertices: number
  ) {
    this.settings = { ...this.defaultSettings, ...settings };

    const { slices, indices, accumulateSprites } = this.settings;

    // Calculate slice dimensions
    const sliceWidth = img.width / slices[0];
    const sliceHeight = img.height / slices[1];

    const canvas = createCanvas("bvc-image", sliceWidth, sliceHeight);
    this.imageData = accumulateSprites
      ? getAccumulatedImageData(img, canvas, slices)
      : getImageData(img, canvas, slices, indices);

    const points = this.getPoints(this.imageData);

    let convexHull = convexhull.makeHull(points);

    let simplified: Point[];

    // Handle special case for triangle (3 vertices)
    if (vertices === 3) {
      // Find smallest enclosing circle of the convex hull and create circumscribed triangle
      const circle = this.findSmallestEnclosingCircle(convexHull);
      simplified = this.createCircumscribedTriangle(circle);
    } else {
      simplified = simplifyConvexHull(convexHull, vertices);
    }

    const normalized = simplified.map((p) => {
      let np = normalizePositions(p, [sliceWidth, sliceHeight]);

      /**
       * @todo should this be optional?
       */
      np.y = -1 * np.y;

      return np;
    });

    const { scale } = this.settings;

    this.data.areaReduction =
      1 - (calcPolygonArea(simplified) / (sliceWidth * sliceHeight)) * scale;

    // make a buffer from the simplified points since earcut requires it
    const positions = createBufferFromListOfPoints(normalized);
    /**
     * Use `earcut` to triangulate the points
     * @see https://github.com/mapbox/earcut
     **/
    const index = earcut(positions, null, 2);

    // transform the buffer to 3d with 0 z [1, 2, ...] > [1, 2, 0, ...]
    this.positions = addAxis(positions, 2, () => 0) as Float32Array;
    this.index = Uint32Array.from(index);

    /**
     * @note that this calculate can be easily done in the material.
     * Removing this step would be a non-significant speed improvement
     */
    this.uv = mapBuffer(positions.slice(0), 2, (v) => {
      let x = v[0] + 0.5;
      x =
        x / this.settings.slices[0] +
        (1 / this.settings.slices[0]) * this.settings.indices[0];

      let y = v[1] + 0.5;
      y =
        y / this.settings.slices[1] +
        1 -
        (1 / this.settings.slices[1]) * (this.settings.indices[1] + 1);

      return [x, y];
    }) as Float32Array;
  }

  /**
   * Finds the smallest circle that encloses all given points using Welzl's algorithm.
   *
   * @param points Array of points to enclose
   * @returns Circle defined by center point and radius
   */
  findSmallestEnclosingCircle(points: Point[]): {
    center: Point;
    radius: number;
  } {
    if (points.length === 0) {
      return { center: { x: 0, y: 0 }, radius: 0 };
    }

    // Shuffle points for better average-case performance
    const shuffled = [...points].sort(() => Math.random() - 0.5);

    return this.welzlHelper(shuffled, [], 0);
  }

  /**
   * Recursive helper for Welzl's algorithm to find smallest enclosing circle.
   */
  private welzlHelper(
    points: Point[],
    boundary: Point[],
    n: number
  ): { center: Point; radius: number } {
    // Base cases
    if (n === points.length || boundary.length === 3) {
      return this.makeCircleFromBoundary(boundary);
    }

    const p = points[n];
    const circle = this.welzlHelper(points, boundary, n + 1);

    // Check if point p is inside the circle
    if (this.isInsideCircle(p, circle)) {
      return circle;
    }

    // Point is outside, must be on the boundary
    return this.welzlHelper(points, [...boundary, p], n + 1);
  }

  /**
   * Creates the smallest circle from 1-3 boundary points.
   */
  private makeCircleFromBoundary(boundary: Point[]): {
    center: Point;
    radius: number;
  } {
    if (boundary.length === 0) {
      return { center: { x: 0, y: 0 }, radius: 0 };
    }

    if (boundary.length === 1) {
      return { center: boundary[0], radius: 0 };
    }

    if (boundary.length === 2) {
      // Circle from diameter
      const center = {
        x: (boundary[0].x + boundary[1].x) / 2,
        y: (boundary[0].y + boundary[1].y) / 2,
      };
      const radius = this.distance(boundary[0], boundary[1]) / 2;
      return { center, radius };
    }

    // boundary.length === 3
    // Find circumcircle of triangle
    return this.circumcircle(boundary[0], boundary[1], boundary[2]);
  }

  /**
   * Calculates the circumcircle of a triangle defined by three points.
   */
  private circumcircle(
    a: Point,
    b: Point,
    c: Point
  ): { center: Point; radius: number } {
    const ax = a.x,
      ay = a.y;
    const bx = b.x,
      by = b.y;
    const cx = c.x,
      cy = c.y;

    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

    if (Math.abs(d) < 1e-10) {
      // Points are collinear, return circle from two farthest points
      const dab = this.distance(a, b);
      const dbc = this.distance(b, c);
      const dca = this.distance(c, a);

      if (dab >= dbc && dab >= dca) {
        return this.makeCircleFromBoundary([a, b]);
      } else if (dbc >= dca) {
        return this.makeCircleFromBoundary([b, c]);
      } else {
        return this.makeCircleFromBoundary([c, a]);
      }
    }

    const ux =
      ((ax * ax + ay * ay) * (by - cy) +
        (bx * bx + by * by) * (cy - ay) +
        (cx * cx + cy * cy) * (ay - by)) /
      d;
    const uy =
      ((ax * ax + ay * ay) * (cx - bx) +
        (bx * bx + by * by) * (ax - cx) +
        (cx * cx + cy * cy) * (bx - ax)) /
      d;

    const center = { x: ux, y: uy };
    const radius = this.distance(center, a);

    return { center, radius };
  }

  /**
   * Checks if a point is inside or on the boundary of a circle.
   */
  private isInsideCircle(
    p: Point,
    circle: { center: Point; radius: number }
  ): boolean {
    const dist = this.distance(p, circle.center);
    return dist <= circle.radius + 1e-10; // Small epsilon for floating point comparison
  }

  /**
   * Calculates Euclidean distance between two points.
   */
  private distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Creates an equilateral triangle that circumscribes the given circle.
   * The triangle's incircle will be the given circle.
   *
   * @param circle The circle to circumscribe
   * @returns Array of 3 points forming the triangle vertices
   */
  createCircumscribedTriangle(circle: {
    center: Point;
    radius: number;
  }): Point[] {
    const { center, radius } = circle;

    // For an equilateral triangle with incircle radius r,
    // the circumradius R = 2r (distance from center to vertex)
    const R = 2 * radius;

    // Create three vertices of an equilateral triangle
    // oriented with one vertex pointing up
    const vertices: Point[] = [];

    for (let i = 0; i < 3; i++) {
      // Angle for each vertex (120 degrees apart, starting at -90 degrees for top vertex)
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3;

      vertices.push({
        x: center.x + R * Math.cos(angle),
        y: center.y + R * Math.sin(angle),
      });
    }

    return vertices;
  }

  /**
   * Iterates over the image and returns an array of points that are over the alpha threshold.
   * It reduces the number of returned points by excluding points that are surrounded by solid pixels.
   *
   * @param imageData ImageData object containing the pixel data to process
   * @returns
   */
  getPoints(imageData: ImageData): Point[] {
    const data = imageData.data;

    const points = [];

    const filterFn = this.settings.filter(
      this.settings.threshold,
      this.settings.alphaColor
    );

    const checkNeighbours = (index: number | null) =>
      index !== null &&
      filterFn(
        data[index * 4],
        data[index * 4 + 1],
        data[index * 4 + 2],
        data[index * 4 + 3]
      );

    for (let i = 0; i < data.length; i += 4) {
      const isValidPoint = filterFn(
        data[i + 0],
        data[i + 1],
        data[i + 2],
        data[i + 3]
      );

      if (isValidPoint) {
        /**
         * This drastically reduces the total amount of points that will be included in the hull calculation
         * at the cost of checking each neighbour (4) for each valid sample.
         **/
        const neighbours = getNeighbours(i, imageData.width, imageData.height);

        // if neighbour are all valid, never add point
        if (neighbours.every(checkNeighbours)) {
          continue;
        }

        const [x, y] = get2DFromIndex(i / 4, imageData.width);

        points.push({ x, y });
      }
    }

    return points;
  }
}

/**
 * Extracts ImageData from an image element based on slice configuration.
 *
 * @param img The image element to extract data from
 * @param canvas The canvas element to use for drawing (sized for a single slice)
 * @param slices The number of horizontal and vertical slices [horizontal, vertical]
 * @param indices The indices of the slice to extract [horizontal, vertical]
 * @returns ImageData for the specified slice
 */
const getImageData = (
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  slices: [number, number],
  indices: [number, number]
): ImageData => {
  const ctx = canvas.getContext("2d")!;

  /**
   * Indices
   */
  const [hi, vi] = indices;

  /**
   * Number of slices
   */
  const [hs, vs] = slices;

  /**
   * Size of a single slice in the source image
   */
  const sliceWidth = img.width / hs;
  const sliceHeight = img.height / vs;

  // Draw only the specific slice to the canvas
  ctx.drawImage(
    img,
    sliceWidth * hi,
    sliceHeight * vi,
    sliceWidth,
    sliceHeight, // source rect
    0,
    0,
    canvas.width,
    canvas.height // destination rect (full canvas)
  );

  // Get image data for the entire canvas (which contains only one slice)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return imageData;
};

/**
 * Extracts ImageData by drawing all sprite slices on the canvas at once.
 * This creates an accumulated view of all sprites in the sprite sheet.
 * The canvas is sized for a single slice, and all slices are drawn on top of each other.
 *
 * @param img The image element to extract data from
 * @param canvas The canvas element to use for drawing (sized for a single slice)
 * @param slices The number of horizontal and vertical slices [horizontal, vertical]
 * @returns ImageData containing all sprites drawn together
 */
const getAccumulatedImageData = (
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  slices: [number, number]
): ImageData => {
  const ctx = canvas.getContext("2d")!;

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  /**
   * Number of slices
   */
  const [hs, vs] = slices;

  /**
   * Size of a single slice in the source image
   */
  const sliceWidth = img.width / hs;
  const sliceHeight = img.height / vs;

  // Draw all sprites on top of each other at canvas size (which is one slice size)
  for (let vi = 0; vi < vs; vi++) {
    for (let hi = 0; hi < hs; hi++) {
      // Source coordinates (from the original image)
      const sx = hi * sliceWidth;
      const sy = vi * sliceHeight;

      // Destination: all sprites drawn at (0,0) at canvas size (one slice)
      ctx.drawImage(
        img,
        sx,
        sy,
        sliceWidth,
        sliceHeight, // source rect
        0,
        0,
        canvas.width,
        canvas.height // destination rect (full canvas = one slice)
      );
    }
  }

  // Get the full canvas imageData (which is one slice with all sprites accumulated)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return imageData;
};

/**
 * Copies ImageData to a canvas element, adjusting canvas size if needed.
 *
 * @param imageData The ImageData to copy to the canvas
 * @param canvas The target canvas element
 */
const _copyImageDataToCanvas = (
  imageData: ImageData,
  canvas: HTMLCanvasElement
): void => {
  // Resize canvas to match imageData dimensions
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);
};

/**
 * Creates and returns an html canvas element.
 * Doesn't attach it to the body.
 */
const createCanvas = (id = "debug-canvas", width: number, height: number) => {
  const canvas =
    (document.querySelector(`#${id}`) as HTMLCanvasElement) ||
    document.createElement("canvas");

  canvas.id = id;

  canvas.width = width;
  canvas.height = height;

  canvas.id = id;

  return canvas;
};

const normalizePositions = (p: Point, sliceSize: number[]) => {
  return {
    x: (p.x - sliceSize[0] / 2) / sliceSize[0],
    y: (p.y - sliceSize[1] / 2) / sliceSize[1],
  };
};
