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

  // 离线渲染用的隐藏 canvas
  private offlineCanvas: HTMLCanvasElement;
  private offlineCtx: CanvasRenderingContext2D;

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
    videoFps: 30,  // 原视频帧率（需要根据实际视频调整）
    previewSize: { width: 854, height: 480 },  // 预览canvas大小
    ads: [
      { id: 'ad1', url: '/assets/images/ad-image.png', type: 'image' }
      // 可在此添加更多广告
    ]
  };

  // 原视频的真实分辨率（从视频元数据自动获取）
  private videoRealWidth: number = 0;
  private videoRealHeight: number = 0;
  private videoDetectedFps: number = 0;  // 检测到的帧率

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

    // 创建离线渲染 canvas（不添加到 DOM）
    // 初始尺寸，会在视频加载后更新为真实分辨率
    this.offlineCanvas = document.createElement('canvas');
    this.offlineCanvas.width = this.config.previewSize.width;
    this.offlineCanvas.height = this.config.previewSize.height;
    this.offlineCtx = this.offlineCanvas.getContext('2d')!;
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
    const exportBtn = document.getElementById('export') as HTMLButtonElement;
    const resetBtn = document.getElementById('reset') as HTMLButtonElement;

    startBtn.addEventListener('click', () => {
      if (this.resourceManager.getAllAdSources().length === 0) {
        alert('资源尚未加载完成，请稍等');
        return;
      }

      this.stopProcessing();
      this.video.pause();
      this.video.currentTime = 0;

      // 隐藏按钮
      replayBtn.style.display = 'none';
      exportBtn.style.display = 'none';
    });

    replayBtn.addEventListener('click', () => {
      const currentPlacementId = this.stateManager.getState().currentPlacementId;
      if (!currentPlacementId) return;

      // 停止当前播放
      this.stopProcessing();

      // 重新开始跟踪（会重置到第一帧）
      this.startTracking(currentPlacementId);
    });

    exportBtn.addEventListener('click', () => {
      this.exportVideo();
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

    // 预览canvas使用配置的预览尺寸
    this.canvas.width = this.config.previewSize.width;
    this.canvas.height = this.config.previewSize.height;

    // 监听视频元数据加载，获取真实分辨率
    this.video.addEventListener('loadedmetadata', () => {
      this.videoRealWidth = this.video.videoWidth;
      this.videoRealHeight = this.video.videoHeight;

      console.log(`视频真实分辨率: ${this.videoRealWidth}x${this.videoRealHeight}`);
      console.log(`预览分辨率: ${this.canvas.width}x${this.canvas.height}`);

      // 更新离线canvas为真实分辨率（用于导出）
      this.offlineCanvas.width = this.videoRealWidth;
      this.offlineCanvas.height = this.videoRealHeight;

      // 检测帧率
      this.detectFrameRate();
    });
  }

  private detectFrameRate(): void {
    const loadingStatus = document.getElementById('loadingStatus');

    // 检查浏览器是否支持 requestVideoFrameCallback（Chrome/Edge）
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      let frameCount = 0;
      let startTime = 0;
      const sampleDuration = 1000; // 采样 1 秒
      const minFrames = 10; // 最少采样帧数

      const countFrames = (now: number, metadata: any) => {
        if (frameCount === 0) {
          startTime = now;
        }

        frameCount++;
        const elapsed = now - startTime;

        // 确保至少采样1秒且至少10帧
        if (elapsed < sampleDuration || frameCount < minFrames) {
          (this.video as any).requestVideoFrameCallback(countFrames);
        } else {
          // 计算帧率
          const calculatedFps = Math.round((frameCount * 1000) / elapsed);

          // 验证结果合理性（常见帧率：24, 25, 30, 60等）
          if (calculatedFps >= 10 && calculatedFps <= 120) {
            this.videoDetectedFps = calculatedFps;
            console.log(`检测到视频帧率: ${this.videoDetectedFps} FPS（采样 ${frameCount} 帧，耗时 ${elapsed.toFixed(0)}ms）`);
          } else {
            // 检测结果不合理，使用配置值
            this.videoDetectedFps = this.config.videoFps;
            console.warn(`帧率检测异常 (${calculatedFps} FPS)，使用配置值: ${this.videoDetectedFps} FPS`);
          }

          console.log(`导出将使用: ${this.videoRealWidth}x${this.videoRealHeight} @ ${this.videoDetectedFps} FPS`);

          if (loadingStatus) {
            loadingStatus.textContent = `✓ 已就绪 (${this.videoRealWidth}x${this.videoRealHeight} @ ${this.videoDetectedFps} FPS)`;
          }

          this.video.pause();
          this.video.currentTime = 0;
        }
      };

      // 开始播放以检测帧率
      this.video.currentTime = 0;
      this.video.play().catch(err => {
        // 播放失败，使用配置值
        console.warn('视频播放失败，无法检测帧率，使用配置值:', err);
        this.videoDetectedFps = this.config.videoFps;
        if (loadingStatus) {
          loadingStatus.textContent = `✓ 已就绪 (${this.videoRealWidth}x${this.videoRealHeight} @ ${this.videoDetectedFps} FPS 估算)`;
        }
      });

      (this.video as any).requestVideoFrameCallback(countFrames);
    } else {
      // 不支持自动检测，使用配置值
      this.videoDetectedFps = this.config.videoFps;
      console.warn(`浏览器不支持 requestVideoFrameCallback，使用配置的帧率: ${this.videoDetectedFps} FPS`);
      console.log(`导出将使用: ${this.videoRealWidth}x${this.videoRealHeight} @ ${this.videoDetectedFps} FPS`);

      if (loadingStatus) {
        loadingStatus.textContent = `✓ 已就绪 (${this.videoRealWidth}x${this.videoRealHeight} @ ${this.videoDetectedFps} FPS 估算)`;
      }
    }
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
        this.videoRealWidth,  // 使用真实分辨率
        this.videoRealHeight
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

      // 显示重播和导出按钮
      const replayBtn = document.getElementById('replay') as HTMLButtonElement;
      const exportBtn = document.getElementById('export') as HTMLButtonElement;
      if (replayBtn) {
        replayBtn.style.display = 'inline-block';
      }
      if (exportBtn) {
        exportBtn.style.display = 'inline-block';
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

  private async exportVideo(): Promise<void> {
    const currentPlacementId = this.stateManager.getState().currentPlacementId;
    if (!currentPlacementId) return;

    if (this.videoRealWidth === 0 || this.videoRealHeight === 0) {
      alert('视频尚未加载完成，请稍等');
      return;
    }

    if (this.videoDetectedFps === 0) {
      alert('视频帧率尚未检测完成，请稍等');
      return;
    }

    // 停止实时预览
    this.stopProcessing();

    // 显示进度UI
    const progressDiv = document.getElementById('exportProgress')!;
    const progressBar = document.getElementById('progressBar')!;
    const progressText = document.getElementById('progressText')!;
    const progressDetails = document.getElementById('progressDetails')!;
    progressDiv.style.display = 'block';

    // 使用检测到的帧率和真实分辨率
    const fps = this.videoDetectedFps;
    const duration = this.video.duration;
    const totalFrames = Math.floor(duration * fps);

    console.log(`开始导出: ${this.videoRealWidth}x${this.videoRealHeight} @ ${fps} FPS, 共 ${totalFrames} 帧`);

    // 创建 MediaRecorder 用于录制
    const stream = this.offlineCanvas.captureStream(fps);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8000000  // 8 Mbps
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      // 合成最终视频
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      // 自动下载
      const a = document.createElement('a');
      a.href = url;
      a.download = `ad-replaced-${this.videoRealWidth}x${this.videoRealHeight}-${fps}fps-${Date.now()}.webm`;
      a.click();

      // 隐藏进度UI
      progressDiv.style.display = 'none';
      alert(`视频导出完成！\n分辨率: ${this.videoRealWidth}x${this.videoRealHeight}\n帧率: ${fps} FPS\n总帧数: ${totalFrames}`);
    };

    // 开始录制
    mediaRecorder.start();

    // 离线渲染：逐帧处理
    const tracker = this.placementManager.getTracker(currentPlacementId);
    const transform = this.placementManager.getTransform(currentPlacementId);
    const placement = this.placementManager.getPlacement(currentPlacementId);

    if (!tracker || !transform || !placement) {
      alert('跟踪器未初始化');
      progressDiv.style.display = 'none';
      return;
    }

    // 重新初始化跟踪器（从第一帧开始）
    this.video.currentTime = 0;
    await new Promise(resolve => {
      this.video.onseeked = () => {
        // 使用真实分辨率绘制
        this.offlineCtx.drawImage(this.video, 0, 0, this.offlineCanvas.width, this.offlineCanvas.height);
        const firstFrame = this.cv.imread(this.offlineCanvas);
        tracker.cleanup();

        // 需要将预览坐标转换为真实分辨率坐标
        const scaleX = this.videoRealWidth / this.canvas.width;
        const scaleY = this.videoRealHeight / this.canvas.height;
        const scaledCorners = placement.corners.map(p => ({
          x: p.x * scaleX,
          y: p.y * scaleY
        }));

        tracker.initialize(scaledCorners, firstFrame);
        firstFrame.delete();
        this.video.onseeked = null;
        resolve(null);
      };
    });

    // 创建离线渲染器（在循环外，避免每帧创建导致内存泄漏）
    const offlineRenderer = new Renderer(this.offlineCanvas, this.offlineCtx, this.cv);
    offlineRenderer.setConfig(this.renderer.getConfig());

    // 逐帧处理
    const frameInterval = 1000 / fps;
    let currentFrame = 0;

    const processNextFrame = async () => {
      if (currentFrame >= totalFrames) {
        // 完成 - 清理资源
        offlineRenderer.cleanup();
        mediaRecorder.stop();
        return;
      }

      // 设置视频时间
      const targetTime = currentFrame / fps;
      this.video.currentTime = targetTime;

      await new Promise<void>(resolve => {
        this.video.onseeked = () => {
          // 在离线 canvas 上处理（真实分辨率）
          this.offlineCtx.drawImage(this.video, 0, 0, this.offlineCanvas.width, this.offlineCanvas.height);
          const frame = this.cv.imread(this.offlineCanvas);

          // 跟踪和渲染
          const trackedCorners = tracker.track(frame);
          const warpedAd = transform.warpAd(trackedCorners);

          // 复用离线渲染器（不再每帧创建）
          offlineRenderer.render(frame, warpedAd);

          if (warpedAd) warpedAd.delete();
          frame.delete();

          // 更新进度
          currentFrame++;
          const progress = Math.round((currentFrame / totalFrames) * 100);
          progressBar.style.width = `${progress}%`;
          progressText.textContent = `${progress}%`;
          progressDetails.textContent = `正在处理第 ${currentFrame} / ${totalFrames} 帧 (${this.videoRealWidth}x${this.videoRealHeight})`;

          this.video.onseeked = null;
          resolve();
        };
      });

      // 等待一帧时间，让 MediaRecorder 捕获
      await new Promise(resolve => setTimeout(resolve, frameInterval));

      // 继续下一帧
      processNextFrame();
    };

    processNextFrame();
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
