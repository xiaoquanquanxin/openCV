# 双模式渲染架构

说明实时预览 vs 离线渲染的设计思路和实现。

---

## 🎯 设计理念

### 问题
之前的架构存在根本性问题：
- ❌ 关注实时性能瓶颈（25 FPS vs 60 FPS）
- ❌ 用户必须等待算法处理完才能看下一帧
- ❌ 性能不足的设备无法流畅使用

### 解决方案
**分离"预览"和"输出"两个阶段**，就像专业视频编辑软件：
```
Adobe Premiere / Final Cut Pro 工作流:
1. 编辑时：低质量预览（可跳帧）
2. 导出时：高质量渲染（离线处理）
```

---

## 🏗️ 新架构

### 两种模式

#### 1. **实时预览模式**（Preview Mode）
```
目标：快速查看效果，调整参数
方式：requestAnimationFrame 实时处理
性能：25-30 FPS（可能跳帧）
Canvas：主 Canvas（可见）
优化：可以降低分辨率、减少特征点

用途：
- 调试参数（运动阈值、膨胀、模糊）
- 快速验证标记是否正确
- 实时查看跟踪效果
```

#### 2. **离线渲染模式**（Offline Render Mode）⭐
```
目标：输出高质量视频
方式：逐帧处理，不受实时限制
性能：慢但质量高（30 FPS 输出）
Canvas：离线 Canvas（隐藏）
优化：全质量处理

用途：
- 生成最终视频文件
- 不跳帧，每一帧都完整处理
- 可以处理长视频
```

---

## 📐 两个 Canvas 设计

### Canvas 1: 预览 Canvas（主 Canvas）
```html
<canvas id="canvasOutput" width="854" height="480"></canvas>
```

**特点**：
- ✅ 可见，用户能看到
- ✅ 实时渲染（requestAnimationFrame）
- ⚠️ 可能跳帧、卡顿
- 🎯 用途：编辑和调试

---

### Canvas 2: 离线 Canvas（隐藏）
```javascript
this.offlineCanvas = document.createElement('canvas');
this.offlineCanvas.width = 854;
this.offlineCanvas.height = 480;
// 不添加到 DOM，完全在后台工作
```

**特点**：
- ✅ 隐藏，不影响页面
- ✅ 逐帧处理（自定义循环）
- ✅ 每一帧都完整处理
- 🎯 用途：导出视频

---

## 🔄 工作流程

### 用户操作流程

```
1. 标记 4 个角点
   ↓
2. 实时预览模式启动
   - 主 Canvas 显示效果
   - 可能卡顿（25 FPS）
   - 可以调整参数
   ↓
3. 调整参数 → 点击"重播"
   - 重新实时预览
   - 快速迭代
   ↓
4. 满意后点击"导出视频"
   - 切换到离线渲染模式
   - 离线 Canvas 逐帧处理
   - 显示进度条
   ↓
5. 导出完成
   - 自动下载 WebM 视频
   - 30 FPS, 8 Mbps
```

---

## 💻 技术实现

### 实时预览模式（当前已有）

```typescript
private processVideoWithTracking(): void {
  if (!this.isProcessing) return;

  // 读取视频帧到主 Canvas
  this.ctx.drawImage(this.video, 0, 0, ...);
  const frame = this.cv.imread(this.canvas);

  // 跟踪 + 变换 + 渲染
  const corners = tracker.track(frame);
  const ad = transform.warpAd(corners);
  renderer.render(frame, ad);

  // 继续下一帧（浏览器决定时机）
  requestAnimationFrame(() => this.processVideoWithTracking());
}
```

**特点**：
- 使用 `requestAnimationFrame`
- 受浏览器刷新率限制
- 如果处理慢，会跳帧

---

### 离线渲染模式（新增）⭐

```typescript
private async exportVideo(): Promise<void> {
  // 1. 停止实时预览
  this.stopProcessing();

  // 2. 设置 MediaRecorder 录制离线 Canvas
  const stream = this.offlineCanvas.captureStream(30); // 30 FPS
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 8000000  // 8 Mbps
  });

  recorder.start();

  // 3. 逐帧处理（手动控制）
  const fps = 30;
  const totalFrames = Math.floor(video.duration * fps);

  for (let i = 0; i < totalFrames; i++) {
    // 3.1 跳转到指定时间
    video.currentTime = i / fps;
    await waitForSeeked();

    // 3.2 在离线 Canvas 上处理
    offlineCtx.drawImage(video, 0, 0, ...);
    const frame = cv.imread(offlineCanvas);

    // 3.3 完整处理（不受时间限制）
    const corners = tracker.track(frame);
    const ad = transform.warpAd(corners);
    offlineRenderer.render(frame, ad);

    // 3.4 更新进度条
    updateProgress(i, totalFrames);

    // 3.5 等待 MediaRecorder 捕获这一帧
    await sleep(1000 / fps);
  }

  // 4. 停止录制，生成视频文件
  recorder.stop();
  // recorder.onstop 会自动下载
}
```

**关键点**：
- ❌ **不使用** `requestAnimationFrame`
- ✅ **手动控制** 每一帧的处理时机
- ✅ 每一帧都完整处理，不跳帧
- ✅ 可以花任意长时间处理一帧
- ✅ 使用 `MediaRecorder` API 录制 Canvas

---

## 📊 性能对比

### 场景：处理 10 秒视频（300 帧 @ 30 FPS）

| 模式 | 处理方式 | 每帧耗时 | 总耗时 | 跳帧？ | 输出质量 |
|------|---------|---------|-------|-------|---------|
| **实时预览** | requestAnimationFrame | 40ms | 10秒 | ✅ 跳帧 | 低（跳了125帧）|
| **离线渲染** | 逐帧处理 | 40ms | 12秒 | ❌ 不跳帧 | 高（完整300帧）|

**计算**：
- 实时预览：10秒内只能处理 250 帧（10s / 0.04s = 250）→ 跳了 50 帧
- 离线渲染：300 帧 × 40ms = 12 秒 → 所有帧都处理

---

## 🎨 用户体验优化

### 进度显示

```html
<div id="exportProgress">
  <h4>离线渲染中...</h4>
  <div class="progress-bar">
    <div id="progressBar" style="width: 45%"></div>
    <span id="progressText">45%</span>
  </div>
  <p id="progressDetails">
    正在处理第 135 / 300 帧（不受实时性能限制）
  </p>
</div>
```

**作用**：
- 告诉用户当前进度
- 显示估计剩余时间
- 强调"不受实时性能限制"

---

### 禁用按钮

导出时禁用其他操作：
```typescript
exportBtn.addEventListener('click', () => {
  // 禁用所有按钮
  startBtn.disabled = true;
  replayBtn.disabled = true;
  resetBtn.disabled = true;

  exportVideo();

  // 完成后恢复
});
```

---

## 🔬 技术细节

### MediaRecorder API

```javascript
// 创建录制器
const stream = canvas.captureStream(fps);
const recorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9',
  videoBitsPerSecond: 8000000
});

// 收集数据
const chunks = [];
recorder.ondataavailable = (e) => chunks.push(e.data);

// 生成文件
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, 'output.webm');
};

// 开始录制
recorder.start();
// ... 处理帧 ...
recorder.stop();
```

**工作原理**：
1. `canvas.captureStream(fps)` 创建视频流
2. MediaRecorder 持续捕获 Canvas 内容
3. 每次 Canvas 更新，MediaRecorder 记录一帧
4. 停止后合成 WebM 视频

---

### 逐帧处理的同步

```typescript
// 问题：video.currentTime 是异步的
video.currentTime = 5.0;
// 此时视频还没跳转完成！

// 解决：等待 seeked 事件
await new Promise(resolve => {
  video.onseeked = () => {
    // 现在视频已经跳转到 5.0 秒
    resolve();
  };
});
```

---

## 🚀 未来优化方向

### 1. 可选分辨率
```typescript
const exportResolutions = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

// 让用户选择导出分辨率
```

---

### 2. 多线程处理（Web Workers）
```
主线程:           Worker 1:        Worker 2:
读取帧 1          处理帧 1         -
读取帧 2          处理帧 2         处理帧 1
读取帧 3          处理帧 3         处理帧 2
...               ...              ...

2x 速度提升
```

---

### 3. FFmpeg.wasm（更好的编码）
```typescript
// 使用 FFmpeg 编码为 MP4
import { createFFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg();
await ffmpeg.load();

// 将帧序列编码为 MP4
ffmpeg.run('-framerate', '30', '-i', 'frame%d.png', '-c:v', 'libx264', 'output.mp4');
```

**优势**：
- 更好的压缩（MP4 vs WebM）
- 更广泛的兼容性
- 更多编码选项

---

## 💡 总结

### 核心思想
```
专业软件的黄金法则:
预览 ≠ 输出

预览：快速、可跳帧、用于调试
输出：高质量、不跳帧、用于交付
```

### 为什么这样设计？

1. **实时预览**：
   - 用户需要快速看到效果
   - 调整参数时需要即时反馈
   - 允许卡顿和跳帧

2. **离线渲染**：
   - 用户需要完美的输出
   - 不care渲染需要多久
   - 每一帧都完整处理

3. **两个 Canvas**：
   - 预览 Canvas：用户可见，实时更新
   - 离线 Canvas：后台工作，不影响页面

### 用户获得的好处

✅ 不再关心"25 FPS vs 60 FPS"
✅ 预览可以卡顿，但输出完美
✅ 可以处理长视频
✅ 性能差的设备也能用
✅ 专业视频编辑体验

---

**文档版本**: v1.2.0
**最后更新**: 2026-01-02
