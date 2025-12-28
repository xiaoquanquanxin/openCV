function onOpenCvReady() {
  const video = document.getElementById('videoInput') as HTMLVideoElement;
  const canvas = document.getElementById('canvasOutput') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const maxVideoWidth = 854;
  const maxVideoHeight = 480;
  const maxAdWidth = 200;
  const maxAdHeight = 100;
  const adImage = new Image();

  // 直接加载固定的视频和广告图片
  video.src = '/assets/videos/stock.mp4';
  video.load();
  adImage.src = '/assets/images/ad-image.png';

  // 处理广告图像加载完成
  adImage.onload = function() {
    console.log("广告图像已加载");
    console.log("广告图像尺寸：", adImage.width, adImage.height);

    // 自动调整广告图像的大小
    let adWidth = maxAdWidth;
    let adHeight = (adImage.height / adImage.width) * maxAdWidth;
    if (adHeight > maxAdHeight) {
      adHeight = maxAdHeight;
      adWidth = (adImage.width / adImage.height) * maxAdHeight;
    }

    console.log("调整后的广告图像尺寸：", adWidth, adHeight);

    // 处理视频帧
    function processVideo() {
      if (video.paused || video.ended) return;

      // 设置 canvas 的宽高
      canvas.width = maxVideoWidth;
      canvas.height = maxVideoHeight;

      // 将当前视频帧绘制到 canvas 上
      ctx.drawImage(video, 0, 0, maxVideoWidth, maxVideoHeight);

      // 插入广告图像到视频帧的左上角
      ctx.drawImage(adImage, 20, 20, adWidth, adHeight);

      // 显示处理后的图像
      const cv = (window as any).cv;
      if (cv) {
        cv.imshow(canvas, cv.imread(canvas));
      }

      // 继续处理下一帧
      requestAnimationFrame(processVideo);
    }

    // 当视频播放时开始处理
    video.onplay = function () {
      processVideo();
    };
  };

  // 处理广告图像加载错误
  adImage.onerror = function() {
    console.log("广告图像加载失败！");
  };
}

// 等待 OpenCV 加载完成
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