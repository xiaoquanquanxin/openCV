import { Point } from '../types';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cv: any;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, cv: any) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.cv = cv;
  }

  render(videoFrame: any, warpedAd: any | null): void {
    let result = videoFrame.clone();

    if (warpedAd !== null) {
      // Alpha混合
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

    this.cv.imshow(this.canvas, result);
    result.delete();
  }
}
