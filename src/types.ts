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
  corners: Point[];
  trackingStatus: 'active' | 'lost' | 'idle';
  config: {
    videoWidth: number;
    videoHeight: number;
  };
}
