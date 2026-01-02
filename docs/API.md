# 技术 API 文档

详细的模块 API 说明和技术实现细节。

---

## 类型定义 (types.ts)

### Point
```typescript
export interface Point {
  x: number;
  y: number;
}
```
表示 2D 平面上的一个点。

---

### AdSource
```typescript
export interface AdSource {
  id: string;                                    // 广告资源唯一标识
  type: 'image' | 'video';                       // 资源类型
  element: HTMLImageElement | HTMLVideoElement;  // DOM 元素
  url: string;                                   // 资源 URL
}
```
表示一个广告资源（图片或视频）。

---

### AdPlacement
```typescript
export interface AdPlacement {
  id: string;         // 广告位唯一标识
  adId: string;       // 关联的广告资源 ID
  corners: Point[];   // 4 个角点坐标 [左上, 右上, 右下, 左下]
  isActive: boolean;  // 是否激活
}
```
表示视频中的一个广告位区域。

---

### AppConfig
```typescript
export interface AppConfig {
  videoUrl: string;
  videoSize: { width: number; height: number };
  ads: {
    id: string;
    url: string;
    type: 'image' | 'video';
  }[];
}
```
应用全局配置。

---

## ResourceManager (resourceManager.ts)

负责广告资源的加载和管理。

### 构造函数
```typescript
constructor(cv: any)
```
**参数**：
- `cv`: OpenCV.js 实例

---

### loadAdImage()
```typescript
async loadAdImage(id: string, url: string): Promise<AdSource>
```
异步加载广告图片。

**参数**：
- `id`: 广告资源 ID
- `url`: 图片 URL

**返回**：
- `Promise<AdSource>`: 加载完成的广告资源对象

**异常**：
- 加载失败时 reject Error

**示例**：
```typescript
const resourceManager = new ResourceManager(cv);
try {
  const ad = await resourceManager.loadAdImage('ad1', '/assets/ad.png');
  console.log('广告尺寸:', ad.element.width, 'x', ad.element.height);
} catch (error) {
  console.error('加载失败:', error);
}
```

---

### getAdSource()
```typescript
getAdSource(id: string): AdSource | undefined
```
获取已加载的广告资源。

**参数**：
- `id`: 广告资源 ID

**返回**：
- `AdSource | undefined`: 找到返回资源对象，否则返回 undefined

---

### getAllAdSources()
```typescript
getAllAdSources(): AdSource[]
```
获取所有已加载的广告资源。

**返回**：
- `AdSource[]`: 所有广告资源数组

---

### clearAll()
```typescript
clearAll(): void
```
清空所有广告资源。

---

## PlacementManager (placementManager.ts)

管理广告位及其对应的跟踪器和变换器。

### 构造函数
```typescript
constructor(cv: any)
```
**参数**：
- `cv`: OpenCV.js 实例

---

### addPlacement()
```typescript
addPlacement(placement: AdPlacement): void
```
添加新的广告位。

**参数**：
- `placement`: 广告位对象

**示例**：
```typescript
const placement: AdPlacement = {
  id: 'placement-1',
  adId: 'ad1',
  corners: [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 200 },
    { x: 100, y: 200 }
  ],
  isActive: true
};
placementManager.addPlacement(placement);
```

---

### updateCorners()
```typescript
updateCorners(placementId: string, corners: Point[]): void
```
更新广告位的角点坐标。

**参数**：
- `placementId`: 广告位 ID
- `corners`: 新的 4 个角点

---

### initializeTracking()
```typescript
initializeTracking(placementId: string, corners: Point[], firstFrame: any): void
```
为指定广告位初始化跟踪器。

**参数**：
- `placementId`: 广告位 ID
- `corners`: 初始 4 个角点
- `firstFrame`: 第一帧图像（cv.Mat）

**说明**：
- 内部创建 Tracker 实例并调用 initialize()
- 在角点周围检测特征点
- 将跟踪器存储到内部 Map

---

### initializeTransform()
```typescript
initializeTransform(
  placementId: string,
  adElement: HTMLImageElement,
  videoWidth: number,
  videoHeight: number
): void
```
为指定广告位初始化透视变换器。

**参数**：
- `placementId`: 广告位 ID
- `adElement`: 广告图片元素
- `videoWidth`: 视频宽度
- `videoHeight`: 视频高度

**说明**：
- 内部创建 Transform 实例并调用 initialize()
- 将广告图片转换为 cv.Mat

---

### getTracker()
```typescript
getTracker(placementId: string): Tracker | undefined
```
获取指定广告位的跟踪器。

**返回**：
- `Tracker | undefined`: 跟踪器实例或 undefined

---

### getTransform()
```typescript
getTransform(placementId: string): Transform | undefined
```
获取指定广告位的变换器。

**返回**：
- `Transform | undefined`: 变换器实例或 undefined

---

### getPlacement()
```typescript
getPlacement(placementId: string): AdPlacement | undefined
```
获取指定广告位信息。

**返回**：
- `AdPlacement | undefined`: 广告位对象或 undefined

---

### getAllActivePlacements()
```typescript
getAllActivePlacements(): AdPlacement[]
```
获取所有激活的广告位。

**返回**：
- `AdPlacement[]`: 激活的广告位数组

---

### forceReset()
```typescript
forceReset(): void
```
强制清空所有数据。

**说明**：
- 清理所有跟踪器资源（调用 tracker.cleanup()）
- 清理所有变换器资源（调用 transform.cleanup()）
- 清空内部所有 Map

---

## Tracker (tracker.ts)

光流跟踪器，使用 Lucas-Kanade 算法跟踪特征点。

### 构造函数
```typescript
constructor(cv: any)
```

---

### initialize()
```typescript
initialize(corners: Point[], firstFrame: any): void
```
初始化跟踪器。

**参数**：
- `corners`: 初始 4 个角点
- `firstFrame`: 第一帧灰度图像（cv.Mat）

**说明**：
- 在每个角点周围 30px 半径内检测特征点
- 使用 `cv.goodFeaturesToTrack()` 检测最多 100 个特征点
- 初始化 3 帧历史记录

**特征检测参数**：
```typescript
cv.goodFeaturesToTrack(
  frame,           // 输入图像
  features,        // 输出特征点
  100,             // 最大特征点数
  0.01,            // 质量阈值
  10,              // 最小距离
  mask,            // 检测区域掩码
  3,               // 块大小
  false,           // 是否使用 Harris
  0.04             // Harris 参数 k
)
```

---

### track()
```typescript
track(currentFrame: any): Point[]
```
跟踪当前帧，返回更新后的角点。

**参数**：
- `currentFrame`: 当前帧（cv.Mat, RGBA）

**返回**：
- `Point[]`: 跟踪后的 4 个角点坐标

**说明**：
1. 转换为灰度图
2. 使用 `cv.calcOpticalFlowPyrLK()` 计算光流
3. 统计成功跟踪的特征点
4. 计算平均偏移量并应用到角点
5. 3 帧移动平均平滑
6. 更新内部状态

**光流参数**：
```typescript
cv.calcOpticalFlowPyrLK(
  prevGray,               // 前一帧灰度图
  currentGray,            // 当前帧灰度图
  prevFeatures,           // 前一帧特征点
  nextFeatures,           // 输出：下一帧特征点
  status,                 // 输出：每个点的跟踪状态
  err,                    // 输出：每个点的误差
  new cv.Size(21, 21),    // 搜索窗口大小
  3,                      // 金字塔层数
  new cv.TermCriteria(
    cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT,
    30,                   // 最大迭代次数
    0.01                  // 精度
  )
)
```

**失败检测**：
- 成功率 < 50%：增加丢失计数
- 连续 5 帧失败：标记为 'lost'，触发 `onTrackingLost` 回调

---

### onTrackingLost (回调)
```typescript
public onTrackingLost?: () => void
```
跟踪丢失时的回调函数。

**示例**：
```typescript
tracker.onTrackingLost = () => {
  console.warn('跟踪丢失，请重新标记');
  // 显示提示信息给用户
};
```

---

### cleanup()
```typescript
cleanup(): void
```
清理资源。

**说明**：
- 释放 `featurePoints` Mat
- 释放 `prevGray` Mat
- 重置所有状态

---

## Transform (transform.ts)

透视变换器，将广告图片变形到跟踪区域。

### 构造函数
```typescript
constructor(cv: any)
```

---

### initialize()
```typescript
initialize(config: TransformConfig): void
```
初始化变换器，加载广告图片。

**参数**：
```typescript
interface TransformConfig {
  adImage: HTMLImageElement;
  videoWidth: number;
  videoHeight: number;
}
```

**说明**：
- 将 HTMLImageElement 转换为 cv.Mat（RGBA 格式）
- 存储视频尺寸用于后续变换

---

### warpAd()
```typescript
warpAd(corners: Point[]): any | null
```
执行透视变换。

**参数**：
- `corners`: 目标区域的 4 个角点

**返回**：
- `cv.Mat | null`: 变换后的广告图像（RGBA），失败返回 null

**说明**：
1. 检查边界（至少 3 个角点在画面内）
2. 定义源点（广告图片的 4 个角）
3. 定义目标点（视频中的 4 个角）
4. 计算透视变换矩阵 M
5. 执行变换

**变换过程**：
```typescript
// 源点（广告图片）
srcPoints = [
  [0, 0],
  [adWidth, 0],
  [adWidth, adHeight],
  [0, adHeight]
]

// 目标点（视频中的跟踪区域）
dstPoints = [
  [corners[0].x, corners[0].y],
  [corners[1].x, corners[1].y],
  [corners[2].x, corners[2].y],
  [corners[3].x, corners[3].y]
]

// 计算单应性矩阵
M = cv.getPerspectiveTransform(srcPoints, dstPoints)

// 执行变换
cv.warpPerspective(
  adMat,                            // 源图像
  warped,                           // 输出
  M,                                // 变换矩阵
  new cv.Size(videoWidth, videoHeight),
  cv.INTER_LINEAR,                  // 插值方法
  cv.BORDER_CONSTANT,               // 边界处理
  new cv.Scalar(0, 0, 0, 0)         // 边界颜色（透明）
)
```

---

### cleanup()
```typescript
cleanup(): void
```
清理资源。

**说明**：
- 释放 `adMat`

---

## Renderer (renderer.ts)

渲染器，将变换后的广告融合到视频帧。

### 构造函数
```typescript
constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, cv: any)
```

---

### render()
```typescript
render(videoFrame: any, warpedAd: any | null): void
```
渲染视频帧和广告。

**参数**：
- `videoFrame`: 视频帧（cv.Mat, RGBA）
- `warpedAd`: 变换后的广告（cv.Mat, RGBA）或 null

**说明**：
1. 克隆视频帧
2. 如果有广告，执行 Alpha 混合
3. 显示到 Canvas

**Alpha 混合算法**：
```typescript
for (let i = 0; i < rows; i++) {
  for (let j = 0; j < cols; j++) {
    const alpha = warpedAd.ucharPtr(i, j)[3] / 255.0;

    if (alpha > 0.1) {  // 忽略几乎透明的像素
      for (let c = 0; c < 3; c++) {  // RGB 通道
        result.ucharPtr(i, j)[c] =
          videoPixel[c] * (1 - alpha) +  // 背景
          adPixel[c] * alpha;             // 前景
      }
    }
  }
}
```

---

## MarkingUI (markingUI.ts)

角点标记 UI。

### 构造函数
```typescript
constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D)
```

---

### startMarking()
```typescript
startMarking(): void
```
开始标记模式。

**说明**：
- 先调用 `forceReset()` 清空之前的状态
- 设置光标为十字
- 添加点击事件监听器

---

### onComplete (回调)
```typescript
public onComplete?: (points: Point[]) => void
```
标记完成（4 个点）时的回调。

**参数**：
- `points`: 4 个角点数组

**示例**：
```typescript
markingUI.onComplete = (corners) => {
  console.log('用户标记了 4 个角点:', corners);
  startTracking(corners);
};
```

---

### forceReset()
```typescript
forceReset(): void
```
强制重置标记状态。

**说明**：
- 移除事件监听器（通过保存的引用）
- 清空所有标记点
- 恢复默认光标

---

### drawMarkers()
```typescript
drawMarkers(): void
```
绘制标记点和连线。

**视觉效果**：
- 红色圆圈标记每个点
- 白色数字标记顺序（1-4）
- 黄色虚线连接各点
- 完成后绿色半透明区域高亮

---

## StateManager (state.ts)

应用状态管理器。

### 构造函数
```typescript
constructor()
```

---

### getState()
```typescript
getState(): AppState
```
获取当前状态。

**返回**：
```typescript
interface AppState {
  mode: 'marking' | 'tracking' | 'idle';
  currentPlacementId: string | null;
  config: {
    videoWidth: number;
    videoHeight: number;
  };
}
```

---

### setState()
```typescript
setState(updates: Partial<AppState>): void
```
更新状态（部分更新）。

**参数**：
- `updates`: 要更新的状态字段

**示例**：
```typescript
stateManager.setState({ mode: 'tracking' });
stateManager.setState({
  mode: 'tracking',
  currentPlacementId: 'placement-123'
});
```

---

### forceReset()
```typescript
forceReset(): void
```
强制重置状态为初始值。

**说明**：
- 模式重置为 'idle'
- 清空 currentPlacementId
- 保留 config

---

## 性能优化建议

### 1. 内存管理
```typescript
// 好的做法
const mat = cv.imread(canvas);
try {
  // 使用 mat
} finally {
  mat.delete();  // 确保清理
}

// 或使用辅助函数
function withMat<T>(mat: any, fn: (mat: any) => T): T {
  try {
    return fn(mat);
  } finally {
    mat.delete();
  }
}
```

### 2. 减少 Mat 创建
```typescript
// 避免每帧创建新 Mat
class Tracker {
  private grayMat: any;

  constructor(cv: any) {
    this.grayMat = new cv.Mat();  // 复用
  }

  track(frame: any) {
    cv.cvtColor(frame, this.grayMat, cv.COLOR_RGBA2GRAY);
    // 使用 this.grayMat...
  }

  cleanup() {
    this.grayMat.delete();
  }
}
```

### 3. 降采样处理
```typescript
// 对于高分辨率视频，先缩小再处理
const scale = 0.5;
const small = new cv.Mat();
cv.resize(frame, small, new cv.Size(0, 0), scale, scale, cv.INTER_LINEAR);

// 处理 small...

// 将结果坐标放大回原尺寸
corners.forEach(p => {
  p.x /= scale;
  p.y /= scale;
});

small.delete();
```

---

## 常见问题

### Q: 如何添加第二个广告？
```typescript
// 1. 在配置中添加
private config: AppConfig = {
  ads: [
    { id: 'ad1', url: '/ad1.png', type: 'image' },
    { id: 'ad2', url: '/ad2.png', type: 'image' }  // 新增
  ]
};

// 2. 标记时选择广告
this.markingUI.onComplete = (corners) => {
  const placement: AdPlacement = {
    id: 'placement-' + Date.now(),
    adId: 'ad2',  // 使用第二个广告
    corners,
    isActive: true
  };
  // ...
};
```

### Q: 跟踪效果不好怎么办？
调整参数：
```typescript
// tracker.ts - detectFeatures()
cv.goodFeaturesToTrack(
  frame,
  features,
  200,      // 增加特征点数量
  0.01,     // 降低质量阈值可能找到更多点
  5,        // 减小最小距离
  mask,
  3,
  false,
  0.04
)

// tracker.ts - track()
cv.calcOpticalFlowPyrLK(
  ...,
  new cv.Size(31, 31),  // 增大搜索窗口
  5,                     // 增加金字塔层数
  ...
)
```

### Q: 如何导出处理后的视频？
```typescript
// 使用 MediaRecorder API
const stream = canvas.captureStream(30);  // 30 FPS
const recorder = new MediaRecorder(stream, {
  mimeType: 'video/webm',
  videoBitsPerSecond: 5000000
});

const chunks: Blob[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  // 下载 url
};

recorder.start();
// 播放视频...
recorder.stop();
```
