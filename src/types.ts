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
  videoFps: number;  // 原视频帧率
  previewSize: { width: number; height: number };  // 预览canvas大小
  ads: {
    id: string;
    url: string;
    type: 'image' | 'video';
  }[];
}
