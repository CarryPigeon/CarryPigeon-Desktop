export interface ScreenCapture {
  monitor_id: number;
  width: number;
  height: number;
  x: number;
  y: number;
  scale_factor: number;
  data_base64: string;
  file_path?: string | null;
}
