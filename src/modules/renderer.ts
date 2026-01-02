import { Point } from '../types';

export interface RendererConfig {
  useForegroundDetection: boolean;  // 是否启用前景检测
  motionThreshold: number;          // 运动检测阈值 (0-255)
  dilateSize: number;               // 膨胀核大小 (用于填补空洞)
  blurSize: number;                 // 模糊核大小 (平滑边缘)
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cv: any;
  private prevFrame: any = null;

  private config: RendererConfig = {
    useForegroundDetection: true,
    motionThreshold: 25,
    dilateSize: 5,
    blurSize: 5
  };

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, cv: any) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.cv = cv;
  }

  setConfig(config: Partial<RendererConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RendererConfig {
    return { ...this.config };
  }

  render(videoFrame: any, warpedAd: any | null): void {
    let result = videoFrame.clone();

    if (warpedAd !== null) {
      if (this.config.useForegroundDetection && this.prevFrame) {
        // 使用前景检测
        const mask = this.detectForeground(videoFrame);
        this.renderWithMask(result, warpedAd, mask);
        mask.delete();
      } else {
        // 简单 Alpha 混合
        this.renderSimple(result, warpedAd);
      }
    }

    this.cv.imshow(this.canvas, result);
    result.delete();

    // 保存当前帧用于下一次运动检测
    if (this.prevFrame) this.prevFrame.delete();
    this.prevFrame = videoFrame.clone();
  }

  private detectForeground(currentFrame: any): any {
    // 1. 转灰度
    const currentGray = new this.cv.Mat();
    const prevGray = new this.cv.Mat();
    this.cv.cvtColor(currentFrame, currentGray, this.cv.COLOR_RGBA2GRAY);
    this.cv.cvtColor(this.prevFrame, prevGray, this.cv.COLOR_RGBA2GRAY);

    // 2. 帧差法检测运动
    const diff = new this.cv.Mat();
    this.cv.absdiff(currentGray, prevGray, diff);

    // 3. 阈值化 - 运动区域变白色
    const mask = new this.cv.Mat();
    this.cv.threshold(
      diff,
      mask,
      this.config.motionThreshold,  // 可调参数
      255,
      this.cv.THRESH_BINARY
    );

    // 4. 形态学操作 - 填补空洞、平滑边缘
    if (this.config.dilateSize > 0) {
      const kernel = this.cv.getStructuringElement(
        this.cv.MORPH_ELLIPSE,
        new this.cv.Size(this.config.dilateSize, this.config.dilateSize)
      );
      this.cv.dilate(mask, mask, kernel);
      kernel.delete();
    }

    // 5. 高斯模糊 - 平滑边缘
    if (this.config.blurSize > 0) {
      // 确保核大小是奇数（OpenCV 要求）
      let ksize = this.config.blurSize;
      if (ksize % 2 === 0) {
        ksize = ksize + 1;  // 偶数 → 奇数
      }

      this.cv.GaussianBlur(
        mask,
        mask,
        new this.cv.Size(ksize, ksize),
        0
      );
    }

    currentGray.delete();
    prevGray.delete();
    diff.delete();

    return mask;
  }

  private renderWithMask(result: any, warpedAd: any, mask: any): void {
    // 像素级渲染，只在非运动区域（背景）叠加广告
    for (let i = 0; i < result.rows; i++) {
      for (let j = 0; j < result.cols; j++) {
        const adAlpha = warpedAd.ucharPtr(i, j)[3] / 255.0;

        if (adAlpha > 0.1) {
          // 检查遮罩：值越小表示越可能是背景
          const maskValue = mask.ucharPtr(i, j)[0] / 255.0;

          // 背景置信度 = 1 - 前景置信度
          const backgroundConfidence = 1.0 - maskValue;

          // 只在背景区域渲染广告
          if (backgroundConfidence > 0.5) {
            const finalAlpha = adAlpha * backgroundConfidence;

            for (let c = 0; c < 3; c++) {
              result.ucharPtr(i, j)[c] =
                result.ucharPtr(i, j)[c] * (1 - finalAlpha) +
                warpedAd.ucharPtr(i, j)[c] * finalAlpha;
            }
          }
        }
      }
    }
  }

  private renderSimple(result: any, warpedAd: any): void {
    // 简单 Alpha 混合（原始实现）
    for (let i = 0; i < result.rows; i++) {
      for (let j = 0; j < result.cols; j++) {
        const alpha = warpedAd.ucharPtr(i, j)[3] / 255.0;
        if (alpha > 0.1) {
          for (let c = 0; c < 3; c++) {
            result.ucharPtr(i, j)[c] =
              result.ucharPtr(i, j)[c] * (1 - alpha) +
              warpedAd.ucharPtr(i, j)[c] * alpha;
          }
        }
      }
    }
  }

  cleanup(): void {
    if (this.prevFrame) {
      this.prevFrame.delete();
      this.prevFrame = null;
    }
  }
}
