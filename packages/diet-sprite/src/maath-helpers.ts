/**
 * Custom implementations of maath utilities to avoid external dependency
 */

/**
 * Map function for typed arrays, treating them as arrays of vectors
 * @param buffer - The source buffer
 * @param size - The size of each vector (2 for 2D, 3 for 3D, etc.)
 * @param fn - Mapping function that receives a vector and returns a new vector
 * @returns A new Float32Array with the mapped values
 */
export function mapBuffer<T extends number[]>(
  buffer: Float32Array,
  size: number,
  fn: (vector: number[]) => T
): Float32Array {
  const vectorCount = buffer.length / size;
  const vector: number[] = new Array(size);

  // Determine output size from first iteration
  let outputSize = size;
  const results: number[][] = [];

  for (let i = 0; i < vectorCount; i++) {
    // Extract vector
    for (let j = 0; j < size; j++) {
      vector[j] = buffer[i * size + j];
    }

    // Apply function
    const result = fn(vector);
    results.push(result);

    if (i === 0) {
      outputSize = result.length;
    }
  }

  // Create output buffer
  const output = new Float32Array(vectorCount * outputSize);

  // Fill output buffer
  for (let i = 0; i < vectorCount; i++) {
    const result = results[i];
    for (let j = 0; j < outputSize; j++) {
      output[i * outputSize + j] = result[j];
    }
  }

  return output;
}

/**
 * Convert a 1D index to 2D coordinates
 * @param index - The 1D index
 * @param width - The width of the 2D space
 * @returns [x, y] coordinates
 */
export function get2DFromIndex(index: number, width: number): [number, number] {
  const x = index % width;
  const y = Math.floor(index / width);
  return [x, y];
}
