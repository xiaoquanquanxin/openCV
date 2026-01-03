import { AppState } from '../types';

export class StateManager {
  private state: AppState = {
    mode: 'idle',
    currentPlacementId: null,
    config: { videoWidth: 854, videoHeight: 480 }
  };

  getState(): AppState {
    return this.state;
  }

  setState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates };
  }

  // 强制重置所有状态
  forceReset(): void {
    this.state = {
      mode: 'idle',
      currentPlacementId: null,
      config: this.state.config
    };
  }

  reset(): void {
    this.forceReset();
  }
}
