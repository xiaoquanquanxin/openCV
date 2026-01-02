import { MarkingUI } from './modules/markingUI';
import { StateManager } from './modules/state';
import { Tracker } from './modules/tracker';
import { Transform } from './modules/transform';
import { Renderer } from './modules/renderer';
import { Point } from './types';

class VideoAdReplacer {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cv: any;
  private stateManager: StateManager;
  private markingUI: MarkingUI;
  private tracker: Tracker;
  private transform: Transform;
  private renderer: Renderer;
  private adImage: HTMLImageElement;

  constructor() {
    this.initElements();
    this.loadAdImage();
    this.initModules();
    this.setupEventListeners();
    this.loadVideo();
  }

  private initElements(): void {
    this.video = document.getElementById('videoInput') as HTMLVideoElement;
    this.canvas = document.getElementById('canvasOutput') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.cv = (window as any).cv;
  }

  private loadAdImage(): void {
    this.adImage = new Image();
    this.adImage.src = '/assets/images/ad-image.png';
    this.adImage.onload = () => {
      console.log('广告图像加载完成');
      this.transform = new Transform(this.cv);
      this.transform.initialize({
        adImage: this.adImage,
        videoWidth: 854,
        videoHeight: 480
      });
    };
  }

  private initModules(): void {
    this.stateManager = new StateManager();
    this.markingUI = new MarkingUI(this.canvas, this.ctx);
    this.tracker = new Tracker(this.cv);
    this.renderer = new Renderer(this.canvas, this.ctx, this.cv);

    this.tracker.onTrackingLost = () => {
      console.warn('跟踪丢失！');
    };

    this.markingUI.onComplete = (corners) => {
      console.log('标记完成:', corners);
      this.stateManager.setState({
        mode: 'tracking',
        corners
      });
      this.startTracking();
    };
  }

  private setupEventListeners(): void {
    const startBtn = document.getElementById('startMarking') as HTMLButtonElement;
    const resetBtn = document.getElementById('reset') as HTMLButtonElement;

    startBtn.addEventListener('click', () => {
      this.video.pause();
      this.video.currentTime = 0;
      this.markingUI.startMarking();
    });

    resetBtn.addEventListener('click', () => {
      this.markingUI.reset();
      this.stateManager.reset();
      this.video.currentTime = 0;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    });

    this.video.addEventListener('seeked', () => {
      if (this.stateManager.getState().mode === 'idle' || this.stateManager.getState().mode === 'marking') {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      }
    });
  }

  private loadVideo(): void {
    this.video.src = '/assets/videos/stock.mp4';
    this.canvas.width = 854;
    this.canvas.height = 480;
  }

  private startTracking(): void {
    const corners = this.stateManager.getState().corners;

    // 暂停视频，回到第一帧
    this.video.pause();
    this.video.currentTime = 0;

    // 等待视频定位到第一帧
    const onSeeked = () => {
      // 读取第一帧
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const firstFrame = this.cv.imread(this.canvas);

      // 初始化跟踪器
      this.tracker.initialize(corners, firstFrame);
      firstFrame.delete();

      // 开始播放
      this.video.play();
      this.video.removeEventListener('seeked', onSeeked);
      this.processVideoWithTracking();
    };

    this.video.addEventListener('seeked', onSeeked);
  }

  private processVideoWithTracking(): void {
    if (this.video.paused || this.video.ended) return;

    // 读取当前帧
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    const currentFrame = this.cv.imread(this.canvas);

    // 跟踪
    const trackedCorners = this.tracker.track(currentFrame);

    // 执行透视变换
    const warpedAd = this.transform.warpAd(trackedCorners);

    // 使用渲染器融合
    this.renderer.render(currentFrame, warpedAd, trackedCorners);

    if (warpedAd) warpedAd.delete();
    currentFrame.delete();

    requestAnimationFrame(() => this.processVideoWithTracking());
  }
}

function onOpenCvReady() {
  console.log('OpenCV.js 已加载');
  new VideoAdReplacer();
}

// OpenCV加载检测
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
