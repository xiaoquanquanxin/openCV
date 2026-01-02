import { Point } from '../types';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cv: any;
  private showTrackingBox: boolean = false;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, cv: any) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.cv = cv;
  }

  render(videoFrame: any, warpedAd: any | null, corners: Point[]): void {
    let result = videoFrame.clone();

    if (warpedAd !== null) {
      // Alpha混合：将广告叠加到视频帧
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

    // 绘制调试框（可选）
    if (this.showTrackingBox && corners.length === 4) {
      this.drawTrackingBox(result, corners);
    }

    this.cv.imshow(this.canvas, result);
    result.delete();
  }

  private drawTrackingBox(mat: any, corners: Point[]): void {
    const color = new this.cv.Scalar(0, 255, 0, 255); // 绿色
    for (let i = 0; i < 4; i++) {
      const p1 = new this.cv.Point(
        Math.round(corners[i].x),
        Math.round(corners[i].y)
      );
      const p2 = new this.cv.Point(
        Math.round(corners[(i + 1) % 4].x),
        Math.round(corners[(i + 1) % 4].y)
      );
      this.cv.line(mat, p1, p2, color, 2);
    }

    // 绘制角点
    corners.forEach(p => {
      const point = new this.cv.Point(Math.round(p.x), Math.round(p.y));
      this.cv.circle(mat, point, 5, color, -1);
    });
  }

  setShowTrackingBox(show: boolean): void {
    this.showTrackingBox = show;
  }
}
