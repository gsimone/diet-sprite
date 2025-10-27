/**
 * Helper function to calculate color distance between two RGB colors
 * Returns a value between 0 and 1, where 0 means identical colors
 */
const getColorDistance = (
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number => {
  const dr = (r1 - r2) / 255;
  const dg = (g1 - g2) / 255;
  const db = (b1 - b2) / 255;
  return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
};

export const checkPointAlpha =
  (threshold: number, alphaColor?: [number, number, number]) =>
  (...rgba: number[]) => {
    const [r, g, b, a] = rgba;

    // If alphaColor is specified, check if the pixel matches that color
    // If it does (within threshold tolerance), treat it as transparent
    if (alphaColor) {
      const [alphaR, alphaG, alphaB] = alphaColor;
      const colorDistance = getColorDistance(r, g, b, alphaR, alphaG, alphaB);

      // If color matches alphaColor within threshold, treat as transparent (return false)
      if (colorDistance <= threshold) {
        return false;
      }
    }

    // Check alpha channel against threshold
    return a / 255 > threshold;
  };

export const checkPointLuminance =
  (threshold: number, alphaColor?: [number, number, number]) =>
  (...rgba: number[]) => {
    const [r, g, b] = rgba;

    // If alphaColor is specified, check if the pixel matches that color
    if (alphaColor) {
      const [alphaR, alphaG, alphaB] = alphaColor;
      const colorDistance = getColorDistance(r, g, b, alphaR, alphaG, alphaB);

      // If color matches alphaColor within threshold, treat as transparent
      if (colorDistance <= threshold) {
        return false;
      }
    }

    return (
      0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255) > threshold
    );
  };

export const checkPointValue =
  (threshold: number, alphaColor?: [number, number, number]) =>
  (...rgba: number[]) => {
    const [r, g, b] = rgba;

    // If alphaColor is specified, check if the pixel matches that color
    if (alphaColor) {
      const [alphaR, alphaG, alphaB] = alphaColor;
      const colorDistance = getColorDistance(r, g, b, alphaR, alphaG, alphaB);

      // If color matches alphaColor within threshold, treat as transparent
      if (colorDistance <= threshold) {
        return false;
      }
    }

    return (r + g + b) / (255 * 3) > threshold;
  };
