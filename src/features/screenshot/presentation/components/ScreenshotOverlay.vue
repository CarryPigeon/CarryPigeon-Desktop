<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { getScreenshotData, finishScreenshot, cancelScreenshot } from "../../data/screenshotCommands";
import AnnotationToolbar from "./tools/AnnotationToolbar.vue";
import type { ScreenCapture } from "../../api-types";

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

type Annotation = {
  type: "pen" | "arrow" | "rect" | "text" | "mosaic";
  x1: number; y1: number; x2: number; y2: number;
  color: string; width: number; text?: string; fontSize?: number;
};
const annotations = ref<Annotation[]>([]);

let textInput: HTMLTextAreaElement | null = null;
let isTextPlacing = false;

onMounted(async () => {
  try {
    const data = await getScreenshotData();
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

    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = virtualW;
    bgCanvas.height = virtualH;
    const bgCtx = bgCanvas.getContext("2d")!;
    bgCtx.fillStyle = "#1a1a2e";
    bgCtx.fillRect(0, 0, virtualW, virtualH);

    const imagePromises = data.map((s) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          bgCtx.drawImage(img, s.x - minX, s.y - minY, s.width, s.height);
          resolve();
        };
        img.src = `data:image/png;base64,${s.data_base64}`;
      });
    });
    await Promise.all(imagePromises);

    const ctx = canvasRef.value?.getContext("2d");
    if (!ctx) {
      error.value = "Canvas not available";
      loading.value = false;
      return;
    }

    fitCanvas(ctx);
    ctx.drawImage(bgCanvas, 0, 0, virtualW * scale, virtualH * scale);
    baseImageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    loading.value = false;
  } catch (e) {
    error.value = String(e);
    loading.value = false;
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

function getVirtualCoords(e: MouseEvent): { vx: number; vy: number } | null {
  const rect = canvasRef.value!.getBoundingClientRect();
  const mx = (e.clientX - rect.left - offsetX) / scale;
  const my = (e.clientY - rect.top - offsetY) / scale;
  if (mx < 0 || my < 0 || mx > virtualW || my > virtualH) return null;
  return { vx: mx + virtualX, vy: my + virtualY };
}

function getCanvasCoords(e: MouseEvent): { cx: number; cy: number } {
  const rect = canvasRef.value!.getBoundingClientRect();
  return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
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
    isDrawing = true;
    const canvasCoord = getCanvasCoords(e);
    showTextInput(canvasCoord.cx, canvasCoord.cy, pos.vx, pos.vy);
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
    ctx.strokeStyle = "#ffffff";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(
      (Math.min(startX, pos.vx) - virtualX) * scale + offsetX,
      (Math.min(startY, pos.vy) - virtualY) * scale + offsetY,
      Math.abs(pos.vx - startX) * scale,
      Math.abs(pos.vy - startY) * scale,
    );
    ctx.setLineDash([]);
  } else {
    redrawAnnotations();
    drawPreviewLine(ctx, startX, startY, pos.vx, pos.vy);
  }
}

function handlePointerUp(e: MouseEvent) {
  if (!isDrawing) return;
  isDrawing = false;

  const pos = getVirtualCoords(e);
  if (!pos) return;

  if (activeTool.value === "select") {
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
    }
  } else {
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

function showTextInput(cx: number, cy: number, vx: number, vy: number) {
  textInput?.remove();
  const input = document.createElement("textarea");
  input.className = "cp-screenshot-text-input";
  input.style.left = `${cx}px`;
  input.style.top = `${cy}px`;
  input.style.color = strokeColor.value;
  input.style.fontSize = `${fontSize.value}px`;
  document.querySelector(".cp-screenshot-overlay")?.appendChild(input);
  textInput = input;
  input.focus();

  const finish = () => {
    confirmText(input.value, vx, vy);
  };
  input.addEventListener("blur", finish);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      finish();
    }
    if (ev.key === "Escape") {
      input.remove();
      textInput = null;
      isTextPlacing = false;
      isDrawing = false;
    }
  });
}

function drawPreviewLine(ctx: CanvasRenderingContext2D, sx: number, sy: number, ex: number, ey: number) {
  const tvx = (v: number) => (v - virtualX) * scale + offsetX;
  const tvy = (v: number) => (v - virtualY) * scale + offsetY;

  ctx.strokeStyle = strokeColor.value;
  ctx.lineWidth = strokeWidth.value;
  ctx.fillStyle = strokeColor.value;

  switch (activeTool.value) {
    case "pen": {
      ctx.beginPath();
      ctx.moveTo(tvx(startX), tvy(startY));
      ctx.lineTo(tvx(ex), tvy(ey));
      ctx.stroke();
      break;
    }
    case "arrow": {
      const angle = Math.atan2(ey - sy, ex - sx);
      const headLen = 12;
      ctx.beginPath();
      ctx.moveTo(tvx(sx), tvy(sy));
      ctx.lineTo(tvx(ex), tvy(ey));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tvx(ex), tvy(ey));
      ctx.lineTo(tvx(ex - headLen * Math.cos(angle - 0.4)), tvy(ey - headLen * Math.sin(angle - 0.4)));
      ctx.lineTo(tvx(ex - headLen * Math.cos(angle + 0.4)), tvy(ey - headLen * Math.sin(angle + 0.4)));
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

function redraw() {
  const ctx = canvasRef.value?.getContext("2d");
  if (!ctx || !baseImageData) return;
  ctx.putImageData(baseImageData, 0, 0);
  redrawAnnotations();

  if (currentSelection.value) {
    const s = currentSelection.value;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      (s.x1 - virtualX) * scale + offsetX,
      (s.y1 - virtualY) * scale + offsetY,
      (s.x2 - s.x1) * scale,
      (s.y2 - s.y1) * scale,
    );
    ctx.setLineDash([]);
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
        ctx.beginPath();
        ctx.moveTo(tvx(ann.x1), tvy(ann.y1));
        ctx.lineTo(tvx(ann.x2), tvy(ann.y2));
        ctx.stroke();
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
    }
    return;
  }
  annotations.value.pop();
  redraw();
}

async function handleConfirm() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let exportW = virtualW;
  let exportH = virtualH;
  let exportSrcX = 0;
  let exportSrcY = 0;

  if (currentSelection.value) {
    exportSrcX = (currentSelection.value.x1 - virtualX) * scale + offsetX;
    exportSrcY = (currentSelection.value.y1 - virtualY) * scale + offsetY;
    exportW = (currentSelection.value.x2 - currentSelection.value.x1) * scale;
    exportH = (currentSelection.value.y2 - currentSelection.value.y1) * scale;
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = exportW;
  exportCanvas.height = exportH;
  const exportCtx = exportCanvas.getContext("2d")!;
  exportCtx.drawImage(canvas, exportSrcX, exportSrcY, exportW, exportH, 0, 0, exportW, exportH);

  const blob = await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, "image/png"));
  if (!blob) {
    error.value = "Failed to export image";
    return;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  await finishScreenshot(Array.from(bytes));
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
  activeTool.value = tool;
}

function handleColorChange(color: string) {
  strokeColor.value = color;
}

function handleWidthChange(width: number) {
  strokeWidth.value = width;
}

onBeforeUnmount(() => {
  textInput?.remove();
});
</script>

<template>
  <div class="cp-screenshot-overlay">
    <div v-if="loading" class="cp-screenshot-overlay__loading">Loading screenshots...</div>
    <div v-else-if="error" class="cp-screenshot-overlay__error">{{ error }}</div>
    <template v-else>
      <div class="cp-screenshot-overlay__header">
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
        <div class="cp-screenshot-overlay__actions">
          <button class="cp-screenshot-btn cp-screenshot-btn--cancel" @click="handleCancel">Cancel</button>
          <button class="cp-screenshot-btn cp-screenshot-btn--confirm" @click="handleConfirm">
            Confirm
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      </div>
      <div class="cp-screenshot-overlay__body">
        <canvas
          ref="canvasRef"
          @mousedown="handlePointerDown"
          @mousemove="handlePointerMove"
          @mouseup="handlePointerUp"
          @mouseleave="isDrawing = false"
        ></canvas>
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
  background: rgba(0, 0, 0, 0.85);
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

.cp-screenshot-overlay__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(30, 30, 50, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  z-index: 2;
}

.cp-screenshot-overlay__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cp-screenshot-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.cp-screenshot-btn--cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
}
.cp-screenshot-btn--cancel:hover {
  background: rgba(255, 255, 255, 0.18);
}

.cp-screenshot-btn--confirm {
  background: #4caf50;
  color: #fff;
}
.cp-screenshot-btn--confirm:hover {
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
