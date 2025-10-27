/* ============================================================================
 * Sprite Atlas Grid Guess (Canvas2D, TypeScript) — Sync, preloaded image
 * - Input: CanvasImageSource | ImageBitmap already loaded/available
 * - Detect tileWidth/tileHeight via edge-energy projections + autocorrelation
 * - Optional gutter/margin estimation (off by default)
 * - No async, no network. Browser/OffscreenCanvas-friendly.
 * ========================================================================== */

export type AtlasGridGuess = {
  tileWidth: number | null;
  tileHeight: number | null;
  marginX: number;   // 0 if detectGutters=false
  marginY: number;   // 0 if detectGutters=false
  spacingX: number;  // 0 if detectGutters=false
  spacingY: number;  // 0 if detectGutters=false
  confidence: number; // 0..1
};

export type GuessOptions = {
  minTile?: number;          // default 8
  maxTile?: number;          // default 512
  ignoreSmallLags?: number;  // default 3
  detectGutters?: boolean;   // default false
};

/** Sync entry point (full): returns tile size + confidence, and if requested margins/gutters. */
export function guessAtlasGrid(
  source: CanvasImageSource | ImageBitmap,
  {
    minTile = 8,
    maxTile = 512,
    ignoreSmallLags = 3,
    detectGutters = false,
  }: GuessOptions = {}
): AtlasGridGuess {
  const { w, h, data } = drawToCanvas(source);

  // Edge-energy projections
  const colEnergy = verticalEdgeEnergy(data, w, h);
  const rowEnergy = horizontalEdgeEnergy(data, w, h);

  // Periods via autocorrelation
  const widthPeriod  = pickPeriod(colEnergy, w, { minTile, maxTile, ignoreSmallLags });
  const heightPeriod = pickPeriod(rowEnergy, h, { minTile, maxTile, ignoreSmallLags });

  // Fallbacks
  const tileWidth  = widthPeriod  ?? scanDivisorsForPeriod(colEnergy, w, minTile, maxTile);
  const tileHeight = heightPeriod ?? scanDivisorsForPeriod(rowEnergy, h, minTile, maxTile);

  // Confidence
  const cW = periodConfidence(colEnergy, tileWidth);
  const cH = periodConfidence(rowEnergy, tileHeight);
  const confidence = clamp01(0.5 * (cW + cH));

  // Optional margins/gutters
  let marginX = 0, marginY = 0, spacingX = 0, spacingY = 0;
  if (detectGutters) {
    if (tileWidth)  { const gx = estimateOffsetAndSpacing(colEnergy, tileWidth, data, w, h, "x"); marginX = gx.offset; spacingX = gx.spacing; }
    if (tileHeight) { const gy = estimateOffsetAndSpacing(rowEnergy, tileHeight, data, w, h, "y"); marginY = gy.offset; spacingY = gy.spacing; }
  }

  return { tileWidth, tileHeight, marginX, marginY, spacingX, spacingY, confidence };
}

/** Sync convenience: ignore gutters/margins entirely (fast path). */
export function guessTileSize(
  source: CanvasImageSource | ImageBitmap,
  { minTile = 8, maxTile = 512, ignoreSmallLags = 3 }: Omit<GuessOptions, "detectGutters"> = {}
): { tileWidth: number | null; tileHeight: number | null; confidence: number } {
  const { w, h, data } = drawToCanvas(source);

  const colEnergy = verticalEdgeEnergy(data, w, h);
  const rowEnergy = horizontalEdgeEnergy(data, w, h);

  const widthPeriod  = pickPeriod(colEnergy, w, { minTile, maxTile, ignoreSmallLags });
  const heightPeriod = pickPeriod(rowEnergy, h, { minTile, maxTile, ignoreSmallLags });

  const tileWidth  = widthPeriod  ?? scanDivisorsForPeriod(colEnergy, w, minTile, maxTile);
  const tileHeight = heightPeriod ?? scanDivisorsForPeriod(rowEnergy, h, minTile, maxTile);

  const cW = periodConfidence(colEnergy, tileWidth);
  const cH = periodConfidence(rowEnergy, tileHeight);
  const confidence = clamp01(0.5 * (cW + cH));

  return { tileWidth, tileHeight, confidence };
}

/* ============================== Helpers =================================== */

function drawToCanvas(src: CanvasImageSource | ImageBitmap): { w: number; h: number; data: Uint8ClampedArray } {
  // Resolve width/height from the various CanvasImageSource types
  const w = (src as any).naturalWidth ?? (src as any).videoWidth ?? (src as any).width;
  const h = (src as any).naturalHeight ?? (src as any).videoHeight ?? (src as any).height;

  if (typeof w !== "number" || typeof h !== "number") {
    throw new Error("Could not determine source dimensions.");
  }

  // Prefer OffscreenCanvas if available (useful for workers)
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : (() => {
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          return c;
        })();

  const ctx = (canvas as any).getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("2D context unavailable");

  // Draw the already-loaded source
  // (OffscreenCanvas + ImageBitmap works; DOM canvas works with HTMLImageElement/Canvas/etc.)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - CanvasImageSource union is accepted at runtime
  ctx.drawImage(src, 0, 0);

  const imageData =
    "getImageData" in ctx
      ? (ctx as CanvasRenderingContext2D).getImageData(0, 0, w, h)
      : (ctx as OffscreenCanvasRenderingContext2D).getImageData(0, 0, w, h);

  return { w, h, data: imageData.data };
}

/* ---- Edge-energy projections ---------------------------------------------- */

function verticalEdgeEnergy(pixels: Uint8ClampedArray, w: number, h: number): Float32Array {
  const energy = new Float32Array(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const j = i + 4;
      const dr = Math.abs(pixels[j]   - pixels[i]);
      const dg = Math.abs(pixels[j+1] - pixels[i+1]);
      const db = Math.abs(pixels[j+2] - pixels[i+2]);
      const da = Math.abs(pixels[j+3] - pixels[i+3]);
      energy[x] += (dr + dg + db + da) / 4;
    }
  }
  normalizeInPlace(energy);
  return energy;
}

function horizontalEdgeEnergy(pixels: Uint8ClampedArray, w: number, h: number): Float32Array {
  const energy = new Float32Array(h).fill(0);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const j = i + w * 4;
      const dr = Math.abs(pixels[j]   - pixels[i]);
      const dg = Math.abs(pixels[j+1] - pixels[i+1]);
      const db = Math.abs(pixels[j+2] - pixels[i+2]);
      const da = Math.abs(pixels[j+3] - pixels[i+3]);
      energy[y] += (dr + dg + db + da) / 4;
    }
  }
  normalizeInPlace(energy);
  return energy;
}

function normalizeInPlace(arr: Float32Array): void {
  let max = 0;
  for (let i = 0; i < arr.length; i++) max = Math.max(max, arr[i]);
  if (max > 0) for (let i = 0; i < arr.length; i++) arr[i] /= max;
}

/* ---- Autocorrelation + period picking ------------------------------------ */

function autocorr(signal: Float32Array, maxLag: number): Float32Array {
  const n = signal.length;
  const mean = avg(signal);
  let denom = 0;
  for (let i = 0; i < n; i++) {
    const d = signal[i] - mean;
    denom += d * d;
  }
  const corr = new Float32Array(maxLag + 1);
  corr[0] = 1;
  if (denom === 0) return corr;

  for (let lag = 1; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = 0; i < n - lag; i++) {
      num += (signal[i] - mean) * (signal[i + lag] - mean);
    }
    corr[lag] = num / denom;
  }
  return corr;
}

function pickPeriod(
  signal: Float32Array,
  dim: number,
  { minTile, maxTile, ignoreSmallLags }: { minTile: number; maxTile: number; ignoreSmallLags: number }
): number | null {
  const maxLag = Math.min(dim - 1, Math.floor(dim / 2));
  if (maxLag < 1) return null;

  const corr = autocorr(signal, maxLag);

  let bestLag: number | null = null;
  let bestScore = -Infinity;

  for (let lag = Math.max(ignoreSmallLags, minTile); lag <= maxLag && lag <= maxTile; lag++) {
    const tiles = dim / lag;
    const divPenalty = Math.min(1, Math.abs(tiles - Math.round(tiles))); // prefer divisors
    const score = corr[lag] - 0.1 * divPenalty;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }

  // Snap near a clean divisor (common in atlases)
  if (bestLag != null) {
    const q = Math.round(dim / bestLag);
    if (q >= 2) {
      const snapped = Math.round(dim / q);
      if (Math.abs(snapped - bestLag) <= 2) bestLag = snapped;
    }
  }
  return bestLag;
}

function scanDivisorsForPeriod(signal: Float32Array, dim: number, minTile: number, maxTile: number): number | null {
  const candidates: number[] = [];
  for (let s = minTile; s <= maxTile; s++) {
    const tiles = dim / s;
    if (Math.abs(tiles - Math.round(tiles)) < 1e-6 && tiles >= 2) candidates.push(s);
  }
  if (candidates.length === 0) return Math.max(minTile, Math.min(maxTile, Math.floor(dim / 4)));

  let best: number | null = null;
  let bestScore = -Infinity;
  for (const s of candidates) {
    const score = boundaryAlignmentScore(signal, s);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

function boundaryAlignmentScore(signal: Float32Array, period: number): number {
  const n = signal.length;
  let total = 0, count = 0;
  for (let k = 1; k * period < n; k++) {
    const idx = k * period;
    const win = 2;
    let localMax = 0;
    for (let d = -win; d <= win; d++) {
      const i = clamp(idx + d, 0, n - 1);
      localMax = Math.max(localMax, signal[i]);
    }
    total += localMax;
    count++;
  }
  return count ? total / count : 0;
}

/* ---- Optional margin/spacing estimator ----------------------------------- */

function estimateOffsetAndSpacing(
  signal: Float32Array,
  period: number,
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  axis: "x" | "y"
): { offset: number; spacing: number } {
  const n = signal.length;
  if (!period || period <= 0) return { offset: 0, spacing: 0 };

  // Strongest boundary in [0, period)
  let bestIdx = 0, bestVal = -Infinity;
  for (let i = 0; i < Math.min(period, n); i++) {
    const val = localPeak(signal, i, 2);
    if (val > bestVal) { bestVal = val; bestIdx = i; }
  }

  const spacing = estimateGutterWidth(bestIdx, signal, pixels, w, h, axis);
  return { offset: bestIdx, spacing };

  function localPeak(sig: Float32Array, i: number, halfWin: number): number {
    let m = -Infinity;
    for (let d = -halfWin; d <= halfWin; d++) {
      const j = clamp(i + d, 0, sig.length - 1);
      if (sig[j] > m) m = sig[j];
    }
    return m;
  }

  function estimateGutterWidth(
    idx: number,
    sig: Float32Array,
    pixels: Uint8ClampedArray,
    w: number,
    h: number,
    axis: "x" | "y"
  ): number {
    // Energy threshold band
    const thr = 0.6 * localPeak(sig, idx, 2);
    let left = idx, right = idx;
    while (left > 0 && sig[left - 1] >= thr) left--;
    while (right < sig.length - 1 && sig[right + 1] >= thr) right++;
    let width = Math.max(0, right - left + 1);

    // Alpha hint: contiguous near-zero alpha band if present
    const bandWidth = alphaBandWidth(idx, pixels, w, h, axis);
    if (bandWidth > 0 && (width === 0 || bandWidth <= width + 2)) width = bandWidth;

    return width;
  }

  function alphaBandWidth(
    idx: number,
    pixels: Uint8ClampedArray,
    w: number,
    h: number,
    axis: "x" | "y"
  ): number {
    const alphaThreshold = 10; // ~transparent
    if (axis === "x") {
      const avgAlphaCol = (x: number) => {
        let s = 0; for (let y = 0; y < h; y++) s += pixels[(y * w + x) * 4 + 3];
        return s / h;
      };
      let l = idx, r = idx;
      while (l > 0 && avgAlphaCol(l - 1) < alphaThreshold) l--;
      while (r < w - 1 && avgAlphaCol(r + 1) < alphaThreshold) r++;
      const bw = r - l + 1;
      return avgAlphaCol(idx) < alphaThreshold ? bw : 0;
    } else {
      const avgAlphaRow = (y: number) => {
        let s = 0; for (let x = 0; x < w; x++) s += pixels[(y * w + x) * 4 + 3];
        return s / w;
      };
      let t = idx, b = idx;
      while (t > 0 && avgAlphaRow(t - 1) < alphaThreshold) t--;
      while (b < h - 1 && avgAlphaRow(b + 1) < alphaThreshold) b++;
      const bw = b - t + 1;
      return avgAlphaRow(idx) < alphaThreshold ? bw : 0;
    }
  }
}

/* ---- Scoring & math ------------------------------------------------------- */

function periodConfidence(signal: Float32Array, period: number | null): number {
  if (!period || period <= 0) return 0;
  const ac = autocorr(signal, Math.min(signal.length - 1, period * 3));
  const p  = ac[period] ?? 0;
  const p2 = ac[period * 2] ?? 0;
  const p3 = ac[period * 3] ?? 0;
  return clamp01((p + 0.6 * p2 + 0.4 * p3) / 2);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function clamp01(x: number): number { return clamp(x, 0, 1); }

function avg(arr: Float32Array): number {
  let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i];
  return arr.length ? s / arr.length : 0;
}

/* ============================== Usage ======================================
const imgEl = document.querySelector('img')!; // already loaded
const { tileWidth, tileHeight, confidence } = guessTileSize(imgEl);

const full = guessAtlasGrid(imgEl, { detectGutters: true });
console.log(full);
// -> { tileWidth, tileHeight, marginX, marginY, spacingX, spacingY, confidence }
============================================================================= */
