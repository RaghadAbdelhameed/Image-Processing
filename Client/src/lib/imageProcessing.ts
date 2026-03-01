// ---- Helpers ----
export function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d")!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function putImageData(canvas: HTMLCanvasElement, data: ImageData) {
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d")!.putImageData(data, 0, 0);
}

export function cloneImageData(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

export function toGrayscale(src: ImageData): ImageData {
  const out = cloneImageData(src);
  for (let i = 0; i < out.data.length; i += 4) {
    const g = 0.299 * out.data[i] + 0.587 * out.data[i + 1] + 0.114 * out.data[i + 2];
    out.data[i] = out.data[i + 1] = out.data[i + 2] = g;
  }
  return out;
}

export function loadImageToCanvas(file: File | string): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      resolve(c);
    };
    if (typeof file === "string") {
      img.src = file;
    } else {
      img.src = URL.createObjectURL(file);
    }
  });
}

export function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL();
}

function getPixelGray(data: ImageData, x: number, y: number): number {
  if (x < 0 || x >= data.width || y < 0 || y >= data.height) return 0;
  const i = (y * data.width + x) * 4;
  return 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
}

// ---- Noise ----
export function addNoise(src: ImageData, type: string, ratio: number): ImageData {
  const out = cloneImageData(src);
  const d = out.data;
  if (type === "uniform") {
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 2 * ratio * 255;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
    }
  } else if (type === "gaussian") {
    for (let i = 0; i < d.length; i += 4) {
      const u1 = Math.random(), u2 = Math.random();
      const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * ratio * 80;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
    }
  } else if (type === "salt&pepper") {
    for (let i = 0; i < d.length; i += 4) {
      const r = Math.random();
      if (r < ratio / 2) {
        d[i] = d[i + 1] = d[i + 2] = 0;
      } else if (r < ratio) {
        d[i] = d[i + 1] = d[i + 2] = 255;
      }
    }
  }
  return out;
}

// ---- Spatial Filters ----
function convolve(src: ImageData, kernel: number[][], kSize: number): ImageData {
  const out = cloneImageData(src);
  const half = Math.floor(kSize / 2);
  const w = src.width, h = src.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const idx = (py * w + px) * 4;
          const kv = kernel[ky + half][kx + half];
          r += src.data[idx] * kv;
          g += src.data[idx + 1] * kv;
          b += src.data[idx + 2] * kv;
        }
      }
      const idx = (y * w + x) * 4;
      out.data[idx] = Math.min(255, Math.max(0, r));
      out.data[idx + 1] = Math.min(255, Math.max(0, g));
      out.data[idx + 2] = Math.min(255, Math.max(0, b));
    }
  }
  return out;
}

function makeGaussianKernel(size: number): number[][] {
  const sigma = size / 3;
  const half = Math.floor(size / 2);
  const kernel: number[][] = [];
  let sum = 0;
  for (let y = -half; y <= half; y++) {
    const row: number[] = [];
    for (let x = -half; x <= half; x++) {
      const v = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      row.push(v);
      sum += v;
    }
    kernel.push(row);
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) kernel[y][x] /= sum;
  return kernel;
}

function medianFilter(src: ImageData, size: number): ImageData {
  const out = cloneImageData(src);
  const half = Math.floor(size / 2);
  const w = src.width, h = src.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rs: number[] = [], gs: number[] = [], bs: number[] = [];
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const idx = (py * w + px) * 4;
          rs.push(src.data[idx]);
          gs.push(src.data[idx + 1]);
          bs.push(src.data[idx + 2]);
        }
      }
      rs.sort((a, b) => a - b);
      gs.sort((a, b) => a - b);
      bs.sort((a, b) => a - b);
      const mid = Math.floor(rs.length / 2);
      const idx = (y * w + x) * 4;
      out.data[idx] = rs[mid];
      out.data[idx + 1] = gs[mid];
      out.data[idx + 2] = bs[mid];
    }
  }
  return out;
}

export function applyFilter(src: ImageData, filterType: string, kernelSize: number): ImageData {
  if (filterType === "average") {
    const v = 1 / (kernelSize * kernelSize);
    const kernel = Array.from({ length: kernelSize }, () => Array(kernelSize).fill(v));
    return convolve(src, kernel, kernelSize);
  } else if (filterType === "gaussian") {
    return convolve(src, makeGaussianKernel(kernelSize), kernelSize);
  } else if (filterType === "median") {
    return medianFilter(src, kernelSize);
  }
  return src;
}

// ---- Edge Detection ----
function applyEdgeKernels(src: ImageData, kx: number[][], ky: number[][]): { gx: ImageData; gy: ImageData; mag: ImageData } {
  const gray = toGrayscale(src);
  const w = src.width, h = src.height;
  const gxData = cloneImageData(gray);
  const gyData = cloneImageData(gray);
  const magData = cloneImageData(gray);
  const size = kx.length;
  const half = Math.floor(size / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sumX = 0, sumY = 0;
      for (let j = -half; j <= half; j++) {
        for (let i = -half; i <= half; i++) {
          const g = getPixelGray(gray, x + i, y + j);
          sumX += g * kx[j + half][i + half];
          sumY += g * ky[j + half][i + half];
        }
      }
      const idx = (y * w + x) * 4;
      const ax = Math.min(255, Math.abs(sumX));
      const ay = Math.min(255, Math.abs(sumY));
      const m = Math.min(255, Math.sqrt(sumX * sumX + sumY * sumY));
      gxData.data[idx] = gxData.data[idx + 1] = gxData.data[idx + 2] = ax;
      gyData.data[idx] = gyData.data[idx + 1] = gyData.data[idx + 2] = ay;
      magData.data[idx] = magData.data[idx + 1] = magData.data[idx + 2] = m;
    }
  }
  return { gx: gxData, gy: gyData, mag: magData };
}

export function edgeDetect(src: ImageData, method: string): { images: ImageData[]; labels: string[] } {
  if (method === "sobel") {
    const kx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const ky = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    const r = applyEdgeKernels(src, kx, ky);
    return { images: [r.gx, r.gy, r.mag], labels: ["X-Gradient", "Y-Gradient", "Magnitude"] };
  } else if (method === "prewitt") {
    const kx = [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]];
    const ky = [[-1, -1, -1], [0, 0, 0], [1, 1, 1]];
    const r = applyEdgeKernels(src, kx, ky);
    return { images: [r.gx, r.gy, r.mag], labels: ["X-Gradient", "Y-Gradient", "Magnitude"] };
  } else if (method === "roberts") {
    const kx = [[1, 0], [0, -1]];
    const ky = [[0, 1], [-1, 0]];
    // Pad to 3x3 for our kernel system
    const kx3 = [[0, 0, 0], [0, 1, 0], [0, 0, -1]];
    const ky3 = [[0, 0, 0], [0, 0, 1], [0, -1, 0]];
    const r = applyEdgeKernels(src, kx3, ky3);
    return { images: [r.gx, r.gy, r.mag], labels: ["X-Gradient", "Y-Gradient", "Magnitude"] };
  } else {
    // Canny - simplified: gaussian blur -> sobel -> threshold
    const blurred = applyFilter(src, "gaussian", 5);
    const kx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const ky = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    const r = applyEdgeKernels(blurred, kx, ky);
    // Apply double threshold
    const out = cloneImageData(r.mag);
    const high = 100, low = 50;
    for (let i = 0; i < out.data.length; i += 4) {
      const v = out.data[i];
      out.data[i] = out.data[i + 1] = out.data[i + 2] = v > high ? 255 : v > low ? 128 : 0;
    }
    return { images: [out], labels: ["Canny Edge"] };
  }
}

// ---- Histogram ----
export function computeHistogram(src: ImageData, mode: "gray" | "rgb"): { hist: number[][]; cdf: number[][] } {
  const w = src.width, h = src.height;
  const total = w * h;
  if (mode === "gray") {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < src.data.length; i += 4) {
      const g = Math.round(0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2]);
      hist[g]++;
    }
    const cdf = new Array(256).fill(0);
    cdf[0] = hist[0] / total;
    for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i] / total;
    return { hist: [hist], cdf: [cdf] };
  } else {
    const rh = new Array(256).fill(0), gh = new Array(256).fill(0), bh = new Array(256).fill(0);
    for (let i = 0; i < src.data.length; i += 4) {
      rh[src.data[i]]++;
      gh[src.data[i + 1]]++;
      bh[src.data[i + 2]]++;
    }
    const rc = new Array(256).fill(0), gc = new Array(256).fill(0), bc = new Array(256).fill(0);
    rc[0] = rh[0] / total; gc[0] = gh[0] / total; bc[0] = bh[0] / total;
    for (let i = 1; i < 256; i++) {
      rc[i] = rc[i - 1] + rh[i] / total;
      gc[i] = gc[i - 1] + gh[i] / total;
      bc[i] = bc[i - 1] + bh[i] / total;
    }
    return { hist: [rh, gh, bh], cdf: [rc, gc, bc] };
  }
}

export function equalizeHistogram(src: ImageData, mode: "gray" | "rgb"): ImageData {
  const out = cloneImageData(src);
  const total = src.width * src.height;
  if (mode === "gray") {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < src.data.length; i += 4) {
      const g = Math.round(0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2]);
      hist[g]++;
    }
    const cdf = new Array(256).fill(0);
    cdf[0] = hist[0];
    for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
    const cdfMin = cdf.find(v => v > 0) || 0;
    const lut = cdf.map(v => Math.round(((v - cdfMin) / (total - cdfMin)) * 255));
    for (let i = 0; i < out.data.length; i += 4) {
      const g = Math.round(0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2]);
      out.data[i] = out.data[i + 1] = out.data[i + 2] = lut[g];
    }
  } else {
    for (let ch = 0; ch < 3; ch++) {
      const hist = new Array(256).fill(0);
      for (let i = 0; i < src.data.length; i += 4) hist[src.data[i + ch]]++;
      const cdf = new Array(256).fill(0);
      cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
      const cdfMin = cdf.find(v => v > 0) || 0;
      const lut = cdf.map(v => Math.round(((v - cdfMin) / (total - cdfMin)) * 255));
      for (let i = 0; i < out.data.length; i += 4) out.data[i + ch] = lut[src.data[i + ch]];
    }
  }
  return out;
}

export function normalizeImage(src: ImageData, mode: "gray" | "rgb"): ImageData {
  const out = cloneImageData(src);
  if (mode === "gray") {
    let min = 255, max = 0;
    for (let i = 0; i < src.data.length; i += 4) {
      const g = Math.round(0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2]);
      min = Math.min(min, g);
      max = Math.max(max, g);
    }
    const range = max - min || 1;
    for (let i = 0; i < out.data.length; i += 4) {
      const g = Math.round(0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2]);
      const v = Math.round(((g - min) / range) * 255);
      out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
    }
  } else {
    for (let ch = 0; ch < 3; ch++) {
      let min = 255, max = 0;
      for (let i = 0; i < src.data.length; i += 4) {
        min = Math.min(min, src.data[i + ch]);
        max = Math.max(max, src.data[i + ch]);
      }
      const range = max - min || 1;
      for (let i = 0; i < out.data.length; i += 4) {
        out.data[i + ch] = Math.round(((src.data[i + ch] - min) / range) * 255);
      }
    }
  }
  return out;
}

// ---- Frequency Domain (simplified) ----
export function lowPassFilter(src: ImageData, cutoff: number): ImageData {
  // Approximate with gaussian blur, cutoff maps to kernel size
  const kSize = Math.max(3, Math.min(31, Math.round(cutoff / 5) * 2 + 1));
  return convolve(src, makeGaussianKernel(kSize), kSize);
}

export function highPassFilter(src: ImageData, cutoff: number): ImageData {
  const low = lowPassFilter(src, cutoff);
  const out = cloneImageData(src);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = Math.min(255, Math.max(0, 128 + src.data[i] - low.data[i]));
    out.data[i + 1] = Math.min(255, Math.max(0, 128 + src.data[i + 1] - low.data[i + 1]));
    out.data[i + 2] = Math.min(255, Math.max(0, 128 + src.data[i + 2] - low.data[i + 2]));
  }
  return out;
}

export function hybridImage(srcA: ImageData, srcB: ImageData, lowCutoff: number, highCutoff: number): { lowPass: ImageData; highPass: ImageData; hybrid: ImageData } {
  // Resize B to match A
  const canvasB = document.createElement("canvas");
  canvasB.width = srcA.width;
  canvasB.height = srcA.height;
  const ctxB = canvasB.getContext("2d")!;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = srcB.width;
  tempCanvas.height = srcB.height;
  putImageData(tempCanvas, srcB);
  ctxB.drawImage(tempCanvas, 0, 0, srcA.width, srcA.height);
  const resizedB = ctxB.getImageData(0, 0, srcA.width, srcA.height);

  const lp = lowPassFilter(srcA, lowCutoff);
  const hp = highPassFilter(resizedB, highCutoff);
  const hybrid = cloneImageData(lp);
  for (let i = 0; i < hybrid.data.length; i += 4) {
    hybrid.data[i] = Math.min(255, Math.max(0, (lp.data[i] + hp.data[i] - 128)));
    hybrid.data[i + 1] = Math.min(255, Math.max(0, (lp.data[i + 1] + hp.data[i + 1] - 128)));
    hybrid.data[i + 2] = Math.min(255, Math.max(0, (lp.data[i + 2] + hp.data[i + 2] - 128)));
  }
  return { lowPass: lp, highPass: hp, hybrid };
}

// ---- Canvas rendering helper ----
export function imageDataToDataURL(data: ImageData): string {
  const c = document.createElement("canvas");
  putImageData(c, data);
  return c.toDataURL();
}
