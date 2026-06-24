import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ScreenshotOverlay from "../ScreenshotOverlay.vue";
import type { ScreenCapture } from "@/features/screenshot/api-types";

const mocks = vi.hoisted(() => ({
  getScreenshotData: vi.fn(),
  finishScreenshot: vi.fn(),
  cancelScreenshot: vi.fn(),
}));

vi.mock("../../../data/screenshotCommands", () => mocks);

const mockCapture: ScreenCapture = {
  monitor_id: 0,
  width: 1920,
  height: 1080,
  x: 0,
  y: 0,
  scale_factor: 1,
  data_base64:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
};

let OriginalImage: typeof Image;

function setupImageMock() {
  OriginalImage = globalThis.Image;
  class ImmediateImage {
    onload: (() => void) | null = null;
    width = 0;
    height = 0;
    set src(_val: string) {
      this.onload?.();
    }
    get src() {
      return "";
    }
    constructor() {
      // no-op
    }
  }
  globalThis.Image = ImmediateImage as unknown as typeof Image;
}

function teardownImageMock() {
  globalThis.Image = OriginalImage;
}

function setupCanvasMocks() {
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    disconnect = vi.fn();
  } as unknown as typeof ResizeObserver);
  Object.defineProperty(
    HTMLCanvasElement.prototype,
    "getContext",
    {
      configurable: true,
      writable: true,
      value(this: HTMLCanvasElement) {
        return {
          canvas: this,
          drawImage: vi.fn(),
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
          })),
          putImageData: vi.fn(),
          strokeStyle: "",
          fillStyle: "",
          lineWidth: 1,
          lineCap: "round",
          font: "",
          setLineDash: vi.fn(),
          strokeRect: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          closePath: vi.fn(),
          fillText: vi.fn(),
          measureText: vi.fn(() => ({ width: 10 })),
          createImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
          })),
        } as unknown as CanvasRenderingContext2D;
      },
    },
  );
}

describe("ScreenshotOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    teardownImageMock();
    vi.unstubAllGlobals();
    delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).getContext;
  });

  it("renders loading state when getScreenshotData is pending", () => {
    mocks.getScreenshotData.mockReturnValue(new Promise(() => {}));
    const wrapper = mount(ScreenshotOverlay);
    expect(wrapper.find(".cp-screenshot-overlay__loading").exists()).toBe(true);
    expect(wrapper.text()).toContain("Loading screenshots...");
  });

  it("renders error when captures array is empty", async () => {
    mocks.getScreenshotData.mockResolvedValue([]);
    const wrapper = mount(ScreenshotOverlay);
    await flushPromises();
    expect(wrapper.find(".cp-screenshot-overlay__error").exists()).toBe(true);
    expect(wrapper.text()).toContain("No screen captures available");
  });

  it("renders error when getScreenshotData throws", async () => {
    mocks.getScreenshotData.mockRejectedValue(new Error("API error"));
    const wrapper = mount(ScreenshotOverlay);
    await flushPromises();
    expect(wrapper.find(".cp-screenshot-overlay__error").exists()).toBe(true);
    expect(wrapper.text()).toContain("API error");
  });

  it("renders canvas and controls when captures are loaded", async () => {
    let resolveData!: (value: ScreenCapture[]) => void;
    mocks.getScreenshotData.mockImplementation(
      () => new Promise((resolve) => { resolveData = resolve; }),
    );
    setupImageMock();
    setupCanvasMocks();

    const wrapper = mount(ScreenshotOverlay);

    (wrapper.vm as unknown as Record<string, unknown>).loading = false;
    (wrapper.vm as unknown as Record<string, unknown>).error = "";
    await wrapper.vm.$nextTick();

    const bodyDiv = wrapper.find(".cp-screenshot-overlay__body")
      .element as HTMLElement;
    Object.defineProperty(bodyDiv, "clientWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(bodyDiv, "clientHeight", {
      configurable: true,
      value: 768,
    });

    resolveData([mockCapture]);
    await flushPromises();

    expect(wrapper.find("canvas").exists()).toBe(true);
  });

  it("calls cancelScreenshot when cancel button is clicked", async () => {
    let resolveData!: (value: ScreenCapture[]) => void;
    mocks.getScreenshotData.mockImplementation(
      () => new Promise((resolve) => { resolveData = resolve; }),
    );
    setupImageMock();
    setupCanvasMocks();

    const wrapper = mount(ScreenshotOverlay);

    (wrapper.vm as unknown as Record<string, unknown>).loading = false;
    (wrapper.vm as unknown as Record<string, unknown>).error = "";
    await wrapper.vm.$nextTick();

    const bodyDiv = wrapper.find(".cp-screenshot-overlay__body")
      .element as HTMLElement;
    Object.defineProperty(bodyDiv, "clientWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(bodyDiv, "clientHeight", {
      configurable: true,
      value: 768,
    });

    resolveData([mockCapture]);
    await flushPromises();

    await wrapper.find(".cp-screenshot-btn--cancel").trigger("click");
    expect(mocks.cancelScreenshot).toHaveBeenCalled();
  });
});
