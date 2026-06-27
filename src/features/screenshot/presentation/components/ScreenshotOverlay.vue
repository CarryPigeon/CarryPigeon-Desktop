<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { safeListen } from "@/shared/tauri/events";
import { getScreenshotData, finishScreenshot, cancelScreenshot } from "../../data/screenshotCommands";
import AnnotationToolbar from "./tools/AnnotationToolbar.vue";
import type { ScreenCapture } from "../../api-types";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("screenshot");

const canvasRef = ref<HTMLCanvasElement | null>(null);

const captures = ref<ScreenCapture[]>([]);
const loading = ref(true);
const error = ref("");

type Tool = "select" | "pen" | "arrow" | "rect" | "text" | "mosaic";
const activeTool = ref<Tool>("select");
const strokeColor = ref("#ff4444");
const strokeWidth = ref(3);
const fontSize = ref(20);

let virtualX = 0;
let virtualY = 0;
let virtualW = 0;
let virtualH = 0;
let scale = 1;
let offsetX = 0;
let offsetY = 0;

let isDrawing = false;
let startX = 0;
let startY = 0;

let baseImageData: ImageData | null = null;

let bgCanvas: HTMLCanvasElement | null = null;

let resizeObserver: ResizeObserver | null = null;

type Annotation = {
  type: "pen" | "arrow" | "rect" | "text" | "mosaic";
  x1: number; y1: number; x2: number; y2: number;
  color: string; width: number; text?: string; fontSize?: number;
  points?: { x: number; y: number }[];
};
const annotations = ref<Annotation[]>([]);

let textInput: HTMLTextAreaElement | null = null;
let textInputCleanup: (() => void) | null = null;
let isTextPlacing = false;
let isComposing = false;
let penPoints: { x: number; y: number }[] = [];
let dataReadyUnlisten: (() => void) | null = null;
let dataReadyTimeout: ReturnType<typeof setTimeout> | null = null;
let escKeyHandler: ((e: KeyboardEvent) => void) | null = null;

async function initOverlay(data: ScreenCapture[]) {
  captures.value = data;

  if (data.length === 0) {
    error.value = "No screen captures available";
    loading.value = false;
    return;
  }

  const minX = Math.min(...data.map((s) => s.x));
  const minY = Math.min(...data.map((s) => s.y));
  const maxX = Math.max(...data.map((s) => s.x + s.width));
  const maxY = Math.max(...data.map((s) => s.y + s.height));
  virtualX = minX;
  virtualY = minY;
  virtualW = maxX - minX;
  virtualH = maxY - minY;

  bgCanvas = document.createElement("canvas");
  bgCanvas.width = virtualW;
  bgCanvas.height = virtualH;
  const bgCtx = bgCanvas.getContext("2d");
  if (!bgCtx) {
    error.value = "Canvas context not available";
    loading.value = false;
    return;
  }

  loading.value = false;
  await nextTick();

  const ctx = canvasRef.value?.getContext("2d");
  if (!ctx) {
    error.value = "Canvas not available";
    return;
  }

  fitCanvas(ctx);
  renderBackground(ctx);
  ctx.drawImage(bgCanvas!, offsetX, offsetY, virtualW * scale, virtualH * scale);
  drawCaptureBorder(ctx);
  baseImageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);

  const loadAndRedraw = () => {
    const c = canvasRef.value?.getContext("2d");
    if (!c) return;
    renderBackground(c);
    c.drawImage(bgCanvas!, offsetX, offsetY, virtualW * scale, virtualH * scale);
    drawCaptureBorder(c);
  };

  escKeyHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !isTextPlacing) {
      e.preventDefault();
      handleCancel();
    }
  };
  document.addEventListener("keydown", escKeyHandler);

  const bodyEl = canvasRef.value?.parentElement;
  if (bodyEl) {
    resizeObserver = new ResizeObserver(() => {
      const ctx2 = canvasRef.value?.getContext("2d");
      if (!ctx2) return;
      fitCanvas(ctx2);
      loadAndRedraw();
      if (baseImageData) {
        baseImageData = ctx2.getImageData(0, 0, ctx2.canvas.width, ctx2.canvas.height);
        redrawAnnotations();
      }
    });
    resizeObserver.observe(bodyEl);
  }

  let loadedCount = 0;
  let failedCount = 0;

  const imagePromises = data.map((s, idx) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        bgCtx.drawImage(img, s.x - minX, s.y - minY, s.width, s.height);
        loadedCount++;
        loadAndRedraw();
        resolve();
      };
      img.onerror = () => {
        logger.error("Action: screenshot_image_load_failed", { index: idx });
        failedCount++;
        resolve();
      };
      img.src = `data:image/png;base64,${s.data_base64}`;
    });
  });

  Promise.all(imagePromises).then(() => {
    if (loadedCount === 0) {
      error.value = `Failed to load all ${failedCount} screenshot image(s)`;
    }
    const c = canvasRef.value?.getContext("2d");
    if (c) {
      loadAndRedraw();
      baseImageData = c.getImageData(0, 0, c.canvas.width, c.canvas.height);
    }
  });
}

onMounted(async () => {
  try {
    const data = await Promise.race([
      getScreenshotData(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("getScreenshotData timed out after 15s")), 15000),
      ),
    ]);
    await initOverlay(data);
  } catch (_e) {
    // 数据尚未就绪（遮罩窗口先于截图打开），监听事件等待
    let timedOut = false;
    dataReadyTimeout = setTimeout(() => {
      timedOut = true;
      dataReadyUnlisten?.();
      dataReadyUnlisten = null;
      error.value = "Screenshot data not ready";
      loading.value = false;
    }, 15000);

    dataReadyUnlisten = await safeListen("screenshot-data-ready", async () => {
      clearTimeout(dataReadyTimeout!);
      if (timedOut) return;
      dataReadyUnlisten?.();
      dataReadyUnlisten = null;
      try {
        const data = await getScreenshotData();
        await initOverlay(data);
      } catch (e) {
        error.value = String(e);
        loading.value = false;
      }
    });
  }
});

function fitCanvas(ctx: CanvasRenderingContext2D) {
  const cvs = ctx.canvas;
  const parent = cvs.parentElement!;
  cvs.width = parent.clientWidth;
  cvs.height = parent.clientHeight;

  const sx = (parent.clientWidth - 40) / virtualW;
  const sy = (parent.clientHeight - 80) / virtualH;
  scale = Math.min(sx, sy, 1);
  offsetX = (parent.clientWidth - virtualW * scale) / 2;
  offsetY = (parent.clientHeight - virtualH * scale) / 2;
}

function renderBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawCaptureBorder(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, offsetY, virtualW * scale, virtualH * scale);
  ctx.restore();
}

function getVirtualCoords(e: MouseEvent): { vx: number; vy: number } | null {
  const rect = canvasRef.value!.getBoundingClientRect();
  const mx = (e.clientX - rect.left - offsetX) / scale;
  const my = (e.clientY - rect.top - offsetY) / scale;
  if (mx < 0 || my < 0 || mx > virtualW || my > virtualH) return null;
  return { vx: mx + virtualX, vy: my + virtualY };
}

function handlePointerDown(e: MouseEvent) {
  if (activeTool.value === "select") {
    const pos = getVirtualCoords(e);
    if (!pos) return;
    isDrawing = true;
    startX = pos.vx;
    startY = pos.vy;
    redraw();
  } else if (activeTool.value === "text") {
    const pos = getVirtualCoords(e);
    if (!pos) return;
    if (isTextPlacing) return;
    isTextPlacing = true;
    showTextInput(e.clientX, e.clientY, pos.vx, pos.vy);
  } else if (activeTool.value === "pen") {
    const pos = getVirtualCoords(e);
    if (!pos) return;
    isDrawing = true;
    penPoints = [{ x: pos.vx, y: pos.vy }];
    startX = pos.vx;
    startY = pos.vy;
  } else {
    const pos = getVirtualCoords(e);
    if (!pos) return;
    isDrawing = true;
    startX = pos.vx;
    startY = pos.vy;
  }
}

function handlePointerMove(e: MouseEvent) {
  if (!isDrawing) return;
  const ctx = canvasRef.value?.getContext("2d");
  if (!ctx) return;

  const pos = getVirtualCoords(e);
  if (!pos) return;

  if (activeTool.value === "select") {
    redraw();
    const rx = (Math.min(startX, pos.vx) - virtualX) * scale + offsetX;
    const ry = (Math.min(startY, pos.vy) - virtualY) * scale + offsetY;
    const rw = Math.abs(pos.vx - startX) * scale;
    const rh = Math.abs(pos.vy - startY) * scale;
    drawDimOverlay(ctx, rx, ry, rw, rh);
    drawSelectionBorder(ctx, rx, ry, rw, rh);
  } else if (activeTool.value === "pen") {
    const last = penPoints[penPoints.length - 1];
    if (!last) return;
    const tvx = (v: number) => (v - virtualX) * scale + offsetX;
    const tvy = (v: number) => (v - virtualY) * scale + offsetY;
    ctx.strokeStyle = strokeColor.value;
    ctx.lineWidth = strokeWidth.value;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(tvx(last.x), tvy(last.y));
    ctx.lineTo(tvx(pos.vx), tvy(pos.vy));
    ctx.stroke();
    penPoints.push({ x: pos.vx, y: pos.vy });
  } else {
    redraw();
    drawPreviewLine(ctx, startX, startY, pos.vx, pos.vy);
  }
}

function handlePointerUp(e: MouseEvent) {
  if (!isDrawing) return;
  isDrawing = false;

  const pos = getVirtualCoords(e);
  if (!pos) return;

  if (activeTool.value === "select") {
      if (Math.abs(pos.vx - startX) < 10 && Math.abs(pos.vy - startY) < 10) return;
      const selectMinX = Math.min(startX, pos.vx);
      const selectMinY = Math.min(startY, pos.vy);
      const selectMaxX = Math.max(startX, pos.vx);
      const selectMaxY = Math.max(startY, pos.vy);

      currentSelection.value = {
        x1: selectMinX,
        y1: selectMinY,
        x2: selectMaxX,
        y2: selectMaxY,
      };
      hasSelection.value = true;
      activeTool.value = "pen";
  } else if (activeTool.value === "text") {
    return;
  } else if (activeTool.value === "pen") {
    if (penPoints.length < 2) {
      penPoints = [];
      return;
    }
    annotations.value.push({
      type: "pen",
      x1: 0, y1: 0, x2: 0, y2: 0,
      color: strokeColor.value,
      width: strokeWidth.value,
      points: [...penPoints],
    });
    penPoints = [];
    redraw();
  } else {
    if (Math.abs(pos.vx - startX) < 4 && Math.abs(pos.vy - startY) < 4) return;
    addAnnotation(pos.vx, pos.vy);
  }
}

const hasSelection = ref(false);
const currentSelection = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

function addAnnotation(ex: number, ey: number) {
  const ann: Annotation = {
    type: activeTool.value as Exclude<Tool, "select">,
    x1: Math.min(startX, ex),
    y1: Math.min(startY, ey),
    x2: Math.max(startX, ex),
    y2: Math.max(startY, ey),
    color: strokeColor.value,
    width: strokeWidth.value,
  };
  if (activeTool.value === "mosaic") {
    ann.width = Math.max(Math.abs(ex - startX), Math.abs(ey - startY));
  }
  annotations.value.push(ann);
  redraw();
}

function confirmText(textVal: string, vx: number, vy: number) {
  isTextPlacing = false;
  isDrawing = false;
  textInput?.remove();
  textInput = null;
  if (!textVal.trim()) return;

  annotations.value.push({
    type: "text",
    x1: vx,
    y1: vy,
    x2: vx,
    y2: vy,
    color: strokeColor.value,
    width: fontSize.value,
    text: textVal.trim(),
    fontSize: fontSize.value,
  });
  redraw();
}

function showTextInput(vx: number, vy: number, cvx: number, cvy: number) {
  cleanupTextInput();
  const input = document.createElement("textarea");
  input.className = "cp-screenshot-text-input";
  input.style.left = `${vx}px`;
  input.style.top = `${vy}px`;
  input.style.color = strokeColor.value;
  input.style.fontSize = `${fontSize.value}px`;
  document.querySelector(".cp-screenshot-overlay")?.appendChild(input);
  textInput = input;
  input.focus();
  isComposing = false;

  const finish = () => {
    if (isComposing) return;
    confirmText(input.value, cvx, cvy);
  };
  const onBlur = () => {
    setTimeout(() => {
      if (isComposing) return;
      confirmText(input.value, cvx, cvy);
    }, 0);
  };
  const onCompositionStart = () => {
    isComposing = true;
  };
  const onCompositionEnd = () => {
    isComposing = false;
  };
  input.addEventListener("blur", onBlur);
  input.addEventListener("compositionstart", onCompositionStart);
  input.addEventListener("compositionend", onCompositionEnd);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey && !isComposing) {
      ev.preventDefault();
      finish();
    }
    if (ev.key === "Escape") {
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("compositionstart", onCompositionStart);
      input.removeEventListener("compositionend", onCompositionEnd);
      input.remove();
      textInput = null;
      isTextPlacing = false;
      isDrawing = false;
    }
  });
  textInputCleanup = () => {
    input.removeEventListener("blur", onBlur);
    input.removeEventListener("compositionstart", onCompositionStart);
    input.removeEventListener("compositionend", onCompositionEnd);
    input.remove();
  };
}

function drawPreviewLine(ctx: CanvasRenderingContext2D, sx: number, sy: number, ex: number, ey: number) {
  const tvx = (v: number) => (v - virtualX) * scale + offsetX;
  const tvy = (v: number) => (v - virtualY) * scale + offsetY;

  ctx.strokeStyle = strokeColor.value;
  ctx.lineWidth = strokeWidth.value;
  ctx.fillStyle = strokeColor.value;

  switch (activeTool.value) {
    case "arrow": {
      const dsx = tvx(sx);
      const dsy = tvy(sy);
      const dex = tvx(ex);
      const dey = tvy(ey);
      const angle = Math.atan2(dey - dsy, dex - dsx);
      const headLen = 14;
      ctx.beginPath();
      ctx.moveTo(dsx, dsy);
      ctx.lineTo(dex, dey);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(dex, dey);
      ctx.lineTo(dex - headLen * Math.cos(angle - 0.4), dey - headLen * Math.sin(angle - 0.4));
      ctx.lineTo(dex - headLen * Math.cos(angle + 0.4), dey - headLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "rect": {
      ctx.strokeRect(tvx(sx), tvy(sy), (ex - sx) * scale, (ey - sy) * scale);
      break;
    }
    case "mosaic": {
      const bs = Math.max(8, Math.min(Math.abs(ex - sx), Math.abs(ey - sy)) / 10);
      renderMosaicPreview(ctx, sx, sy, ex, ey, bs);
      break;
    }
  }
}

function renderMosaicPreview(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  ex: number, ey: number,
  blockSize: number,
) {
  const minX = Math.min(sx, ex);
  const minY = Math.min(sy, ey);
  const maxX = Math.max(sx, ex);
  const maxY = Math.max(sy, ey);

  if (baseImageData) {
    const tvx = (v: number) => (v - virtualX) * scale + offsetX;
    const tvy = (v: number) => (v - virtualY) * scale + offsetY;

    const imgData = new Uint8ClampedArray(baseImageData!.data);
    const iw = ctx.canvas.width;
    const ih = ctx.canvas.height;
    const svx = (tvx(minX));
    const svy = (tvy(minY));
    const svw = (maxX - minX) * scale;
    const svh = (maxY - minY) * scale;

    const bsAdj = Math.max(2, Math.round(blockSize * scale));

    for (let py = svy; py < svy + svh; py += bsAdj) {
      for (let px = svx; px < svx + svw; px += bsAdj) {
        const ix = Math.round(px);
        const iy = Math.round(py);
        if (ix < 0 || iy < 0 || ix >= iw || iy >= ih) continue;
        const idx = (iy * iw + ix) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        for (let dy = 0; dy < bsAdj && iy + dy < ih; dy++) {
          for (let dx = 0; dx < bsAdj && ix + dx < iw; dx++) {
            const di = ((iy + dy) * iw + (ix + dx)) * 4;
            imgData[di] = r;
            imgData[di + 1] = g;
            imgData[di + 2] = b;
          }
        }
      }
    }

    ctx.putImageData(
      new ImageData(imgData, iw, ih),
      0, 0,
      0, 0, iw, ih,
    );
  }
}

function drawDimOverlay(ctx: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.rect(rx, ry, rw, rh);
  ctx.fill("evenodd");
  ctx.restore();
}

function drawSelectionBorder(ctx: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number) {
  ctx.strokeStyle = "#4488ff";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(rx, ry, rw, rh);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  ctx.setLineDash([8, 4]);
  ctx.strokeStyle = "rgba(68, 136, 255, 0.15)";
  ctx.lineWidth = 6;
  ctx.strokeRect(rx - 2, ry - 2, rw + 4, rh + 4);
  ctx.setLineDash([]);
}

function redraw() {
  const ctx = canvasRef.value?.getContext("2d");
  if (!ctx || !baseImageData) return;
  ctx.putImageData(baseImageData, 0, 0);
  redrawAnnotations();

  if (currentSelection.value) {
    const s = currentSelection.value;
    const ix = (s.x1 - virtualX) * scale + offsetX;
    const iy = (s.y1 - virtualY) * scale + offsetY;
    const iw = (s.x2 - s.x1) * scale;
    const ih = (s.y2 - s.y1) * scale;

    drawDimOverlay(ctx, ix, iy, iw, ih);
    drawSelectionBorder(ctx, ix, iy, iw, ih);
  }
}

function redrawAnnotations() {
  const ctx = canvasRef.value?.getContext("2d");
  if (!ctx) return;
  baseImageData && ctx.putImageData(baseImageData, 0, 0);

  const tvx = (v: number) => (v - virtualX) * scale + offsetX;
  const tvy = (v: number) => (v - virtualY) * scale + offsetY;

  for (const ann of annotations.value) {
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.type === "text" ? 1 : ann.width;
    ctx.lineCap = "round";

    switch (ann.type) {
      case "pen": {
        const pts = ann.points;
        if (pts && pts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(tvx(pts[0].x), tvy(pts[0].y));
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(tvx(pts[i].x), tvy(pts[i].y));
          }
          ctx.stroke();
        }
        break;
      }
      case "arrow": {
        const dsx1 = tvx(ann.x1);
        const dsy1 = tvy(ann.y1);
        const dsx2 = tvx(ann.x2);
        const dsy2 = tvy(ann.y2);
        const angle = Math.atan2(dsy2 - dsy1, dsx2 - dsx1);
        const headLen = 14;
        ctx.beginPath();
        ctx.moveTo(dsx1, dsy1);
        ctx.lineTo(dsx2, dsy2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dsx2, dsy2);
        ctx.lineTo(dsx2 - headLen * Math.cos(angle - 0.4), dsy2 - headLen * Math.sin(angle - 0.4));
        ctx.lineTo(dsx2 - headLen * Math.cos(angle + 0.4), dsy2 - headLen * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "rect": {
        ctx.strokeRect(
          tvx(ann.x1), tvy(ann.y1),
          (ann.x2 - ann.x1) * scale,
          (ann.y2 - ann.y1) * scale,
        );
        break;
      }
      case "text": {
        ctx.font = `${ann.width}px sans-serif`;
        ctx.fillText(ann.text ?? "", tvx(ann.x1), tvy(ann.y1) + (ann.width ?? 20));
        break;
      }
      case "mosaic": {
        const bs = Math.max(8, Math.min(ann.x2 - ann.x1, ann.y2 - ann.y1) / 10);
        renderMosaicPreview(ctx, ann.x1, ann.y1, ann.x2, ann.y2, bs);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(
          tvx(ann.x1), tvy(ann.y1),
          (ann.x2 - ann.x1) * scale,
          (ann.y2 - ann.y1) * scale,
        );
        ctx.setLineDash([]);
        break;
      }
    }
  }
}

function undo() {
  if (annotations.value.length === 0) {
    if (currentSelection.value) {
      currentSelection.value = null;
      hasSelection.value = false;
      activeTool.value = "select";
      redraw();
    }
    return;
  }
  annotations.value.pop();
  redraw();
}

async function handleConfirm() {
  if (!bgCanvas) {
    error.value = "Background canvas not available for export";
    return;
  }

  let nativeX: number, nativeY: number, nativeW: number, nativeH: number;

  if (currentSelection.value) {
    const s = currentSelection.value;
    nativeX = Math.min(s.x1, s.x2);
    nativeY = Math.min(s.y1, s.y2);
    nativeW = Math.abs(s.x2 - s.x1);
    nativeH = Math.abs(s.y2 - s.y1);
  } else {
    nativeX = virtualX;
    nativeY = virtualY;
    nativeW = virtualW;
    nativeH = virtualH;
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = nativeW;
  exportCanvas.height = nativeH;
  const exportCtx = exportCanvas.getContext("2d")!;

  // 以原生分辨率绘制背景
  exportCtx.drawImage(
    bgCanvas,
    nativeX - virtualX, nativeY - virtualY, nativeW, nativeH,
    0, 0, nativeW, nativeH,
  );

  // 以原生分辨率重新绘制标注
  renderAnnotationsNative(exportCtx, nativeX, nativeY);

  const blob = await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, "image/png"));
  if (!blob) {
    error.value = "Failed to export image";
    return;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  await finishScreenshot(Array.from(bytes));
}

function renderAnnotationsNative(
  ctx: CanvasRenderingContext2D,
  originX: number, originY: number,
) {
  const tvx = (v: number) => v - originX;
  const tvy = (v: number) => v - originY;

  for (const ann of annotations.value) {
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.type === "text" ? 1 : ann.width;
    ctx.lineCap = "round";

    switch (ann.type) {
      case "pen": {
        const pts = ann.points;
        if (pts && pts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(tvx(pts[0].x), tvy(pts[0].y));
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(tvx(pts[i].x), tvy(pts[i].y));
          }
          ctx.stroke();
        }
        break;
      }
      case "arrow": {
        const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(tvx(ann.x1), tvy(ann.y1));
        ctx.lineTo(tvx(ann.x2), tvy(ann.y2));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tvx(ann.x2), tvy(ann.y2));
        ctx.lineTo(tvx(ann.x2 - headLen * Math.cos(angle - 0.4)), tvy(ann.y2 - headLen * Math.sin(angle - 0.4)));
        ctx.lineTo(tvx(ann.x2 - headLen * Math.cos(angle + 0.4)), tvy(ann.y2 - headLen * Math.sin(angle + 0.4)));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "rect": {
        ctx.strokeRect(
          tvx(ann.x1), tvy(ann.y1),
          ann.x2 - ann.x1,
          ann.y2 - ann.y1,
        );
        break;
      }
      case "text": {
        ctx.font = `${ann.width}px sans-serif`;
        ctx.fillText(ann.text ?? "", tvx(ann.x1), tvy(ann.y1) + (ann.width ?? 20));
        break;
      }
      case "mosaic": {
        const bs = Math.max(8, Math.min(ann.x2 - ann.x1, ann.y2 - ann.y1) / 10);
        renderMosaicNative(ctx, ann.x1 - originX, ann.y1 - originY, ann.x2 - originX, ann.y2 - originY, bs);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(
          tvx(ann.x1), tvy(ann.y1),
          ann.x2 - ann.x1,
          ann.y2 - ann.y1,
        );
        ctx.setLineDash([]);
        break;
      }
    }
  }
}

function renderMosaicNative(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  ex: number, ey: number,
  blockSize: number,
) {
  const minX = Math.round(Math.min(sx, ex));
  const minY = Math.round(Math.min(sy, ey));
  const maxX = Math.round(Math.max(sx, ex));
  const maxY = Math.round(Math.max(sy, ey));

  const iw = ctx.canvas.width;
  const ih = ctx.canvas.height;
  if (minX >= iw || minY >= ih || maxX <= 0 || maxY <= 0) return;

  const imgData = ctx.getImageData(0, 0, iw, ih);
  const data = imgData.data;
  const bs = Math.max(2, Math.round(blockSize));

  for (let py = minY; py < maxY; py += bs) {
    for (let px = minX; px < maxX; px += bs) {
      const ix = Math.min(px, iw - 1);
      const iy = Math.min(py, ih - 1);
      const idx = (iy * iw + ix) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const limitX = Math.min(ix + bs, iw, maxX);
      const limitY = Math.min(iy + bs, ih, maxY);
      for (let dy = 0; dy < limitY - iy; dy++) {
        for (let dx = 0; dx < limitX - ix; dx++) {
          const di = ((iy + dy) * iw + (ix + dx)) * 4;
          data[di] = r;
          data[di + 1] = g;
          data[di + 2] = b;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

async function handleCancel() {
  await cancelScreenshot();
}

function handleToolChange(tool: Tool) {
  if (activeTool.value === "text" && isTextPlacing) {
    textInput?.remove();
    textInput = null;
    isTextPlacing = false;
    isDrawing = false;
  }
  if (activeTool.value === "pen" && isDrawing) {
    penPoints = [];
    isDrawing = false;
    redraw();
  }
  activeTool.value = tool;
}

function handleColorChange(color: string) {
  strokeColor.value = color;
}

function handleWidthChange(width: number) {
  strokeWidth.value = width;
}

onBeforeUnmount(() => {
  if (dataReadyTimeout) clearTimeout(dataReadyTimeout);
  dataReadyUnlisten?.();
  if (escKeyHandler) document.removeEventListener("keydown", escKeyHandler);
  cleanupTextInput();
  resizeObserver?.disconnect();
});

function cleanupTextInput() {
  textInputCleanup?.();
  textInputCleanup = null;
  textInput?.remove();
  textInput = null;
}
</script>

<template>
  <div class="cp-screenshot-overlay">
    <div v-if="loading" class="cp-screenshot-overlay__loading">Loading screenshots...</div>
    <div v-else-if="error" class="cp-screenshot-overlay__error">{{ error }}</div>
    <template v-else>
      <div class="cp-screenshot-overlay__body">
        <canvas
          ref="canvasRef"
          @mousedown="handlePointerDown"
          @mousemove="handlePointerMove"
          @mouseup="handlePointerUp"
          @mouseleave="isDrawing = false"
        ></canvas>
      </div>
      <div class="cp-screenshot-overlay__toolbar">
        <AnnotationToolbar
          :active-tool="activeTool"
          :stroke-color="strokeColor"
          :stroke-width="strokeWidth"
          :font-size="fontSize"
          :has-selection="hasSelection"
          @tool-change="handleToolChange"
          @color-change="handleColorChange"
          @width-change="handleWidthChange"
          @undo="undo"
        />
        <div class="cp-screenshot-overlay__toolbar-actions">
          <button class="cp-screenshot-toolbar-btn cp-screenshot-toolbar-btn--cancel" @click="handleCancel" title="Cancel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button class="cp-screenshot-toolbar-btn cp-screenshot-toolbar-btn--confirm" @click="handleConfirm" title="Confirm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cp-screenshot-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  z-index: 99999;
  cursor: crosshair;
  user-select: none;
}

.cp-screenshot-overlay__loading,
.cp-screenshot-overlay__error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 18px;
  color: #fff;
}

.cp-screenshot-overlay__toolbar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(30, 30, 40, 0.85);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.cp-screenshot-overlay__toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.cp-screenshot-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease;
  flex-shrink: 0;
}

.cp-screenshot-toolbar-btn--cancel {
  background: transparent;
  color: #aaa;
}
.cp-screenshot-toolbar-btn--cancel:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.cp-screenshot-toolbar-btn--confirm {
  background: #4caf50;
  color: #fff;
}
.cp-screenshot-toolbar-btn--confirm:hover {
  background: #43a047;
}

.cp-screenshot-overlay__body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.cp-screenshot-overlay__body canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>

<style>
.cp-screenshot-text-input {
  position: fixed;
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.6);
  color: #ff4444;
  font-family: sans-serif;
  font-size: 20px;
  min-width: 60px;
  min-height: 28px;
  padding: 2px 4px;
  outline: none;
  resize: none;
  overflow: hidden;
  z-index: 100000;
}
</style>
