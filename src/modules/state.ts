import { AppState } from '../types';

export class StateManager {
  private state: AppState = {
    mode: 'idle',
    corners: [],
    trackingStatus: 'idle',
    config: { videoWidth: 854, videoHeight: 480 }
  };

  getState(): AppState {
    return this.state;
  }

  setState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates };
  }

  reset(): void {
    this.state = {
      mode: 'idle',
      corners: [],
      trackingStatus: 'idle',
      config: this.state.config
    };
  }
}
