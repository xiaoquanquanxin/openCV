import { ResourceManager } from './modules/resourceManager';
import { PlacementManager } from './modules/placementManager';
import { MarkingUI } from './modules/markingUI';
import { StateManager } from './modules/state';
import { Renderer } from './modules/renderer';
import { AppConfig, AdPlacement } from './types';

class VideoAdReplacer {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cv: any;

  private resourceManager: ResourceManager;
  private placementManager: PlacementManager;
  private stateManager: StateManager;
  private markingUI: MarkingUI;
  private renderer: Renderer;

  private isProcessing: boolean = false;
  private animationFrameId: number | null = null;

  // FPS 计数器
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private currentFps: number = 0;

  private config: AppConfig = {
    videoUrl: '/assets/videos/stock.mp4',
    videoSize: { width: 854, height: 480 },
    ads: [
      { id: 'ad1', url: '/assets/images/ad-image.png', type: 'image' }
      // 可在此添加更多广告
    ]
  };

  constructor() {
    this.initElements();
    this.initModules();
    this.setupEventListeners();
    this.loadVideo();
  }

  async loadResources(): Promise<void> {
    try {
      for (const ad of this.config.ads) {
        await this.resourceManager.loadAdImage(ad.id, ad.url);
      }

      const loadingStatus = document.getElementById('loadingStatus');
      if (loadingStatus) {
        loadingStatus.textContent = '✓ 已就绪';
        loadingStatus.style.color = '#4CAF50';
      }
    } catch (error) {
      console.error('资源加载失败:', error);
      const loadingStatus = document.getElementById('loadingStatus');
      if (loadingStatus) {
        loadingStatus.textContent = '✗ 资源加载失败';
        loadingStatus.style.color = '#f44336';
      }
    }
  }

  private initElements(): void {
    this.video = document.getElementById('videoInput') as HTMLVideoElement;
    this.canvas = document.getElementById('canvasOutput') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.cv = (window as any).cv;
  }

  private initModules(): void {
    this.resourceManager = new ResourceManager(this.cv);
    this.placementManager = new PlacementManager(this.cv);
    this.stateManager = new StateManager();
    this.markingUI = new MarkingUI(this.canvas, this.ctx);
    this.renderer = new Renderer(this.canvas, this.ctx, this.cv);

    this.markingUI.onComplete = (corners) => {
      const placementId = 'placement-' + Date.now();
      const adId = 'ad1';

      const placement: AdPlacement = {
        id: placementId,
        adId: adId,
        corners: corners,
        isActive: true
      };

      this.placementManager.addPlacement(placement);
      this.stateManager.setState({
        mode: 'tracking',
        currentPlacementId: placementId
      });

      this.startTracking(placementId);
    };
  }

  private setupEventListeners(): void {
    const startBtn = document.getElementById('startMarking') as HTMLButtonElement;
    const replayBtn = document.getElementById('replay') as HTMLButtonElement;
    const resetBtn = document.getElementById('reset') as HTMLButtonElement;

    startBtn.addEventListener('click', () => {
      if (this.resourceManager.getAllAdSources().length === 0) {
        alert('资源尚未加载完成，请稍等');
        return;
      }

      this.stopProcessing();
      this.video.pause();
      this.video.currentTime = 0;

      // 隐藏重播按钮
      replayBtn.style.display = 'none';
    });

    replayBtn.addEventListener('click', () => {
      const currentPlacementId = this.stateManager.getState().currentPlacementId;
      if (!currentPlacementId) return;

      // 停止当前播放
      this.stopProcessing();

      // 重新开始跟踪（会重置到第一帧）
      this.startTracking(currentPlacementId);
    });

    resetBtn.addEventListener('click', () => {
      this.stopProcessing();

      this.placementManager.forceReset();
      this.markingUI.forceReset();
      this.stateManager.forceReset();
      this.renderer.cleanup();

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.video.currentTime = 0;

      // 隐藏重播按钮
      replayBtn.style.display = 'none';
    });

    this.video.addEventListener('seeked', () => {
      const mode = this.stateManager.getState().mode;

      if (mode === 'idle') {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        this.markingUI.startMarking();
      }
    });

    // 前景检测参数控制
    const enableForeground = document.getElementById('enableForeground') as HTMLInputElement;
    const motionThreshold = document.getElementById('motionThreshold') as HTMLInputElement;
    const dilateSize = document.getElementById('dilateSize') as HTMLInputElement;
    const blurSize = document.getElementById('blurSize') as HTMLInputElement;

    enableForeground?.addEventListener('change', () => {
      this.renderer.setConfig({ useForegroundDetection: enableForeground.checked });
    });

    motionThreshold?.addEventListener('input', () => {
      const value = parseInt(motionThreshold.value);
      document.getElementById('thresholdValue')!.textContent = value.toString();
      this.renderer.setConfig({ motionThreshold: value });
    });

    dilateSize?.addEventListener('input', () => {
      const value = parseInt(dilateSize.value);
      document.getElementById('dilateValue')!.textContent = value.toString();
      this.renderer.setConfig({ dilateSize: value });
    });

    blurSize?.addEventListener('input', () => {
      const value = parseInt(blurSize.value);
      document.getElementById('blurValue')!.textContent = value.toString();
      this.renderer.setConfig({ blurSize: value });
    });
  }

  private loadVideo(): void {
    this.video.src = this.config.videoUrl;
    this.canvas.width = this.config.videoSize.width;
    this.canvas.height = this.config.videoSize.height;
  }

  private startTracking(placementId: string): void {
    const placement = this.placementManager.getPlacement(placementId);
    if (!placement) return;

    const adSource = this.resourceManager.getAdSource(placement.adId);
    if (!adSource) {
      alert('广告资源未加载');
      return;
    }

    this.stopProcessing();
    this.video.pause();
    this.video.currentTime = 0;

    const onSeeked = () => {
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const firstFrame = this.cv.imread(this.canvas);

      this.placementManager.initializeTracking(placementId, placement.corners, firstFrame);

      this.placementManager.initializeTransform(
        placementId,
        adSource.element as HTMLImageElement,
        this.config.videoSize.width,
        this.config.videoSize.height
      );

      firstFrame.delete();

      this.video.removeEventListener('seeked', onSeeked);
      this.video.play();
      this.isProcessing = true;

      // 重置 FPS 计数器
      this.frameCount = 0;
      this.lastFpsUpdate = performance.now();
      this.currentFps = 0;

      this.processVideoWithTracking();

      // 显示重播按钮
      const replayBtn = document.getElementById('replay') as HTMLButtonElement;
      if (replayBtn) {
        replayBtn.style.display = 'inline-block';
      }
    };

    this.video.addEventListener('seeked', onSeeked, { once: true });
  }

  private processVideoWithTracking(): void {
    if (!this.isProcessing || this.video.paused || this.video.ended) {
      return;
    }

    // FPS 计算
    const now = performance.now();
    this.frameCount++;

    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;

      // 更新 UI 显示
      const fpsDisplay = document.getElementById('fpsDisplay');
      if (fpsDisplay) {
        fpsDisplay.textContent = `${this.currentFps} FPS`;
      }
    }

    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    const currentFrame = this.cv.imread(this.canvas);

    const currentPlacementId = this.stateManager.getState().currentPlacementId;
    if (currentPlacementId) {
      const tracker = this.placementManager.getTracker(currentPlacementId);
      const transform = this.placementManager.getTransform(currentPlacementId);

      if (tracker && transform) {
        const trackedCorners = tracker.track(currentFrame);
        const warpedAd = transform.warpAd(trackedCorners);

        this.renderer.render(currentFrame, warpedAd);

        if (warpedAd) warpedAd.delete();
      }
    }

    currentFrame.delete();

    this.animationFrameId = requestAnimationFrame(() => this.processVideoWithTracking());
  }

  private stopProcessing(): void {
    this.isProcessing = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.video.pause();
  }
}

function onOpenCvReady() {
  const cv = (window as any).cv;
  if (!cv || typeof cv.Mat !== 'function') {
    setTimeout(onOpenCvReady, 100);
    return;
  }

  const app = new VideoAdReplacer();
  app.loadResources();
}

if (typeof (window as any).cv !== 'undefined') {
  onOpenCvReady();
} else {
  const checkOpenCV = () => {
    if (typeof (window as any).cv !== 'undefined') {
      onOpenCvReady();
    } else {
      setTimeout(checkOpenCV, 100);
    }
  };
  checkOpenCV();
}
