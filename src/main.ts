import cv from '@techstark/opencv-js';

class VideoAdInserter {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private adImage = new Image();
  private videoFile: File | null = null;
  private adFile: File | null = null;
  
  private readonly maxVideoWidth = 854;
  private readonly maxVideoHeight = 480;
  private readonly maxAdWidth = 200;
  private readonly maxAdHeight = 100;

  constructor() {
    this.video = document.getElementById('videoInput') as HTMLVideoElement;
    this.canvas = document.getElementById('canvasOutput') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.initEventListeners();
    this.loadDefaultAssets();
  }

  private loadDefaultAssets() {
    // 预加载默认的示例资源
    this.loadDefaultVideo('/assets/videos/stock.mp4');
    this.loadDefaultAd('/assets/images/ad-image.png');
  }

  private loadDefaultVideo(path: string) {
    this.video.src = path;
    this.video.load();
  }

  private loadDefaultAd(path: string) {
    this.adImage.src = path;
  }

  private initEventListeners() {
    document.getElementById('uploadVideo')?.addEventListener('change', (e) => {
      this.videoFile = (e.target as HTMLInputElement).files?.[0] || null;
      this.updateConfirmButton();
    });

    document.getElementById('uploadAdImage')?.addEventListener('change', (e) => {
      this.adFile = (e.target as HTMLInputElement).files?.[0] || null;
      if (this.adFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.adImage.src = e.target?.result as string;
        };
        reader.readAsDataURL(this.adFile);
      }
      this.updateConfirmButton();
    });

    document.getElementById('confirmButton')?.addEventListener('click', () => {
      this.processVideo();
    });

    this.adImage.onload = () => {
      console.log('广告图像已加载');
      this.video.onplay = () => this.renderFrames();
    };
  }

  private updateConfirmButton() {
    const button = document.getElementById('confirmButton') as HTMLButtonElement;
    button.disabled = !(this.videoFile && this.adFile);
  }

  private processVideo() {
    if (this.videoFile) {
      const videoURL = URL.createObjectURL(this.videoFile);
      this.video.src = videoURL;
      this.video.load();
      this.video.play();
    }
  }

  private renderFrames() {
    if (this.video.paused || this.video.ended) return;

    this.canvas.width = this.maxVideoWidth;
    this.canvas.height = this.maxVideoHeight;

    this.ctx.drawImage(this.video, 0, 0, this.maxVideoWidth, this.maxVideoHeight);

    const { width: adWidth, height: adHeight } = this.calculateAdSize();
    this.ctx.drawImage(this.adImage, 20, 20, adWidth, adHeight);

    requestAnimationFrame(() => this.renderFrames());
  }

  private calculateAdSize() {
    let adWidth = this.maxAdWidth;
    let adHeight = (this.adImage.height / this.adImage.width) * this.maxAdWidth;
    
    if (adHeight > this.maxAdHeight) {
      adHeight = this.maxAdHeight;
      adWidth = (this.adImage.width / this.adImage.height) * this.maxAdHeight;
    }
    
    return { width: adWidth, height: adHeight };
  }
}

new VideoAdInserter();