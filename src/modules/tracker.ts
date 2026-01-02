import { Point } from '../types';

interface TrackerState {
  cornerPoints: Point[];
  featurePoints: any;
  prevGray: any;
  trackingStatus: 'active' | 'lost' | 'idle';
  lostFrameCount: number;
  history: Point[][];
}

export class Tracker {
  private cv: any;
  private state: TrackerState;

  public onTrackingLost?: () => void;

  constructor(cv: any) {
    this.cv = cv;
    this.state = {
      cornerPoints: [],
      featurePoints: null,
      prevGray: null,
      trackingStatus: 'idle',
      lostFrameCount: 0,
      history: []
    };
  }

  initialize(corners: Point[], firstFrame: any): void {
    this.state.cornerPoints = corners;

    const gray = new this.cv.Mat();
    this.cv.cvtColor(firstFrame, gray, this.cv.COLOR_RGBA2GRAY);

    this.state.featurePoints = this.detectFeatures(corners, gray);
    this.state.prevGray = gray;
    this.state.trackingStatus = 'active';
    this.state.history = [corners];
  }

  private detectFeatures(corners: Point[], frame: any): any {
    const features = new this.cv.Mat();
    const mask = this.cv.Mat.zeros(frame.rows, frame.cols, this.cv.CV_8UC1);

    corners.forEach(corner => {
      this.cv.circle(
        mask,
        new this.cv.Point(Math.round(corner.x), Math.round(corner.y)),
        30,
        new this.cv.Scalar(255),
        -1
      );
    });

    this.cv.goodFeaturesToTrack(frame, features, 100, 0.01, 10, mask, 3, false, 0.04);

    mask.delete();
    return features;
  }

  track(currentFrame: any): Point[] {
    if (this.state.trackingStatus === 'idle') {
      return this.state.cornerPoints;
    }

    const currentGray = new this.cv.Mat();
    this.cv.cvtColor(currentFrame, currentGray, this.cv.COLOR_RGBA2GRAY);

    const nextPts = new this.cv.Mat();
    const status = new this.cv.Mat();
    const err = new this.cv.Mat();

    this.cv.calcOpticalFlowPyrLK(
      this.state.prevGray,
      currentGray,
      this.state.featurePoints,
      nextPts,
      status,
      err,
      new this.cv.Size(21, 21),
      3,
      new this.cv.TermCriteria(
        this.cv.TERM_CRITERIA_EPS | this.cv.TERM_CRITERIA_COUNT,
        30,
        0.01
      )
    );

    let successCount = 0;
    for (let i = 0; i < status.rows; i++) {
      if (status.data[i] === 1) successCount++;
    }

    const successRate = successCount / status.rows;

    if (successRate < 0.5) {
      this.state.lostFrameCount++;
      if (this.state.lostFrameCount > 5) {
        this.state.trackingStatus = 'lost';
        this.onTrackingLost?.();
      }
    } else {
      this.state.lostFrameCount = 0;
    }

    const newCorners = this.updateCorners(nextPts, status);
    const smoothedCorners = this.smoothCorners(newCorners);

    this.state.cornerPoints = smoothedCorners;
    this.state.featurePoints.delete();
    this.state.featurePoints = nextPts;
    this.state.prevGray.delete();
    this.state.prevGray = currentGray;

    status.delete();
    err.delete();

    return smoothedCorners;
  }

  private updateCorners(nextPts: any, status: any): Point[] {
    let sumDx = 0, sumDy = 0, count = 0;

    for (let i = 0; i < status.rows; i++) {
      if (status.data[i] === 1) {
        const newX = nextPts.data32F[i * 2];
        const newY = nextPts.data32F[i * 2 + 1];
        const oldX = this.state.featurePoints.data32F[i * 2];
        const oldY = this.state.featurePoints.data32F[i * 2 + 1];

        sumDx += (newX - oldX);
        sumDy += (newY - oldY);
        count++;
      }
    }

    if (count === 0) return this.state.cornerPoints;

    const avgDx = sumDx / count;
    const avgDy = sumDy / count;

    return this.state.cornerPoints.map(p => ({
      x: p.x + avgDx,
      y: p.y + avgDy
    }));
  }

  private smoothCorners(newCorners: Point[]): Point[] {
    this.state.history.push(newCorners);
    if (this.state.history.length > 3) {
      this.state.history.shift();
    }

    const smoothed: Point[] = [];
    for (let i = 0; i < 4; i++) {
      let sumX = 0, sumY = 0;
      this.state.history.forEach(corners => {
        sumX += corners[i].x;
        sumY += corners[i].y;
      });
      smoothed.push({
        x: sumX / this.state.history.length,
        y: sumY / this.state.history.length
      });
    }

    return smoothed;
  }

  cleanup(): void {
    if (this.state.featurePoints) {
      this.state.featurePoints.delete();
      this.state.featurePoints = null;
    }
    if (this.state.prevGray) {
      this.state.prevGray.delete();
      this.state.prevGray = null;
    }

    this.state = {
      cornerPoints: [],
      featurePoints: null,
      prevGray: null,
      trackingStatus: 'idle',
      lostFrameCount: 0,
      history: []
    };
  }
}
