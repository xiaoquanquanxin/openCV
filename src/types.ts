export interface Point {
  x: number;
  y: number;
}

export interface MarkingState {
  points: Point[];
  isComplete: boolean;
  isMarking: boolean;
}

export interface AppState {
  mode: 'marking' | 'tracking' | 'idle';
  currentPlacementId: string | null;
  config: {
    videoWidth: number;
    videoHeight: number;
  };
}

// 广告素材
export interface AdSource {
  id: string;
  type: 'image' | 'video';
  element: HTMLImageElement | HTMLVideoElement;
  url: string;
}

// 广告位
export interface AdPlacement {
  id: string;
  adId: string;           // 关联的广告ID
  corners: Point[];       // 4个角点
  isActive: boolean;
}

// 应用配置
export interface AppConfig {
  videoUrl: string;
  videoSize: { width: number; height: number };
  ads: {
    id: string;
    url: string;
    type: 'image' | 'video';
  }[];
}
