import { AdPlacement, Point } from '../types';
import { Tracker } from './tracker';
import { Transform } from './transform';

export class PlacementManager {
  private cv: any;
  private placements: Map<string, AdPlacement> = new Map();
  private trackers: Map<string, Tracker> = new Map();
  private transforms: Map<string, Transform> = new Map();

  constructor(cv: any) {
    this.cv = cv;
  }

  addPlacement(placement: AdPlacement): void {
    this.placements.set(placement.id, placement);
  }

  updateCorners(placementId: string, corners: Point[]): void {
    const placement = this.placements.get(placementId);
    if (placement) {
      placement.corners = corners;
      placement.isActive = true;
    }
  }

  initializeTracking(placementId: string, corners: Point[], firstFrame: any): void {
    const tracker = new Tracker(this.cv);
    tracker.initialize(corners, firstFrame);
    this.trackers.set(placementId, tracker);
  }

  initializeTransform(placementId: string, adElement: HTMLImageElement, videoWidth: number, videoHeight: number): void {
    const transform = new Transform(this.cv);
    transform.initialize({
      adImage: adElement,
      videoWidth,
      videoHeight
    });
    this.transforms.set(placementId, transform);
  }

  getTracker(placementId: string): Tracker | undefined {
    return this.trackers.get(placementId);
  }

  getTransform(placementId: string): Transform | undefined {
    return this.transforms.get(placementId);
  }

  getPlacement(placementId: string): AdPlacement | undefined {
    return this.placements.get(placementId);
  }

  getAllActivePlacements(): AdPlacement[] {
    return Array.from(this.placements.values()).filter(p => p.isActive);
  }

  // 强制清空所有数据
  forceReset(): void {
    // 清理所有跟踪器
    this.trackers.forEach(tracker => tracker.cleanup());
    this.trackers.clear();

    // 清理所有变换器
    this.transforms.forEach(transform => transform.cleanup());
    this.transforms.clear();

    // 清空所有广告位
    this.placements.clear();
  }

  reset(): void {
    this.forceReset();
  }
}
