import { PolygonGenerator } from "diet-sprite";

/**
 * Generates a GLTF 2.0 JSON structure from PolygonGenerator data
 * 
 * @param polygon The PolygonGenerator instance containing the geometry data
 * @returns A GLTF 2.0 compliant object
 */
export function generateGLTF(polygon: PolygonGenerator) {
  // Convert typed arrays to regular arrays for JSON serialization
  const positions = Array.from(polygon.positions);
  const indices = Array.from(polygon.index);
  const uvs = Array.from(polygon.uv);

  // Calculate bounds for the mesh
  const posX = positions.filter((_, i) => i % 3 === 0);
  const posY = positions.filter((_, i) => i % 3 === 1);
  const posZ = positions.filter((_, i) => i % 3 === 2);
  const posMin = [
    Math.min(...posX),
    Math.min(...posY),
    Math.min(...posZ),
  ];
  const posMax = [
    Math.max(...posX),
    Math.max(...posY),
    Math.max(...posZ),
  ];
  const uvU = uvs.filter((_, i) => i % 2 === 0);
  const uvV = uvs.filter((_, i) => i % 2 === 1);
  const uvMin = [
    Math.min(...uvU),
    Math.min(...uvV),
  ];
  const uvMax = [
    Math.max(...uvU),
    Math.max(...uvV),
  ];

  // Create binary buffer with all geometry data
  const positionsBuffer = new Float32Array(positions);
  const uvsBuffer = new Float32Array(uvs);
  const indicesBuffer = new Uint16Array(indices);

  // Calculate buffer sizes
  const positionsBytes = positionsBuffer.byteLength;
  const uvsBytes = uvsBuffer.byteLength;
  const indicesBytes = indicesBuffer.byteLength;

  // Align buffer sizes to 4-byte boundaries (GLTF requirement)
  const alignedPositionsBytes = Math.ceil(positionsBytes / 4) * 4;
  const alignedUvsBytes = Math.ceil(uvsBytes / 4) * 4;
  const alignedIndicesBytes = Math.ceil(indicesBytes / 4) * 4;

  // Create combined buffer
  const totalBytes = alignedPositionsBytes + alignedUvsBytes + alignedIndicesBytes;
  const buffer = new ArrayBuffer(totalBytes);

  // Copy data to buffer
  let offset = 0;
  new Float32Array(buffer, offset, positions.length).set(positionsBuffer);
  offset += alignedPositionsBytes;
  new Float32Array(buffer, offset, uvs.length).set(uvsBuffer);
  offset += alignedUvsBytes;
  new Uint16Array(buffer, offset, indices.length).set(indicesBuffer);

  // Create GLTF JSON structure
  const gltf = {
    asset: {
      version: "2.0",
      generator: "diet-sprite",
    },
    scene: 0,
    scenes: [
      {
        nodes: [0],
      },
    ],
    nodes: [
      {
        mesh: 0,
      },
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: {
              POSITION: 0,
              TEXCOORD_0: 1,
            },
            indices: 2,
          },
        ],
      },
    ],
    accessors: [
      {
        // POSITION accessor
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: positions.length / 3,
        type: "VEC3",
        min: posMin,
        max: posMax,
      },
      {
        // TEXCOORD_0 accessor
        bufferView: 1,
        componentType: 5126, // FLOAT
        count: uvs.length / 2,
        type: "VEC2",
        min: uvMin,
        max: uvMax,
      },
      {
        // INDICES accessor
        bufferView: 2,
        componentType: 5123, // UNSIGNED_SHORT
        count: indices.length,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: positionsBytes,
        target: 34962, // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteOffset: alignedPositionsBytes,
        byteLength: uvsBytes,
        target: 34962, // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteOffset: alignedPositionsBytes + alignedUvsBytes,
        byteLength: indicesBytes,
        target: 34963, // ELEMENT_ARRAY_BUFFER
      },
    ],
    buffers: [
      {
        byteLength: totalBytes,
        uri: "data:application/octet-stream;base64," + btoa(
          String.fromCharCode(...new Uint8Array(buffer))
        ),
      },
    ],
  };

  return gltf;
}

