import { Point } from '../types';

interface TransformConfig {
  adImage: HTMLImageElement;
  videoWidth: number;
  videoHeight: number;
}

export class Transform {
  private cv: any;
  private config: TransformConfig;
  private adMat: any;

  constructor(cv: any) {
    this.cv = cv;
  }

  initialize(config: TransformConfig): void {
    this.config = config;

    // 将广告图像转为Mat
    const canvas = document.createElement('canvas');
    canvas.width = config.adImage.width;
    canvas.height = config.adImage.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(config.adImage, 0, 0);

    this.adMat = this.cv.imread(canvas);
    console.log(`广告图像加载完成: ${this.adMat.cols}x${this.adMat.rows}`);
  }

  warpAd(corners: Point[]): any | null {
    // 检查边界
    if (!this.isInBounds(corners)) {
      return null;
    }

    // 源点（广告图像的4个角）
    const srcPoints = this.cv.matFromArray(4, 1, this.cv.CV_32FC2, [
      0, 0,
      this.adMat.cols, 0,
      this.adMat.cols, this.adMat.rows,
      0, this.adMat.rows
    ]);

    // 目标点（视频中的4个角）
    const dstPoints = this.cv.matFromArray(4, 1, this.cv.CV_32FC2, [
      corners[0].x, corners[0].y,
      corners[1].x, corners[1].y,
      corners[2].x, corners[2].y,
      corners[3].x, corners[3].y
    ]);

    // 计算透视变换矩阵
    const M = this.cv.getPerspectiveTransform(srcPoints, dstPoints);

    // 执行透视变换
    const warped = new this.cv.Mat();
    const dsize = new this.cv.Size(this.config.videoWidth, this.config.videoHeight);

    this.cv.warpPerspective(
      this.adMat,
      warped,
      M,
      dsize,
      this.cv.INTER_LINEAR,
      this.cv.BORDER_CONSTANT,
      new this.cv.Scalar(0, 0, 0, 0)
    );

    // 清理
    srcPoints.delete();
    dstPoints.delete();
    M.delete();

    return warped;
  }

  private isInBounds(corners: Point[]): boolean {
    let inBoundsCount = 0;
    corners.forEach(p => {
      if (p.x >= 0 && p.x < this.config.videoWidth &&
          p.y >= 0 && p.y < this.config.videoHeight) {
        inBoundsCount++;
      }
    });
    return inBoundsCount >= 3;
  }

  cleanup(): void {
    if (this.adMat) this.adMat.delete();
  }
}
