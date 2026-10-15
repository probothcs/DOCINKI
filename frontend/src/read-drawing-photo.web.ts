import { createWorker, type Worker } from "tesseract.js";

import { readDrawingTokens, type DrawingDims, type OcrToken } from "./read-drawing";

let workerPromise: Promise<Worker> | null = null;

export async function readDrawingPhoto(uri: string, _width: number, _height: number): Promise<DrawingDims | null> {
  const image = await loadImage(uri);
  const reader = await ocrWorker();
  let best: DrawingDims | null = null;
  let bestScore = -1;
  for (const quarter of [0, 1, 2, 3]) {
    const shot = await rotatedJpeg(image, quarter);
    try {
      const result = await reader.recognize(shot.url);
      const tokens: OcrToken[] = (result.data.words ?? [])
        .filter((word) => word.text.trim())
        .map((word) => ({
          text: word.text,
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: Math.max(1, word.bbox.x1 - word.bbox.x0),
          height: Math.max(1, word.bbox.y1 - word.bbox.y0),
        }));
      const dims = readDrawingTokens(tokens, shot.width, shot.height);
      const score = rank(dims);
      if (score > bestScore) {
        best = dims;
        bestScore = score;
      }
      if (dims.name && dims.length && dims.height && dims.length !== dims.height) break;
    } finally {
      URL.revokeObjectURL(shot.url);
    }
  }
  return best;
}

function rank(dims: DrawingDims): number {
  const score = (dims.length ? 2 : 0) + (dims.height ? 2 : 0) + (dims.name ? 2 : 0) + (dims.thickness != null ? 1 : 0);
  if (dims.length && dims.height && dims.length === dims.height) return score - 3;
  return score;
}

async function ocrWorker(): Promise<Worker> {
  if (!workerPromise) {
    const root = tesseractRoot();
    workerPromise = createWorker("eng", 1, {
      workerPath: `${root}/worker.min.js`,
      corePath: `${root}/tesseract-core-simd-lstm.wasm.js`,
      langPath: root,
      gzip: true,
    }).then(async (worker) => {
      await worker.setParameters({ tessedit_pageseg_mode: "11" });
      return worker;
    });
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

function tesseractRoot(): string {
  const prefix = window.location.pathname.startsWith("/DOCINKI") ? "/DOCINKI" : "";
  return `${prefix}/tesseract`;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("no image"));
    image.src = uri;
  });
}

function rotatedJpeg(image: HTMLImageElement, quarter: number): Promise<{ url: string; width: number; height: number }> {
  const swap = quarter % 2 === 1;
  const sourceWidth = swap ? image.naturalHeight : image.naturalWidth;
  const sourceHeight = swap ? image.naturalWidth : image.naturalHeight;
  const scale = Math.min(1, 1800 / Math.max(sourceWidth, sourceHeight, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("no image"));
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((quarter * Math.PI) / 2);
  const drawWidth = swap ? canvas.height : canvas.width;
  const drawHeight = swap ? canvas.width : canvas.height;
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("no image"));
          return;
        }
        resolve({ url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height });
      },
      "image/jpeg",
      0.85,
    );
  });
}
